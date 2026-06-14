import "server-only";
import { query, pool } from "./db";
import type { Match, MatchView, Team } from "./types";
import { predictionPoints } from "./scoring";
import { resolveBracket } from "./bracket";
import { parseKickoffMs } from "./format";

export async function getTeams(): Promise<Team[]> {
  return query<Team[]>(
    "SELECT id, name, code, flag, group_letter FROM teams ORDER BY group_letter, id"
  );
}

export async function getMatches(): Promise<Match[]> {
  return query<Match[]>(
    `SELECT id, stage, group_letter, matchday, round_name, home_team_id, away_team_id,
            home_label, away_label,
            DATE_FORMAT(kickoff, '%Y-%m-%dT%H:%i:%s') AS kickoff,
            home_score, away_score, status, external_id, ord, code, winner_team_id
     FROM matches ORDER BY ord`
  );
}

// Un partido está bloqueado para pronosticar si ya empezó o ya tiene resultado.
export function isLocked(m: Pick<Match, "kickoff" | "status">): boolean {
  if (m.status === "finished") return true;
  const ms = parseKickoffMs(m.kickoff);
  if (ms == null) return false;
  return ms <= Date.now();
}

// Devuelve todos los partidos enriquecidos con equipos y el pronóstico del usuario.
export async function getMatchViews(userId: number): Promise<MatchView[]> {
  const [teams, matches, preds] = await Promise.all([
    getTeams(),
    getMatches(),
    query<{ match_id: number; pred_home: number; pred_away: number; points: number | null }[]>(
      "SELECT match_id, pred_home, pred_away, points FROM predictions WHERE user_id = ?",
      [userId]
    ),
  ]);
  const teamById = new Map(teams.map((t) => [t.id, t]));
  const predByMatch = new Map(preds.map((p) => [p.match_id, p]));

  return matches.map((m) => {
    const p = predByMatch.get(m.id);
    return {
      ...m,
      home_team: m.home_team_id ? teamById.get(m.home_team_id) ?? null : null,
      away_team: m.away_team_id ? teamById.get(m.away_team_id) ?? null : null,
      pred_home: p?.pred_home ?? null,
      pred_away: p?.pred_away ?? null,
      points: p?.points ?? null,
    };
  });
}

// Guarda/actualiza un pronóstico, validando que el partido no esté bloqueado.
export async function savePrediction(
  userId: number,
  matchId: number,
  predHome: number,
  predAway: number
): Promise<{ ok: boolean; error?: string }> {
  const rows = await query<Match[]>(
    "SELECT id, DATE_FORMAT(kickoff, '%Y-%m-%dT%H:%i:%s') AS kickoff, status FROM matches WHERE id = ?",
    [matchId]
  );
  const m = rows[0];
  if (!m) return { ok: false, error: "El partido no existe." };
  if (isLocked(m)) return { ok: false, error: "El partido ya empezó: no se puede modificar." };
  if (predHome < 0 || predAway < 0 || predHome > 99 || predAway > 99) {
    return { ok: false, error: "Resultado inválido." };
  }
  await query(
    `INSERT INTO predictions (user_id, match_id, pred_home, pred_away)
     VALUES (?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE pred_home = VALUES(pred_home), pred_away = VALUES(pred_away)`,
    [userId, matchId, predHome, predAway]
  );
  return { ok: true };
}

export type RankRow = {
  id: number;
  name: string;
  pts: number;
  exactos: number;
  aciertos: number;
  jugados: number;
  total: number;
};

export async function getRanking(): Promise<RankRow[]> {
  return query<RankRow[]>(
    `SELECT u.id, u.name,
            COALESCE(SUM(p.points), 0)                              AS pts,
            COALESCE(SUM(p.points = 10), 0)                         AS exactos,
            COALESCE(SUM(p.points > 0), 0)                          AS aciertos,
            COALESCE(SUM(p.points IS NOT NULL), 0)                  AS jugados,
            COUNT(p.id)                                             AS total
     FROM users u
     LEFT JOIN predictions p ON p.user_id = u.id
     GROUP BY u.id, u.name
     ORDER BY pts DESC, exactos DESC, u.name ASC`
  );
}

// Carga (o corrige) el resultado real de un partido y recalcula puntos + cuadro.
// `winnerTeamId` se usa solo en eliminatorias cuando hay empate (definición por penales).
export async function setMatchResult(
  matchId: number,
  homeScore: number,
  awayScore: number,
  winnerTeamId: number | null = null,
  recompute = true
): Promise<void> {
  await query(
    "UPDATE matches SET home_score = ?, away_score = ?, status = 'finished', winner_team_id = ? WHERE id = ?",
    [homeScore, awayScore, winnerTeamId, matchId]
  );
  await rescoreMatch(matchId);
  if (recompute) await recomputeBracket();
}

// Borra el resultado real (vuelve a estado "programado") y limpia los puntos.
export async function clearMatchResult(matchId: number): Promise<void> {
  await query(
    "UPDATE matches SET home_score = NULL, away_score = NULL, status = 'scheduled', winner_team_id = NULL WHERE id = ?",
    [matchId]
  );
  await rescoreMatch(matchId);
  await recomputeBracket();
}

// Recalcula TODO el cuadro de eliminatorias a partir de los resultados reales y
// escribe los equipos/etiquetas resueltos en cada llave. Si una llave cambia de
// equipos, se borran los pronósticos viejos de esa llave (ya no aplican).
export async function recomputeBracket(): Promise<void> {
  const [teams, matches] = await Promise.all([getTeams(), getMatches()]);
  const resolved = resolveBracket(teams, matches);
  const byCode = new Map(matches.filter((m) => m.code).map((m) => [m.code!, m]));

  for (const r of resolved) {
    const current = byCode.get(r.code);
    if (!current) continue;
    const teamsChanged =
      current.home_team_id !== r.homeTeamId || current.away_team_id !== r.awayTeamId;
    await query(
      `UPDATE matches SET home_team_id = ?, away_team_id = ?, home_label = ?, away_label = ?
       WHERE id = ?`,
      [r.homeTeamId, r.awayTeamId, r.homeLabel, r.awayLabel, current.id]
    );
    if (teamsChanged) {
      await query("DELETE FROM predictions WHERE match_id = ?", [current.id]);
    }
  }
}

// Recalcula los puntos de todos los pronósticos de un partido ya finalizado.
export async function rescoreMatch(matchId: number): Promise<void> {
  const rows = await query<Match[]>(
    "SELECT home_score, away_score, status FROM matches WHERE id = ?",
    [matchId]
  );
  const m = rows[0];
  const conn = await pool.getConnection();
  try {
    if (!m || m.status !== "finished" || m.home_score == null || m.away_score == null) {
      // Si el partido vuelve a estado "sin resultado", limpiamos los puntos.
      await conn.query("UPDATE predictions SET points = NULL WHERE match_id = ?", [matchId]);
      return;
    }
    const preds = await query<{ id: number; pred_home: number; pred_away: number }[]>(
      "SELECT id, pred_home, pred_away FROM predictions WHERE match_id = ?",
      [matchId]
    );
    for (const p of preds) {
      const pts = predictionPoints(p.pred_home, p.pred_away, m.home_score, m.away_score);
      await conn.query("UPDATE predictions SET points = ? WHERE id = ?", [pts, p.id]);
    }
  } finally {
    conn.release();
  }
}

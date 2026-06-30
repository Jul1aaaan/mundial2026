import "server-only";
import { query } from "./db";
import { codeFor } from "./sync";
import { rescoreMatch } from "./data";
import type { Goal, TimelineItem, Lineup, LineupPlayer, EspnDetail } from "./types";

// API pública (no oficial) de ESPN para datos detallados del Mundial 2026.
const ESPN = "https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world";

function ymd(d: Date): string {
  return `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, "0")}${String(d.getUTCDate()).padStart(2, "0")}`;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function espnGet(path: string): Promise<any | null> {
  try {
    const r = await fetch(ESPN + path, { next: { revalidate: 3600 } }); // cache 1h
    return r.ok ? await r.json() : null;
  } catch {
    return null;
  }
}

// código local de cada equipo del evento, por id de ESPN.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function teamCodesById(competitors: any[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const c of competitors ?? []) {
    const code = codeFor(c.team?.displayName ?? "", c.team?.abbreviation);
    if (code) map.set(String(c.team?.id ?? c.id), code);
  }
  return map;
}

// Busca el id del evento de ESPN para nuestro partido (por fecha UTC ± 1 día y los 2 equipos).
export async function findEspnEventId(
  kickoff: string,
  homeCode: string,
  awayCode: string
): Promise<string | null> {
  const base = new Date(kickoff.endsWith("Z") ? kickoff : kickoff.replace(" ", "T") + "Z");
  if (Number.isNaN(base.getTime())) return null;

  for (const offset of [0, -1, 1]) {
    const d = new Date(base.getTime() + offset * 86400000);
    const sb = await espnGet(`/scoreboard?dates=${ymd(d)}`);
    for (const ev of sb?.events ?? []) {
      const byId = teamCodesById(ev.competitions?.[0]?.competitors ?? []);
      const codes = new Set(byId.values());
      if (codes.size === 2 && codes.has(homeCode) && codes.has(awayCode)) {
        return String(ev.id);
      }
    }
  }
  return null;
}

// Goles de un evento (minuto, goleador, asistencia, penal, en contra).
export async function fetchEspnGoals(eventId: string): Promise<Goal[]> {
  const sum = await espnGet(`/summary?event=${eventId}`);
  if (!sum) return [];
  const idToCode = teamCodesById(sum.header?.competitions?.[0]?.competitors ?? []);

  return (sum.keyEvents ?? [])
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .filter((k: any) => k.scoringPlay)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .map((k: any) => {
      const code = idToCode.get(String(k.team?.id)) ?? null;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const players = (k.participants ?? []).map((p: any) => p.athlete?.displayName).filter(Boolean);
      const text: string = k.text ?? "";
      return {
        min: String(k.clock?.displayValue ?? "").replace(/'/g, "").trim(),
        code,
        scorer: players[0] ?? (k.shortText ?? "").replace(/\s*Goal.*$/i, "").trim(),
        assist: players[1] ?? null,
        pen: /penalty/i.test(text),
        og: /own goal/i.test(text),
      };
    })
    .filter((g: Goal) => g.code);
}

// Completa los goles (y el espn_id) de los partidos finalizados que aún no los tienen.
export async function backfillEspnGoals(): Promise<number> {
  const pending = await query<
    { id: number; kickoff: string; home_code: string; away_code: string }[]
  >(
    `SELECT m.id, DATE_FORMAT(m.kickoff, '%Y-%m-%dT%H:%i:%s') AS kickoff,
            th.code AS home_code, ta.code AS away_code
     FROM matches m
     JOIN teams th ON th.id = m.home_team_id
     JOIN teams ta ON ta.id = m.away_team_id
     WHERE m.status = 'finished' AND m.goals IS NULL AND m.kickoff IS NOT NULL
     ORDER BY m.kickoff DESC
     LIMIT 25`
  );

  let done = 0;
  for (const m of pending) {
    const eventId = await findEspnEventId(m.kickoff, m.home_code, m.away_code);
    if (!eventId) continue; // se reintenta en la próxima sync
    const goals = await fetchEspnGoals(eventId);
    await query("UPDATE matches SET espn_id = ?, goals = ? WHERE id = ?", [
      eventId,
      JSON.stringify(goals),
      m.id,
    ]);
    done++;
  }
  return done;
}

// Resultado de eliminatorias desde ESPN: marcador en los 90'/120' (sin penales) y, si se
// definió por penales, el código del equipo que avanza. football-data NO es fiable acá
// (mezcla los penales en el marcador y a veces no marca el ganador).
export async function fetchEspnResult(eventId: string): Promise<{
  homeCode: string | null;
  awayCode: string | null;
  homeScore: number | null;
  awayScore: number | null;
  penWinnerCode: string | null;
} | null> {
  const sum = await espnGet(`/summary?event=${eventId}`);
  const comp = sum?.header?.competitions?.[0];
  if (!comp) return null;
  const isPen = /PEN/i.test(comp.status?.type?.name ?? "");
  let home: { code: string | null; score: number | null } | null = null;
  let away: { code: string | null; score: number | null } | null = null;
  let penWinnerCode: string | null = null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const c of (comp.competitors ?? []) as any[]) {
    const code = codeFor(c.team?.displayName ?? "", c.team?.abbreviation);
    const score = c.score != null ? Number(c.score) : null;
    if (c.homeAway === "home") home = { code, score };
    else away = { code, score };
    if (isPen && c.winner) penWinnerCode = code;
  }
  if (!home || !away) return null;
  return { homeCode: home.code, awayCode: away.code, homeScore: home.score, awayScore: away.score, penWinnerCode };
}

// Completa el GANADOR (quién avanza) de los cruces de eliminatorias que terminaron empatados
// y se definieron por penales, usando ESPN. Re-puntúa esos partidos.
export async function backfillKnockoutWinners(): Promise<number> {
  const pending = await query<
    {
      id: number; kickoff: string; home_code: string; away_code: string;
      home_team_id: number; away_team_id: number; espn_id: string | null;
    }[]
  >(
    `SELECT m.id, DATE_FORMAT(m.kickoff, '%Y-%m-%dT%H:%i:%s') AS kickoff,
            th.code AS home_code, ta.code AS away_code,
            m.home_team_id, m.away_team_id, m.espn_id
     FROM matches m
     JOIN teams th ON th.id = m.home_team_id
     JOIN teams ta ON ta.id = m.away_team_id
     WHERE m.stage <> 'group' AND m.status = 'finished'
       AND m.home_score IS NOT NULL AND m.home_score = m.away_score
       AND m.winner_team_id IS NULL AND m.kickoff IS NOT NULL
     LIMIT 25`
  );

  let done = 0;
  for (const m of pending) {
    const eventId = m.espn_id ?? (await findEspnEventId(m.kickoff, m.home_code, m.away_code));
    if (!eventId) continue;
    const r = await fetchEspnResult(eventId);
    if (!r || !r.penWinnerCode) continue;
    const winnerId =
      r.penWinnerCode === m.home_code ? m.home_team_id :
      r.penWinnerCode === m.away_code ? m.away_team_id : null;
    if (winnerId == null) continue;
    await query("UPDATE matches SET winner_team_id = ?, espn_id = COALESCE(espn_id, ?) WHERE id = ?", [winnerId, eventId, m.id]);
    await rescoreMatch(m.id); // recalcula puntos (ahora con el bonus de penales)
    done++;
  }
  return done;
}

// Resumen completo de un partido (para el panel "Detalles").
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function fetchEspnSummary(eventId: string): Promise<any | null> {
  return espnGet(`/summary?event=${eventId}`);
}

const STAT_LABELS: [string, string][] = [
  ["possessionPct", "Posesión %"],
  ["totalShots", "Remates"],
  ["shotsOnTarget", "Al arco"],
  ["foulsCommitted", "Faltas"],
  ["wonCorners", "Córners"],
  ["offsides", "Offsides"],
  ["yellowCards", "Amarillas"],
  ["redCards", "Rojas"],
  ["saves", "Atajadas"],
];

function kindOf(t: string): TimelineItem["kind"] | null {
  if (/goal/i.test(t)) return "goal";
  if (/yellow/i.test(t)) return "yellow";
  if (/red/i.test(t)) return "red";
  if (/sub/i.test(t)) return "sub";
  return null;
}

// Arma el detalle completo del partido a partir del resumen de ESPN.
export async function getEspnDetail(eventId: string): Promise<EspnDetail | null> {
  const sum = await fetchEspnSummary(eventId);
  if (!sum) return null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const comps: any[] = sum.header?.competitions?.[0]?.competitors ?? [];
  const byId = new Map<string, { code: string | null; name: string; score: number | null }>();
  let home = { name: "", code: null as string | null, score: null as number | null };
  let away = { name: "", code: null as string | null, score: null as number | null };
  for (const c of comps) {
    const code = codeFor(c.team?.displayName ?? "", c.team?.abbreviation);
    const info = { code, name: c.team?.displayName ?? "", score: c.score != null ? Number(c.score) : null };
    byId.set(String(c.team?.id), info);
    if (c.homeAway === "home") home = info;
    else away = info;
  }
  const codeOf = (teamId: unknown) => byId.get(String(teamId))?.code ?? null;

  const timeline: TimelineItem[] = (sum.keyEvents ?? [])
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .map((k: any): TimelineItem | null => {
      const kind = kindOf(k.type?.text ?? "");
      if (!kind) return null;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const players = (k.participants ?? []).map((p: any) => p.athlete?.displayName).filter(Boolean);
      return {
        min: String(k.clock?.displayValue ?? "").replace(/'/g, "").trim(),
        code: codeOf(k.team?.id),
        kind,
        main: players[0] ?? "",
        sub: players[1] ?? null,
      };
    })
    .filter(Boolean) as TimelineItem[];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const lineups: Lineup[] = (sum.rosters ?? []).map((r: any) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const players = (r.roster ?? []).map((p: any) => ({
      num: String(p.jersey ?? ""),
      name: p.athlete?.displayName ?? "",
      pos: p.position?.abbreviation ?? "",
      posName: p.position?.name ?? "",
      starter: !!p.starter,
    }));
    return {
      code: codeOf(r.team?.id),
      name: r.team?.displayName ?? "",
      formation: r.formation ?? null,
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      starters: players.filter((p: { starter: boolean }) => p.starter).map(({ starter, ...rest }: LineupPlayer & { starter: boolean }) => rest),
      bench: players
        .filter((p: { starter: boolean }) => !p.starter)
        .map((p: { num: string; name: string }) => ({ num: p.num, name: p.name })),
    };
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const teamStats = (sum.boxscore?.teams ?? []).map((t: any) => ({
    code: codeOf(t.team?.id),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    stats: Object.fromEntries((t.statistics ?? []).map((s: any) => [s.name, s.displayValue])),
  }));
  const hs = teamStats.find((t: { code: string | null }) => t.code === home.code)?.stats ?? {};
  const as = teamStats.find((t: { code: string | null }) => t.code === away.code)?.stats ?? {};
  const stats = STAT_LABELS.filter(([n]) => n in hs || n in as).map(([n, label]) => ({
    label,
    home: hs[n] ?? "-",
    away: as[n] ?? "-",
  }));

  return {
    home,
    away,
    status: sum.header?.competitions?.[0]?.status?.type?.description ?? "",
    venue: sum.gameInfo?.venue?.fullName ?? null,
    timeline,
    lineups,
    stats,
  };
}

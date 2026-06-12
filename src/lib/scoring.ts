import type { StandingRow, Team } from "./types";

// Reglas de puntaje pedidas:
//   - Resultado exacto: 4 puntos
//   - Acierto de signo (gana/empata/pierde): 2 puntos
//   - Si no, 0
export function predictionPoints(
  predHome: number,
  predAway: number,
  realHome: number,
  realAway: number
): number {
  if (predHome === realHome && predAway === realAway) return 4;
  if (Math.sign(predHome - predAway) === Math.sign(realHome - realAway)) return 2;
  return 0;
}

type ResultLike = {
  home_team_id: number | null;
  away_team_id: number | null;
  home_score: number | null;
  away_score: number | null;
};

// Tabla de posiciones a partir de una lista de resultados (reales o pronosticados).
// Solo computa partidos con ambos goles cargados.
export function computeStandings(teams: Team[], results: ResultLike[]): StandingRow[] {
  const table = new Map<number, StandingRow>();
  for (const t of teams) {
    table.set(t.id, {
      teamId: t.id,
      name: t.name,
      flag: t.flag,
      code: t.code,
      pj: 0, g: 0, e: 0, p: 0, gf: 0, gc: 0, dg: 0, pts: 0,
    });
  }

  for (const r of results) {
    if (
      r.home_team_id == null || r.away_team_id == null ||
      r.home_score == null || r.away_score == null
    ) continue;
    const home = table.get(r.home_team_id);
    const away = table.get(r.away_team_id);
    if (!home || !away) continue;

    home.pj++; away.pj++;
    home.gf += r.home_score; home.gc += r.away_score;
    away.gf += r.away_score; away.gc += r.home_score;

    if (r.home_score > r.away_score) {
      home.g++; home.pts += 3; away.p++;
    } else if (r.home_score < r.away_score) {
      away.g++; away.pts += 3; home.p++;
    } else {
      home.e++; away.e++; home.pts++; away.pts++;
    }
  }

  const rows = [...table.values()];
  for (const row of rows) row.dg = row.gf - row.gc;
  rows.sort(
    (a, b) =>
      b.pts - a.pts ||
      b.dg - a.dg ||
      b.gf - a.gf ||
      a.name.localeCompare(b.name)
  );
  return rows;
}

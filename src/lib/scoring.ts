import type { StandingRow, Team } from "./types";

// Reglas de puntaje:
//   - Resultado perfecto (idéntico): 10 puntos.
//   - Si no, suma aditiva:
//       · Acertar quién gana/empata/pierde (signo): +5
//       · Acertar la diferencia de gol exacta (con signo): +2
//       · Acertar los goles exactos del local: +1
//       · Acertar los goles exactos del visitante: +1
// Valores posibles: 0, 1, 5, 6, 7, 10.
export function predictionPoints(
  predHome: number,
  predAway: number,
  realHome: number,
  realAway: number
): number {
  if (predHome === realHome && predAway === realAway) return 10; // resultado perfecto
  let pts = 0;
  if (Math.sign(predHome - predAway) === Math.sign(realHome - realAway)) pts += 5;
  if (predHome - predAway === realHome - realAway) pts += 2; // diferencia de gol exacta
  if (predHome === realHome) pts += 1;
  if (predAway === realAway) pts += 1;
  return pts;
}

type ResultLike = {
  home_team_id: number | null;
  away_team_id: number | null;
  home_score: number | null;
  away_score: number | null;
};

// Estadísticas "head-to-head" (solo partidos entre los equipos del conjunto `ids`).
function h2hStats(ids: Set<number>, results: ResultLike[]) {
  const m = new Map<number, { pts: number; dg: number; gf: number }>();
  for (const id of ids) m.set(id, { pts: 0, dg: 0, gf: 0 });
  for (const r of results) {
    if (r.home_team_id == null || r.away_team_id == null || r.home_score == null || r.away_score == null) continue;
    if (!ids.has(r.home_team_id) || !ids.has(r.away_team_id)) continue;
    const h = m.get(r.home_team_id)!;
    const a = m.get(r.away_team_id)!;
    h.gf += r.home_score; a.gf += r.away_score;
    h.dg += r.home_score - r.away_score; a.dg += r.away_score - r.home_score;
    if (r.home_score > r.away_score) h.pts += 3;
    else if (r.home_score < r.away_score) a.pts += 3;
    else { h.pts++; a.pts++; }
  }
  return m;
}

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

  // Orden: puntos → entre los empatados, primero el head-to-head (pts, dg, gf),
  // luego diferencia de gol general, goles a favor y nombre.
  rows.sort((a, b) => b.pts - a.pts);
  const out: StandingRow[] = [];
  for (let i = 0; i < rows.length; ) {
    let j = i;
    while (j < rows.length && rows[j].pts === rows[i].pts) j++;
    const group = rows.slice(i, j);
    if (group.length > 1) {
      const ids = new Set(group.map((g) => g.teamId));
      const h = h2hStats(ids, results);
      group.sort((a, b) => {
        const ha = h.get(a.teamId)!;
        const hb = h.get(b.teamId)!;
        return (
          hb.pts - ha.pts ||
          hb.dg - ha.dg ||
          hb.gf - ha.gf ||
          b.dg - a.dg ||
          b.gf - a.gf ||
          a.name.localeCompare(b.name)
        );
      });
    }
    out.push(...group);
    i = j;
  }
  return out;
}

type ClinchMatch = {
  home_team_id: number | null;
  away_team_id: number | null;
  home_score: number | null;
  away_score: number | null;
  status: string;
};

// Equipos que YA tienen asegurado el top-2 del grupo (clasifican sí o sí),
// pase lo que pase en los partidos que faltan. Cálculo conservador por puntos.
export function clinchedTop2(teams: Team[], matches: ClinchMatch[]): Set<number> {
  const ids = teams.map((t) => t.id);
  const base = new Map(ids.map((id) => [id, 0]));
  const remaining: [number, number][] = [];

  for (const m of matches) {
    if (m.home_team_id == null || m.away_team_id == null) continue;
    if (m.status === "finished" && m.home_score != null && m.away_score != null) {
      if (m.home_score > m.away_score) base.set(m.home_team_id, base.get(m.home_team_id)! + 3);
      else if (m.home_score < m.away_score) base.set(m.away_team_id, base.get(m.away_team_id)! + 3);
      else {
        base.set(m.home_team_id, base.get(m.home_team_id)! + 1);
        base.set(m.away_team_id, base.get(m.away_team_id)! + 1);
      }
    } else {
      remaining.push([m.home_team_id, m.away_team_id]);
    }
  }

  // Grupo terminado: clasifican los 2 primeros reales (con el desempate correcto).
  if (remaining.length === 0) {
    const st = computeStandings(teams, matches);
    return new Set(st.slice(0, 2).map((r) => r.teamId));
  }

  // Probar TODAS las combinaciones posibles de los partidos que faltan (3^R).
  const clinched = new Set(ids);
  const total = 3 ** remaining.length;
  for (let mask = 0; mask < total && clinched.size > 0; mask++) {
    const pts = new Map(base);
    let x = mask;
    for (const [h, a] of remaining) {
      const o = x % 3;
      x = (x - o) / 3;
      if (o === 0) pts.set(h, pts.get(h)! + 3);
      else if (o === 1) {
        pts.set(h, pts.get(h)! + 1);
        pts.set(a, pts.get(a)! + 1);
      } else pts.set(a, pts.get(a)! + 3);
    }
    for (const id of [...clinched]) {
      const p = pts.get(id)!;
      let geq = 0;
      for (const oid of ids) if (oid !== id && pts.get(oid)! >= p) geq++;
      if (geq > 1) clinched.delete(id); // podría quedar 3º o peor en algún escenario
    }
  }
  return clinched;
}

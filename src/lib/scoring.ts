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

// Puntos EXTRA en eliminatorias que se definieron por PENALES (empate en la cancha + un
// equipo que avanza). Se suman a los puntos normales del marcador:
//   - Si pronosticó un GANADOR (no empate) y ese equipo es el que avanza: +5
//     (acertó quién pasa, aunque el partido haya terminado empatado y a penales).
//   - Si pronosticó EMPATE y eligió bien quién pasa en los penales: +3.
// En partidos definidos en los 90'/120' (sin penales) esto no aplica: el +5 por acertar
// quién gana ya lo da el puntaje normal del marcador.
export function knockoutExtra(p: {
  predHome: number;
  predAway: number;
  predPenWinner: number | null;
  realHome: number;
  realAway: number;
  winnerTeamId: number | null;
  homeTeamId: number | null;
  awayTeamId: number | null;
}): number {
  if (p.realHome !== p.realAway || p.winnerTeamId == null) return 0; // no se definió por penales
  if (p.predHome === p.predAway) {
    return p.predPenWinner != null && p.predPenWinner === p.winnerTeamId ? 3 : 0;
  }
  const predWinner = p.predHome > p.predAway ? p.homeTeamId : p.awayTeamId;
  return predWinner != null && predWinner === p.winnerTeamId ? 5 : 0;
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

type WDL = "H" | "D" | "A";

// Equipo que YA tiene asegurado el 1º puesto del grupo, pase lo que pase en lo que falta.
// Considera el desempate por head-to-head (si queda empatado en la cima, gana 1º si le
// ganó en la cancha a todos los que lo igualan).
export function clinchedFirst(teams: Team[], matches: ClinchMatch[]): Set<number> {
  const ids = teams.map((t) => t.id);
  const base = new Map(ids.map((id) => [id, 0]));
  const finished: { h: number; a: number; res: WDL }[] = [];
  const remaining: [number, number][] = [];

  for (const m of matches) {
    if (m.home_team_id == null || m.away_team_id == null) continue;
    if (m.status === "finished" && m.home_score != null && m.away_score != null) {
      const res: WDL = m.home_score > m.away_score ? "H" : m.home_score < m.away_score ? "A" : "D";
      finished.push({ h: m.home_team_id, a: m.away_team_id, res });
      if (res === "H") base.set(m.home_team_id, base.get(m.home_team_id)! + 3);
      else if (res === "A") base.set(m.away_team_id, base.get(m.away_team_id)! + 3);
      else {
        base.set(m.home_team_id, base.get(m.home_team_id)! + 1);
        base.set(m.away_team_id, base.get(m.away_team_id)! + 1);
      }
    } else {
      remaining.push([m.home_team_id, m.away_team_id]);
    }
  }

  // Grupo terminado: 1º es el real (con el desempate correcto).
  if (remaining.length === 0) {
    const st = computeStandings(teams, matches);
    return st.length ? new Set([st[0].teamId]) : new Set();
  }

  // Probar TODAS las combinaciones de los partidos que faltan (3^R).
  const clinched = new Set(ids);
  const total = 3 ** remaining.length;
  for (let mask = 0; mask < total && clinched.size > 0; mask++) {
    const pts = new Map(base);
    const res = finished.slice();
    let x = mask;
    for (const [h, a] of remaining) {
      const o = x % 3;
      x = (x - o) / 3;
      const r: WDL = o === 0 ? "H" : o === 1 ? "D" : "A";
      res.push({ h, a, res: r });
      if (r === "H") pts.set(h, pts.get(h)! + 3);
      else if (r === "D") {
        pts.set(h, pts.get(h)! + 1);
        pts.set(a, pts.get(a)! + 1);
      } else pts.set(a, pts.get(a)! + 3);
    }

    const maxP = Math.max(...pts.values());
    for (const id of [...clinched]) {
      if (pts.get(id)! < maxP) {
        clinched.delete(id);
        continue;
      }
      const top = ids.filter((i) => pts.get(i)! === maxP);
      if (top.length === 1) continue; // solo en la cima → 1º seguro
      // Empate en la cima: gana 1º quien tenga MÁS puntos head-to-head entre los empatados.
      const topSet = new Set(top);
      const h2h = new Map(top.map((i) => [i, 0]));
      for (const r of res) {
        if (!topSet.has(r.h) || !topSet.has(r.a)) continue;
        if (r.res === "H") h2h.set(r.h, h2h.get(r.h)! + 3);
        else if (r.res === "A") h2h.set(r.a, h2h.get(r.a)! + 3);
        else {
          h2h.set(r.h, h2h.get(r.h)! + 1);
          h2h.set(r.a, h2h.get(r.a)! + 1);
        }
      }
      const maxH = Math.max(...h2h.values());
      // Solo 1º seguro si gana el head-to-head de forma estricta (si no, la dif. de gol podría sacarlo).
      if (h2h.get(id)! < maxH || top.filter((i) => h2h.get(i)! === maxH).length > 1) {
        clinched.delete(id);
      }
    }
  }
  return clinched;
}

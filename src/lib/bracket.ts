import { computeStandings } from "./scoring";
import type { Match, StandingRow, Team } from "./types";

// ---- Estructura oficial del cuadro del Mundial 2026 (48 equipos) ----
// Cada llave tiene dos "ranuras" que se resuelven a un equipo cuando hay datos:
//   W = ganador de grupo, R = segundo de grupo, T = mejor 3º (de los grupos permitidos),
//   MW = ganador de otra llave, ML = perdedor de otra llave (para el 3º puesto).

export type Slot =
  | { t: "W"; g: string }
  | { t: "R"; g: string }
  | { t: "T"; g: string[] }
  | { t: "MW"; m: string }
  | { t: "ML"; m: string };

export type KoDef = {
  code: string;
  stage: "r32" | "r16" | "qf" | "sf" | "third" | "final";
  round: string;
  home: Slot;
  away: Slot;
};

const W = (g: string): Slot => ({ t: "W", g });
const R = (g: string): Slot => ({ t: "R", g });
const T = (...g: string[]): Slot => ({ t: "T", g });
const MW = (m: string): Slot => ({ t: "MW", m });
const ML = (m: string): Slot => ({ t: "ML", m });

export const KO_DEFS: KoDef[] = [
  // 16avos de final (Round of 32)
  { code: "M73", stage: "r32", round: "16avos de final", home: R("A"), away: R("B") },
  { code: "M74", stage: "r32", round: "16avos de final", home: W("E"), away: T("A", "B", "C", "D", "F") },
  { code: "M75", stage: "r32", round: "16avos de final", home: W("F"), away: R("C") },
  { code: "M76", stage: "r32", round: "16avos de final", home: W("C"), away: R("F") },
  { code: "M77", stage: "r32", round: "16avos de final", home: W("I"), away: T("C", "D", "F", "G", "H") },
  { code: "M78", stage: "r32", round: "16avos de final", home: R("E"), away: R("I") },
  { code: "M79", stage: "r32", round: "16avos de final", home: W("A"), away: T("C", "E", "F", "H", "I") },
  { code: "M80", stage: "r32", round: "16avos de final", home: W("L"), away: T("E", "H", "I", "J", "K") },
  { code: "M81", stage: "r32", round: "16avos de final", home: W("D"), away: T("B", "E", "F", "I", "J") },
  { code: "M82", stage: "r32", round: "16avos de final", home: W("G"), away: T("A", "E", "H", "I", "J") },
  { code: "M83", stage: "r32", round: "16avos de final", home: R("K"), away: R("L") },
  { code: "M84", stage: "r32", round: "16avos de final", home: W("H"), away: R("J") },
  { code: "M85", stage: "r32", round: "16avos de final", home: W("B"), away: T("E", "F", "G", "I", "J") },
  { code: "M86", stage: "r32", round: "16avos de final", home: W("J"), away: R("H") },
  { code: "M87", stage: "r32", round: "16avos de final", home: W("K"), away: T("D", "E", "I", "J", "L") },
  { code: "M88", stage: "r32", round: "16avos de final", home: R("D"), away: R("G") },
  // Octavos de final (Round of 16)
  { code: "M89", stage: "r16", round: "Octavos de final", home: MW("M74"), away: MW("M77") },
  { code: "M90", stage: "r16", round: "Octavos de final", home: MW("M73"), away: MW("M75") },
  { code: "M91", stage: "r16", round: "Octavos de final", home: MW("M76"), away: MW("M78") },
  { code: "M92", stage: "r16", round: "Octavos de final", home: MW("M79"), away: MW("M80") },
  { code: "M93", stage: "r16", round: "Octavos de final", home: MW("M83"), away: MW("M84") },
  { code: "M94", stage: "r16", round: "Octavos de final", home: MW("M81"), away: MW("M82") },
  { code: "M95", stage: "r16", round: "Octavos de final", home: MW("M86"), away: MW("M88") },
  { code: "M96", stage: "r16", round: "Octavos de final", home: MW("M85"), away: MW("M87") },
  // Cuartos de final
  { code: "M97", stage: "qf", round: "Cuartos de final", home: MW("M89"), away: MW("M90") },
  { code: "M98", stage: "qf", round: "Cuartos de final", home: MW("M93"), away: MW("M94") },
  { code: "M99", stage: "qf", round: "Cuartos de final", home: MW("M91"), away: MW("M92") },
  { code: "M100", stage: "qf", round: "Cuartos de final", home: MW("M95"), away: MW("M96") },
  // Semifinales
  { code: "M101", stage: "sf", round: "Semifinal", home: MW("M97"), away: MW("M98") },
  { code: "M102", stage: "sf", round: "Semifinal", home: MW("M99"), away: MW("M100") },
  // Tercer puesto y Final
  { code: "M103", stage: "third", round: "Tercer puesto", home: ML("M101"), away: ML("M102") },
  { code: "M104", stage: "final", round: "Final", home: MW("M101"), away: MW("M102") },
];

export function slotLabel(slot: Slot): string {
  switch (slot.t) {
    case "W": return `1º ${slot.g}`;
    case "R": return `2º ${slot.g}`;
    case "T": return `Mejor 3º (${slot.g.join("/")})`;
    case "MW": return `Ganador ${slot.m.replace("M", "#")}`;
    case "ML": return `Perdedor ${slot.m.replace("M", "#")}`;
  }
}

export type BracketSlotResult = {
  code: string;
  homeTeamId: number | null;
  awayTeamId: number | null;
  homeLabel: string;
  awayLabel: string;
};

// Asigna los 8 mejores terceros a las 8 ranuras "T" respetando los grupos permitidos
// (matching bipartito por backtracking, determinístico).
function assignThirds(qualifiedGroups: string[]): Map<string, string> | null {
  const slots = KO_DEFS.filter((d) => d.away.t === "T").map((d) => ({
    code: d.code,
    allowed: (d.away as { t: "T"; g: string[] }).g,
  }));
  const result = new Map<string, string>();
  const used = new Set<string>();

  function solve(i: number): boolean {
    if (i === slots.length) return true;
    const slot = slots[i];
    for (const g of qualifiedGroups) {
      if (used.has(g) || !slot.allowed.includes(g)) continue;
      used.add(g);
      result.set(slot.code, g);
      if (solve(i + 1)) return true;
      used.delete(g);
      result.delete(slot.code);
    }
    return false;
  }
  return solve(0) ? result : null;
}

// Resuelve TODO el cuadro a partir de los equipos y los partidos (con resultados reales).
export function resolveBracket(
  teams: Team[],
  matches: Match[]
): BracketSlotResult[] {
  const groupLetters = [...new Set(teams.map((t) => t.group_letter))].sort();
  const groupMatches = matches.filter((m) => m.stage === "group");

  // Tabla (proyección) de cada grupo con los resultados de hoy.
  const standings = new Map<string, StandingRow[]>();
  for (const g of groupLetters) {
    const gTeams = teams.filter((t) => t.group_letter === g);
    const gMatches = groupMatches.filter((m) => m.group_letter === g);
    standings.set(g, computeStandings(gTeams, gMatches));
  }

  // Proyección como Google: 1º, 2º y mejores 8 terceros según las posiciones actuales.
  // (Cuando un grupo ya terminó, su tabla actual ES la definitiva.)
  const winnerG = (g: string) => standings.get(g)![0]?.teamId ?? null;
  const runnerG = (g: string) => standings.get(g)![1]?.teamId ?? null;
  const thirdG = (g: string) => standings.get(g)![2];

  let thirdAssign = new Map<string, string>(); // codeLlave -> letra de grupo
  {
    const thirds = groupLetters
      .map((g) => ({ g, row: thirdG(g) }))
      .filter((x) => x.row)
      .sort(
        (a, b) =>
          b.row.pts - a.row.pts ||
          b.row.dg - a.row.dg ||
          b.row.gf - a.row.gf ||
          a.g.localeCompare(b.g)
      );
    const top8 = thirds.slice(0, 8).map((x) => x.g);
    thirdAssign = assignThirds(top8) ?? new Map();
  }

  const thirdTeamForCode = (code: string): number | null => {
    const g = thirdAssign.get(code);
    return g ? thirdG(g)?.teamId ?? null : null;
  };

  // Ganador / perdedor de cada llave ya resuelta.
  const matchByCode = new Map(matches.filter((m) => m.code).map((m) => [m.code!, m]));
  const koWinner = new Map<string, number | null>();
  const koLoser = new Map<string, number | null>();

  function resultOf(code: string, homeId: number | null, awayId: number | null) {
    const m = matchByCode.get(code);
    if (!m || homeId == null || awayId == null || m.home_score == null || m.away_score == null) {
      return { win: null as number | null, lose: null as number | null };
    }
    if (m.home_score > m.away_score) return { win: homeId, lose: awayId };
    if (m.away_score > m.home_score) return { win: awayId, lose: homeId };
    // Empate -> se define por el ganador marcado (penales).
    if (m.winner_team_id === homeId) return { win: homeId, lose: awayId };
    if (m.winner_team_id === awayId) return { win: awayId, lose: homeId };
    return { win: null, lose: null };
  }

  function resolveSlot(slot: Slot): { teamId: number | null; label: string } {
    let teamId: number | null = null;
    switch (slot.t) {
      case "W": teamId = winnerG(slot.g); break;
      case "R": teamId = runnerG(slot.g); break;
      case "T": teamId = null; break; // se setea por código abajo
      case "MW": teamId = koWinner.get(slot.m) ?? null; break;
      case "ML": teamId = koLoser.get(slot.m) ?? null; break;
    }
    return { teamId, label: slotLabel(slot) };
  }

  const out: BracketSlotResult[] = [];
  for (const def of KO_DEFS) {
    const home = resolveSlot(def.home);
    const away = resolveSlot(def.away);
    if (def.home.t === "T") home.teamId = thirdTeamForCode(def.code);
    if (def.away.t === "T") away.teamId = thirdTeamForCode(def.code);

    out.push({
      code: def.code,
      homeTeamId: home.teamId,
      awayTeamId: away.teamId,
      homeLabel: home.label,
      awayLabel: away.label,
    });

    const { win, lose } = resultOf(def.code, home.teamId, away.teamId);
    koWinner.set(def.code, win);
    koLoser.set(def.code, lose);
  }
  return out;
}

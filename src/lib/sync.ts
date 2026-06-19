import "server-only";
import { query } from "./db";
import { setMatchResult, recomputeBracket } from "./data";

// Sincroniza resultados reales desde football-data.org (plan gratuito incluye el Mundial, código "WC").
// Mapea por pareja de equipos, así no depende de que el orden local/real coincida.

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD") // separa los acentos; el siguiente replace los elimina junto al resto
    .replace(/[^a-z0-9 ]/g, "")
    .replace(/\s+/g, " ")
    .trim();

// Alias en inglés (variantes que puede devolver la API) -> código local del equipo.
const ALIASES: Record<string, string[]> = {
  MX: ["mexico"], ZA: ["south africa"], KR: ["south korea", "korea republic", "korea"],
  CZ: ["czechia", "czech republic"], CA: ["canada"], QA: ["qatar"], CH: ["switzerland"],
  BA: ["bosnia and herzegovina", "bosnia herzegovina", "bosnia-herzegovina"], BR: ["brazil"], HT: ["haiti"],
  SCT: ["scotland"], MA: ["morocco"], US: ["united states", "usa", "united states of america"],
  PY: ["paraguay"], AU: ["australia"], TR: ["turkiye", "turkey"], DE: ["germany"],
  CI: ["cote divoire", "ivory coast", "cote d ivoire"], EC: ["ecuador"], CW: ["curacao"],
  NL: ["netherlands", "holland"], JP: ["japan"], TN: ["tunisia"], SE: ["sweden"],
  BE: ["belgium"], EG: ["egypt"], IR: ["iran", "ir iran"], NZ: ["new zealand"],
  ES: ["spain"], CV: ["cape verde", "cabo verde", "cape verde islands"], SA: ["saudi arabia"], UY: ["uruguay"],
  FR: ["france"], SN: ["senegal"], IQ: ["iraq"], NO: ["norway"], AR: ["argentina"],
  DZ: ["algeria"], AT: ["austria"], JO: ["jordan"], PT: ["portugal"],
  CD: ["dr congo", "congo dr", "democratic republic of congo", "congo"], UZ: ["uzbekistan"],
  CO: ["colombia"], ENG: ["england"], HR: ["croatia"], GH: ["ghana"], PA: ["panama"],
};

const aliasToCode = new Map<string, string>();
for (const [code, names] of Object.entries(ALIASES)) {
  for (const n of names) aliasToCode.set(norm(n), code);
}

// Mapa por TLA (código de 3 letras de football-data) -> código local. Es lo más estable.
const TLA_TO_CODE: Record<string, string> = {
  ALG: "DZ", ARG: "AR", AUS: "AU", AUT: "AT", BEL: "BE", BIH: "BA", BRA: "BR", CAN: "CA",
  CPV: "CV", COL: "CO", COD: "CD", CRO: "HR", CUW: "CW", CZE: "CZ", ECU: "EC", EGY: "EG",
  ENG: "ENG", FRA: "FR", GER: "DE", GHA: "GH", HAI: "HT", IRN: "IR", IRQ: "IQ", CIV: "CI",
  JPN: "JP", JOR: "JO", MEX: "MX", MAR: "MA", NED: "NL", NZL: "NZ", NOR: "NO", PAN: "PA",
  PAR: "PY", POR: "PT", QAT: "QA", KSA: "SA", SCO: "SCT", SEN: "SN", RSA: "ZA", KOR: "KR",
  ESP: "ES", SWE: "SE", SUI: "CH", TUN: "TN", TUR: "TR", USA: "US", URY: "UY", UZB: "UZ",
};

function codeFor(apiName: string, tla?: string): string | null {
  if (tla && TLA_TO_CODE[tla]) return TLA_TO_CODE[tla];
  return aliasToCode.get(norm(apiName)) ?? null;
}

type ApiMatch = {
  id: number;
  utcDate: string;
  status: string;
  homeTeam: { name: string; tla?: string };
  awayTeam: { name: string; tla?: string };
  score: {
    winner?: "HOME_TEAM" | "AWAY_TEAM" | "DRAW" | null;
    fullTime: { home: number | null; away: number | null };
  };
};

export type SyncResult = {
  ok: boolean;
  fetched: number;
  resultsApplied: number;
  datesUpdated: number;
  unmapped: number;
  error?: string;
};

export async function syncResults(): Promise<SyncResult> {
  const token = process.env.FOOTBALL_DATA_API_KEY;
  if (!token) {
    return { ok: false, fetched: 0, resultsApplied: 0, datesUpdated: 0, unmapped: 0, error: "Falta FOOTBALL_DATA_API_KEY." };
  }

  let data: { matches?: ApiMatch[] };
  try {
    const res = await fetch("https://api.football-data.org/v4/competitions/WC/matches", {
      headers: { "X-Auth-Token": token },
      cache: "no-store",
    });
    if (!res.ok) {
      return { ok: false, fetched: 0, resultsApplied: 0, datesUpdated: 0, unmapped: 0, error: `API respondió ${res.status}.` };
    }
    data = await res.json();
  } catch (e) {
    return { ok: false, fetched: 0, resultsApplied: 0, datesUpdated: 0, unmapped: 0, error: `No se pudo conectar a la API: ${(e as Error).message}` };
  }

  const apiMatches = data.matches ?? [];

  // Índice de NUESTROS partidos por pareja de códigos (no finalizados, con equipos definidos).
  const ours = await query<
    {
      id: number; home_code: string; away_code: string;
      home_team_id: number; away_team_id: number; status: string;
      kickoff: string | null; external_id: string | null;
      home_score: number | null; away_score: number | null;
    }[]
  >(
    `SELECT m.id, th.code AS home_code, ta.code AS away_code,
            m.home_team_id, m.away_team_id, m.status,
            DATE_FORMAT(m.kickoff, '%Y-%m-%d %H:%i:%s') AS kickoff,
            m.external_id, m.home_score, m.away_score
     FROM matches m
     JOIN teams th ON th.id = m.home_team_id
     JOIN teams ta ON ta.id = m.away_team_id`
  );
  const pairKey = (a: string, b: string) => [a, b].sort().join("|");
  const byPair = new Map<string, typeof ours>();
  for (const m of ours) {
    const k = pairKey(m.home_code, m.away_code);
    (byPair.get(k) ?? byPair.set(k, []).get(k)!).push(m);
  }

  let resultsApplied = 0, datesUpdated = 0, unmapped = 0;

  for (const am of apiMatches) {
    const hc = codeFor(am.homeTeam?.name ?? "", am.homeTeam?.tla);
    const ac = codeFor(am.awayTeam?.name ?? "", am.awayTeam?.tla);
    if (!hc || !ac) { unmapped++; continue; }

    const candidates = byPair.get(pairKey(hc, ac));
    if (!candidates || candidates.length === 0) { unmapped++; continue; }
    const target = candidates.find((c) => c.status !== "finished") ?? candidates[0];

    // Actualizar fecha real + id externo SOLO si cambió (evita ~70 escrituras por corrida).
    const kickoff = am.utcDate ? am.utcDate.replace("T", " ").replace("Z", "").slice(0, 19) : null;
    const extId = String(am.id);
    if (kickoff !== target.kickoff || extId !== (target.external_id ?? "")) {
      await query("UPDATE matches SET kickoff = ?, external_id = ? WHERE id = ?", [kickoff, extId, target.id]);
      datesUpdated++;
    }

    // Cargar resultado si el partido terminó Y el resultado es nuevo o cambió.
    const ft = am.score?.fullTime;
    if (am.status === "FINISHED" && ft?.home != null && ft?.away != null) {
      // Reorientar los goles según quién es local en nuestro registro.
      const homeIsApiHome = target.home_code === hc;
      const homeScore = homeIsApiHome ? ft.home : ft.away;
      const awayScore = homeIsApiHome ? ft.away : ft.home;
      const changed =
        target.status !== "finished" ||
        target.home_score !== homeScore ||
        target.away_score !== awayScore;
      if (changed) {
        // Ganador (para eliminatorias definidas por penales).
        let winnerTeamId: number | null = null;
        if (am.score?.winner === "HOME_TEAM") winnerTeamId = homeIsApiHome ? target.home_team_id : target.away_team_id;
        else if (am.score?.winner === "AWAY_TEAM") winnerTeamId = homeIsApiHome ? target.away_team_id : target.home_team_id;
        await setMatchResult(target.id, homeScore, awayScore, winnerTeamId, false);
        resultsApplied++;
      }
    }
  }

  // Recalcular el cuadro una sola vez al final (eficiencia).
  if (resultsApplied > 0) await recomputeBracket();

  return { ok: true, fetched: apiMatches.length, resultsApplied, datesUpdated, unmapped };
}

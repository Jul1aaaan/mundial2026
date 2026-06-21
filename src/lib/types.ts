export type Team = {
  id: number;
  name: string;
  code: string;
  flag: string;
  group_letter: string;
};

export type Stage = "group" | "r32" | "r16" | "qf" | "sf" | "third" | "final";

export type Goal = {
  min: string;
  code: string; // código del equipo que metió
  scorer: string;
  assist: string | null;
  pen: boolean;
  og: boolean;
};

export type Match = {
  id: number;
  stage: Stage;
  group_letter: string | null;
  matchday: number | null;
  round_name: string | null;
  home_team_id: number | null;
  away_team_id: number | null;
  home_label: string | null;
  away_label: string | null;
  kickoff: string | null;
  home_score: number | null;
  away_score: number | null;
  status: "scheduled" | "finished";
  external_id: string | null;
  ord: number;
  code: string | null; // identificador estable de la llave (M73..M104)
  winner_team_id: number | null; // ganador en caso de empate (penales) en eliminatorias
  espn_id: string | null; // id del partido en ESPN (para el detalle)
  goals: Goal[]; // goles del partido (de ESPN)
};

// Partido enriquecido con datos de equipos y el pronóstico del usuario (para la UI).
export type MatchView = Match & {
  home_team: Team | null;
  away_team: Team | null;
  pred_home: number | null;
  pred_away: number | null;
  points: number | null;
};

// ---- Detalle de partido (datos de ESPN) ----
export type TimelineItem = {
  min: string;
  code: string | null;
  kind: "goal" | "yellow" | "red" | "sub";
  main: string;
  sub: string | null;
};
export type LineupPlayer = { num: string; name: string; pos: string; posName: string };
export type Lineup = {
  code: string | null;
  name: string;
  formation: string | null;
  starters: LineupPlayer[];
  bench: { num: string; name: string }[];
};
export type EspnDetail = {
  home: { name: string; code: string | null; score: number | null };
  away: { name: string; code: string | null; score: number | null };
  status: string;
  venue: string | null;
  timeline: TimelineItem[];
  lineups: Lineup[];
  stats: { label: string; home: string; away: string }[];
};

export type StandingRow = {
  teamId: number;
  name: string;
  flag: string;
  code: string;
  pj: number;
  g: number;
  e: number;
  p: number;
  gf: number;
  gc: number;
  dg: number;
  pts: number;
};

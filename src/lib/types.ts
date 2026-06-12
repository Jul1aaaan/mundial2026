export type Team = {
  id: number;
  name: string;
  code: string;
  flag: string;
  group_letter: string;
};

export type Stage = "group" | "r32" | "r16" | "qf" | "sf" | "third" | "final";

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
};

// Partido enriquecido con datos de equipos y el pronóstico del usuario (para la UI).
export type MatchView = Match & {
  home_team: Team | null;
  away_team: Team | null;
  pred_home: number | null;
  pred_away: number | null;
  points: number | null;
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

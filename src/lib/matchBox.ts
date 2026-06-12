import type { CSSProperties } from "react";
import type { MatchView } from "./types";

// Estilos de los recuadros de resultado según acierto.
export const BOX_STYLES: Record<string, CSSProperties> = {
  exact: { borderColor: "#10b981", background: "#ecfdf5", color: "#065f46" },
  outcome: { borderColor: "#60a5fa", background: "#eff6ff", color: "#1e40af" },
  wrong: { borderColor: "#fca5a5", background: "#fef2f2", color: "#b91c1c" },
  real: { borderColor: "rgba(15,40,30,0.18)", background: "#eef2f0", color: "#0f1f1a", opacity: 1 },
};

export type BoxVariant = "play" | "scored" | "real";

// Decide qué se muestra en los recuadros de un partido:
//  - "scored": terminado y lo pronosticaste -> tu pronóstico pintado de acierto/error
//  - "real":   terminado y NO lo pronosticaste -> el resultado real
//  - "play":   editable / pendiente
export function matchBoxState(
  m: MatchView,
  homeValue: string,
  awayValue: string,
  locked: boolean
) {
  const finished = m.status === "finished" && m.home_score != null && m.away_score != null;
  const hasPred = homeValue !== "" && awayValue !== "";
  const noTeams = !m.home_team || !m.away_team;

  let variant: BoxVariant = "play";
  let displayHome = homeValue;
  let displayAway = awayValue;
  let styleKey: string | undefined;

  if (finished && hasPred) {
    variant = "scored";
    styleKey = m.points === 4 ? "exact" : m.points === 2 ? "outcome" : "wrong";
  } else if (finished && !hasPred) {
    variant = "real";
    displayHome = String(m.home_score);
    displayAway = String(m.away_score);
    styleKey = "real";
  }

  return {
    finished,
    variant,
    displayHome,
    displayAway,
    boxStyle: styleKey ? BOX_STYLES[styleKey] : undefined,
    readOnly: finished,
    disabled: !finished && (locked || noTeams),
  };
}

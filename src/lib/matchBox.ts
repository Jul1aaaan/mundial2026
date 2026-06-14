import type { CSSProperties } from "react";
import type { MatchView } from "./types";

// Estilos de los recuadros de resultado según acierto.
export const BOX_STYLES: Record<string, CSSProperties> = {
  exact: { borderColor: "#10b981", background: "#ecfdf5", color: "#065f46" }, // 4 o 3 pts (verde)
  outcome: { borderColor: "#60a5fa", background: "#eff6ff", color: "#1e40af" }, // 2 pts (azul)
  partial: { borderColor: "#fbbf24", background: "#fffbeb", color: "#92400e" }, // 1 pt (ámbar)
  wrong: { borderColor: "#fca5a5", background: "#fef2f2", color: "#b91c1c" }, // 0 pts (rojo)
  real: { borderColor: "rgba(15,40,30,0.18)", background: "#eef2f0", color: "#0f1f1a", opacity: 1 },
};

// Color del recuadro/etiqueta según los puntos obtenidos (0 a 4).
export function styleKeyForPoints(points: number | null): string {
  if (points == null) return "wrong";
  if (points >= 3) return "exact";
  if (points === 2) return "outcome";
  if (points === 1) return "partial";
  return "wrong";
}

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
    styleKey = styleKeyForPoints(m.points);
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

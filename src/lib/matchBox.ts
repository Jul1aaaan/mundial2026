import type { CSSProperties } from "react";
import type { MatchView } from "./types";

// Estilos de los recuadros de resultado según acierto.
export const BOX_STYLES: Record<string, CSSProperties> = {
  perfect: { borderColor: "#059669", background: "#d1fae5", color: "#064e3b" }, // 10 pts
  exact: { borderColor: "#10b981", background: "#ecfdf5", color: "#065f46" }, // 6-7 pts (verde)
  outcome: { borderColor: "#60a5fa", background: "#eff6ff", color: "#1e40af" }, // 5 pts (azul)
  partial: { borderColor: "#fbbf24", background: "#fffbeb", color: "#92400e" }, // 1 pt (ámbar)
  wrong: { borderColor: "#fca5a5", background: "#fef2f2", color: "#b91c1c" }, // 0 pts (rojo)
  real: { borderColor: "rgba(15,40,30,0.18)", background: "#eef2f0", color: "#0f1f1a", opacity: 1 },
};

// Color del recuadro según los puntos obtenidos. Valores posibles: 0,1,5,6,7,10.
export function styleKeyForPoints(points: number | null): string {
  if (points == null) return "wrong";
  if (points >= 10) return "perfect";
  if (points >= 6) return "exact"; // 6, 7
  if (points >= 2) return "outcome"; // 5
  if (points >= 1) return "partial"; // 1
  return "wrong"; // 0
}

// Clases del badge "+N pts" según los puntos.
export function pointsBadgeClass(points: number): string {
  if (points >= 10) return "bg-emerald-200 text-emerald-900";
  if (points >= 6) return "bg-emerald-100 text-emerald-700";
  if (points >= 2) return "bg-blue-100 text-blue-700"; // 5
  if (points >= 1) return "bg-amber-100 text-amber-700"; // 1
  return "bg-red-100 text-red-600"; // 0
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

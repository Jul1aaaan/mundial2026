import type { Match } from "./types";
import { parseKickoffMs } from "./format";

// Versión usable en el cliente (sin "server-only"): un partido se cierra
// cuando ya empezó o ya tiene resultado cargado.
export function isLockedClient(m: Pick<Match, "kickoff" | "status">): boolean {
  if (m.status === "finished") return true;
  const ms = parseKickoffMs(m.kickoff);
  if (ms == null) return false;
  return ms <= Date.now();
}

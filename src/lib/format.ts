// Las fechas guardadas se interpretan como UTC (la API y el seed las dan en UTC) y se
// muestran en hora de Argentina (UTC-3, sin horario de verano). Formateamos a mano, sin
// depender del locale del entorno, para que el servidor y el cliente generen EXACTAMENTE
// el mismo texto (evita errores de hidratación por diferencias de ICU, ej. el espacio del "p. m.").
const AR_OFFSET_MS = 3 * 60 * 60 * 1000; // UTC-3
const DIAS = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];
const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

export function parseKickoffMs(kickoff: string | Date | null): number | null {
  if (!kickoff) return null;
  // Defensivo: si alguna consulta devuelve un Date (mysql2) en vez de texto.
  if (kickoff instanceof Date) return kickoff.getTime();
  const iso = kickoff.endsWith("Z") ? kickoff : kickoff.replace(" ", "T") + "Z";
  const ms = Date.parse(iso);
  return Number.isNaN(ms) ? null : ms;
}

export function formatKickoff(kickoff: string | null): string {
  const ms = parseKickoffMs(kickoff);
  if (ms == null) return "Fecha por definir";
  const d = new Date(ms - AR_OFFSET_MS); // desplazamos a hora argentina y leemos en UTC
  const dia = DIAS[d.getUTCDay()];
  const num = d.getUTCDate();
  const mes = MESES[d.getUTCMonth()];
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mm = String(d.getUTCMinutes()).padStart(2, "0");
  return `${dia} ${num} ${mes} · ${hh}:${mm}`;
}

export const GROUP_LETTERS = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L"];

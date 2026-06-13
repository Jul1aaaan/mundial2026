"use client";
import { useEffect, useState } from "react";
import type { MatchView } from "@/lib/types";
import { parseKickoffMs, formatTimeAr, formatDateAr, arDayKey } from "@/lib/format";
import { isLockedClient } from "@/lib/clientLock";
import Flag from "./Flag";

// "Siguientes partidos": muestra los que se juegan HOY (o el próximo día con partidos)
// para que cada uno se acuerde de cargar su pronóstico.
// Se calcula en el cliente (useEffect) para evitar diferencias de fecha servidor/cliente.
export default function UpcomingMatches({ matches }: { matches: MatchView[] }) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => setNow(Date.now()), []);
  if (now == null) return null;

  const withK = matches
    .filter((m) => m.home_team && m.away_team && parseKickoffMs(m.kickoff) != null)
    .map((m) => ({ m, ms: parseKickoffMs(m.kickoff)! }))
    .sort((a, b) => a.ms - b.ms);

  const todayKey = arDayKey(now);
  let list = withK.filter((x) => arDayKey(x.ms) === todayKey);
  let title = "Partidos de hoy";
  let isToday = true;

  if (list.length === 0) {
    const future = withK.filter((x) => x.ms > now);
    if (future.length === 0) return null; // ya terminó todo
    const nextKey = arDayKey(future[0].ms);
    list = future.filter((x) => arDayKey(x.ms) === nextKey);
    title = `Próximos partidos · ${formatDateAr(list[0].m.kickoff)}`;
    isToday = false;
  }

  return (
    <div className="card card-top p-4 mb-6">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-xl">📅</span>
        <h2 className="font-extrabold text-lg">{title}</h2>
        <span className="chip chip-green">{list.length}</span>
      </div>

      <div className="grid sm:grid-cols-2 gap-2">
        {list.map(({ m }) => {
          const finished = m.status === "finished" && m.home_score != null;
          const locked = isLockedClient(m);
          const hasPred = m.pred_home != null;

          let badge = "";
          let badgeClass = "chip-gray";
          if (finished) {
            badge = `Final ${m.home_score}-${m.away_score}`;
            badgeClass = "chip-gray";
          } else if (locked) {
            badge = "🔴 En juego";
            badgeClass = "chip-blue";
          } else if (hasPred) {
            badge = "✓ Pronosticado";
            badgeClass = "chip-green";
          } else {
            badge = "⏰ ¡Falta tu pronóstico!";
            badgeClass = "chip-blue";
          }

          return (
            <div key={m.id} className="p-2.5 rounded-lg border border-line bg-[#f9fbfa]">
              <div className="flex items-center justify-between text-xs mb-1.5">
                <span className="font-bold text-muted">{formatTimeAr(m.kickoff)}</span>
                <span className={`chip ${badgeClass} !py-0.5 !px-2`}>{badge}</span>
              </div>
              <div className="flex items-center gap-2">
                <Flag code={m.home_team!.code} size={16} />
                <span className="truncate text-sm font-semibold flex-1">{m.home_team!.name}</span>
                <span className="text-[11px] text-muted px-1">vs</span>
                <span className="truncate text-sm font-semibold flex-1 text-right">{m.away_team!.name}</span>
                <Flag code={m.away_team!.code} size={16} />
              </div>
            </div>
          );
        })}
      </div>

      {isToday && (
        <p className="text-xs text-muted mt-2.5">
          ¡No te olvides de cargar tus pronósticos antes de que empiece cada partido! ⚽
        </p>
      )}
    </div>
  );
}

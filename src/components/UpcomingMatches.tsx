"use client";
import { useEffect, useState } from "react";
import type { MatchView } from "@/lib/types";
import { parseKickoffMs, formatTimeAr, arDayKey } from "@/lib/format";
import { isLockedClient } from "@/lib/clientLock";
import Flag from "./Flag";

const DAY_MS = 24 * 60 * 60 * 1000;

// "Próximos partidos": los que están EN JUEGO + los pendientes de hoy y mañana.
// (Los ya jugados quedan en la pestaña "Jugados".) Avisa fuerte si no pronosticaste.
export default function UpcomingMatches({ matches }: { matches: MatchView[] }) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => setNow(Date.now()), []);
  if (now == null) return null;

  const todayKey = arDayKey(now);
  const tomorrowKey = arDayKey(now + DAY_MS);

  const list = matches
    .filter((m) => m.home_team && m.away_team && parseKickoffMs(m.kickoff) != null)
    .map((m) => ({ m, ms: parseKickoffMs(m.kickoff)! }))
    .filter(({ m, ms }) => {
      if (m.status === "finished") return false; // los jugados no
      if (isLockedClient(m)) return true; // en juego
      const k = arDayKey(ms); // pendiente: hoy o mañana
      return k === todayKey || k === tomorrowKey;
    })
    .sort((a, b) => a.ms - b.ms);

  return (
    <div className="card card-top p-4 mb-6">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-xl">📅</span>
        <h2 className="font-extrabold text-lg">Próximos partidos</h2>
        {list.length > 0 && <span className="chip chip-green">{list.length}</span>}
      </div>

      {list.length === 0 ? (
        <p className="text-sm text-muted">No hay partidos en juego ni programados entre hoy y mañana.</p>
      ) : (
        <div className="grid sm:grid-cols-2 gap-2">
          {list.map(({ m }) => {
            const inPlay = isLockedClient(m); // ya empezó, sin resultado aún
            const hasPred = m.pred_home != null;
            const needsPred = !inPlay && !hasPred; // pendiente y sin pronóstico → advertencia

            const cardClass = needsPred
              ? "border-2 border-amber-400 bg-amber-50"
              : "border border-line bg-[#f9fbfa]";

            return (
              <div key={m.id} className={`p-2.5 rounded-lg ${cardClass}`}>
                <div className="flex items-center justify-between text-xs mb-1.5 gap-2">
                  <span className="font-bold text-muted shrink-0">{formatTimeAr(m.kickoff)}</span>
                  {inPlay && <span className="chip chip-blue !py-0.5 !px-2">🔴 En juego</span>}
                  {needsPred && (
                    <span className="chip !py-0.5 !px-2 bg-amber-400 text-amber-950 font-extrabold">
                      ⚠️ ¡Te falta pronosticar!
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <Flag code={m.home_team!.code} size={16} />
                  <span className="truncate text-sm font-semibold flex-1">{m.home_team!.name}</span>
                  <span className="text-[11px] text-muted px-1">vs</span>
                  <span className="truncate text-sm font-semibold flex-1 text-right">{m.away_team!.name}</span>
                  <Flag code={m.away_team!.code} size={16} />
                </div>

                {hasPred ? (
                  <div className="mt-1.5 text-center">
                    <span className="chip chip-green !py-0.5">
                      Tu pronóstico: <b className="ml-1">{m.pred_home}-{m.pred_away}</b>
                    </span>
                  </div>
                ) : needsPred ? (
                  <p className="mt-1.5 text-center text-xs font-semibold text-amber-700">
                    Entrá al fixture y cargá tu resultado antes de que empiece ⏱️
                  </p>
                ) : (
                  <p className="mt-1.5 text-center text-xs text-muted">No llegaste a pronosticar este 😕</p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

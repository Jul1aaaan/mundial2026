"use client";
import { useState } from "react";
import { pointsBadgeClass } from "@/lib/matchBox";

type Pred = { name: string; pred_home: number; pred_away: number; points: number | null };

// Botón "ver detalle" para un partido jugado: muestra quién pronosticó qué y cuántos
// puntos sumó, ordenado de mayor a menor.
export default function MatchDetail({ matchId }: { matchId: number }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [preds, setPreds] = useState<Pred[] | null>(null);

  async function toggle() {
    if (open) {
      setOpen(false);
      return;
    }
    setOpen(true);
    if (preds === null) {
      setLoading(true);
      try {
        const res = await fetch(`/api/match-predictions?matchId=${matchId}`);
        const data = await res.json();
        setPreds(data.predictions ?? []);
      } catch {
        setPreds([]);
      } finally {
        setLoading(false);
      }
    }
  }

  return (
    <div className="px-2 sm:px-3 pb-2 -mt-1">
      <button onClick={toggle} className="text-xs font-semibold text-primary hover:underline">
        {open ? "▲ Ocultar detalle" : "📋 Ver quién pronosticó"}
      </button>

      {open && (
        <div className="mt-1.5 rounded-lg border border-line bg-[#f9fbfa] p-2">
          {loading ? (
            <p className="text-xs text-muted">Cargando…</p>
          ) : preds && preds.length > 0 ? (
            <div className="space-y-1">
              {preds.map((p, i) => (
                <div key={i} className="flex items-center gap-2 text-xs">
                  <span className="truncate flex-1 font-medium">{p.name}</span>
                  <span className="text-muted font-semibold">
                    {p.pred_home}-{p.pred_away}
                  </span>
                  <span
                    className={`px-1.5 py-0.5 rounded font-bold w-12 text-center shrink-0 ${pointsBadgeClass(
                      p.points ?? 0
                    )}`}
                  >
                    {p.points ?? 0} pts
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted">Nadie pronosticó este partido.</p>
          )}
        </div>
      )}
    </div>
  );
}

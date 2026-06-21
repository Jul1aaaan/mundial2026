"use client";
import { useState } from "react";
import Flag from "./Flag";

type TL = { min: string; code: string | null; kind: "goal" | "yellow" | "red" | "sub"; main: string; sub: string | null };
type Lineup = { code: string | null; name: string; formation: string | null; starters: { num: string; name: string }[]; bench: { num: string; name: string }[] };
type Detail = {
  home: { name: string; code: string | null; score: number | null };
  away: { name: string; code: string | null; score: number | null };
  status: string;
  venue: string | null;
  timeline: TL[];
  lineups: Lineup[];
  stats: { label: string; home: string; away: string }[];
};

const ICON: Record<TL["kind"], string> = { goal: "⚽", yellow: "🟨", red: "🟥", sub: "🔁" };
const minNum = (m: string) => parseInt(m, 10) || 0;

function LineupBlock({ l }: { l: Lineup }) {
  return (
    <div>
      <div className="flex items-center gap-2 font-bold mb-1">
        <Flag code={l.code} size={16} />
        <span className="truncate">{l.name}</span>
        {l.formation && <span className="text-muted font-normal">· {l.formation}</span>}
      </div>
      <div className="text-muted">
        <span className="font-semibold text-foreground">Titulares:</span>{" "}
        {l.starters.map((p) => `${p.num ? p.num + " " : ""}${p.name}`).join(", ") || "—"}
      </div>
      {l.bench.length > 0 && (
        <div className="text-muted mt-0.5">
          <span className="font-semibold text-foreground">Suplentes:</span>{" "}
          {l.bench.map((p) => p.name).join(", ")}
        </div>
      )}
    </div>
  );
}

export default function MatchFullDetail({ matchId }: { matchId: number }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [detail, setDetail] = useState<Detail | null | undefined>(undefined);

  async function toggle() {
    if (open) {
      setOpen(false);
      return;
    }
    setOpen(true);
    if (detail === undefined) {
      setLoading(true);
      try {
        const r = await fetch(`/api/match-detail?matchId=${matchId}`);
        const d = await r.json();
        setDetail(d.detail ?? null);
      } catch {
        setDetail(null);
      } finally {
        setLoading(false);
      }
    }
  }

  const d = detail;
  const timeline = d ? [...d.timeline].sort((a, b) => minNum(a.min) - minNum(b.min)) : [];

  return (
    <div className="px-2 sm:px-3 pb-2">
      <button onClick={toggle} className="text-xs font-semibold text-primary hover:underline">
        {open ? "▲ Ocultar detalles" : "🔎 Detalles del partido"}
      </button>

      {open && (
        <div className="mt-1.5 rounded-lg border border-line bg-[#f9fbfa] p-3 text-xs space-y-3">
          {loading ? (
            <p className="text-muted">Cargando…</p>
          ) : !d ? (
            <p className="text-muted">No hay datos disponibles de este partido.</p>
          ) : (
            <>
              {/* Encabezado */}
              <div className="flex items-center justify-center gap-3 font-bold text-sm">
                <span className="flex items-center gap-1.5">
                  <Flag code={d.home.code} size={18} /> {d.home.name}
                </span>
                <span className="text-primary text-base">{d.home.score}-{d.away.score}</span>
                <span className="flex items-center gap-1.5">
                  {d.away.name} <Flag code={d.away.code} size={18} />
                </span>
              </div>
              {d.venue && <p className="text-center text-muted -mt-1">{d.venue}</p>}

              {/* Estadísticas */}
              {d.stats.length > 0 && (
                <div>
                  <h4 className="font-bold text-center mb-1 uppercase text-[11px] tracking-wide text-muted">Estadísticas</h4>
                  <div className="space-y-1">
                    {d.stats.map((s, i) => (
                      <div key={i} className="grid grid-cols-[2.5rem_1fr_2.5rem] items-center gap-2">
                        <span className="text-right font-bold">{s.home}</span>
                        <span className="text-center text-muted">{s.label}</span>
                        <span className="text-left font-bold">{s.away}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Línea de tiempo */}
              {timeline.length > 0 && (
                <div>
                  <h4 className="font-bold text-center mb-1 uppercase text-[11px] tracking-wide text-muted">Eventos</h4>
                  <div className="space-y-0.5">
                    {timeline.map((t, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <span className="w-9 text-right font-bold text-muted shrink-0">{t.min}&apos;</span>
                        <span className="shrink-0">{ICON[t.kind]}</span>
                        <Flag code={t.code} size={13} />
                        <span className="truncate">
                          {t.main}
                          {t.kind === "sub" && t.sub ? <span className="text-muted"> ↩ {t.sub}</span> : null}
                          {t.kind === "goal" && t.sub ? <span className="text-muted"> (asist. {t.sub})</span> : null}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Alineaciones */}
              {d.lineups.length > 0 && (
                <div>
                  <h4 className="font-bold text-center mb-1 uppercase text-[11px] tracking-wide text-muted">Alineaciones</h4>
                  <div className="grid md:grid-cols-2 gap-3">
                    {d.lineups.map((l, i) => (
                      <LineupBlock key={i} l={l} />
                    ))}
                  </div>
                </div>
              )}

              <p className="text-[10px] text-muted text-right">Datos: ESPN</p>
            </>
          )}
        </div>
      )}
    </div>
  );
}

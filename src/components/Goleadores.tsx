"use client";
import { useEffect, useState } from "react";
import Flag from "./Flag";

type Scorer = { name: string; team: string; code: string | null; goals: number; assists: number };

const MEDALS = ["🥇", "🥈", "🥉"];

export default function Goleadores() {
  const [scorers, setScorers] = useState<Scorer[] | null>(null);

  useEffect(() => {
    fetch("/api/scorers")
      .then((r) => r.json())
      .then((d) => setScorers(d.scorers ?? []))
      .catch(() => setScorers([]));
  }, []);

  return (
    <div className="max-w-xl mx-auto card card-top p-5">
      <h2 className="font-extrabold text-lg mb-3">🥅 Goleadores del Mundial</h2>

      {scorers === null ? (
        <p className="text-sm text-muted">Cargando…</p>
      ) : scorers.length === 0 ? (
        <p className="text-sm text-muted">Todavía no hay datos de goleadores.</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-muted text-xs uppercase border-b border-line">
              <th className="text-left py-2 pl-1 w-10">#</th>
              <th className="text-left py-2">Jugador</th>
              <th className="w-16 pr-1" title="Goles">Goles</th>
            </tr>
          </thead>
          <tbody>
            {scorers.map((s, i) => (
              <tr key={i} className="border-b border-line">
                <td className="py-2 pl-1 text-lg">{MEDALS[i] ?? <span className="text-muted text-sm">{i + 1}</span>}</td>
                <td className="py-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <Flag code={s.code} size={16} />
                    <span className="font-semibold truncate">{s.name}</span>
                    <span className="text-xs text-muted truncate hidden sm:inline">{s.team}</span>
                  </div>
                </td>
                <td className="text-center pr-1 font-extrabold text-primary text-lg">{s.goals}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <p className="text-[11px] text-muted mt-3">Datos: football-data.org · se actualizan solos.</p>
    </div>
  );
}

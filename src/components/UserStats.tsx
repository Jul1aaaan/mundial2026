import { Fragment } from "react";
import type { RankRow } from "@/lib/data";

// Resumen personal: saludo + posición. En celular, un mini-pantallazo del ranking
// (1º, el de arriba, vos y el de abajo) como barritas.
export default function UserStats({
  ranking,
  userId,
  name,
}: {
  ranking: RankRow[];
  userId: number;
  name: string;
}) {
  const idx = ranking.findIndex((r) => r.id === userId);
  if (idx === -1) return null;

  const total = ranking.length;
  const pos = idx + 1;

  // Filas a mostrar en el mini-ranking: 1º, el de arriba, vos y el de abajo (sin repetir).
  const wanted = [...new Set([0, idx - 1, idx, idx + 1].filter((i) => i >= 0 && i < total))].sort(
    (a, b) => a - b
  );

  return (
    <div className="md:text-right w-full md:w-auto">
      <div className="flex items-center gap-x-3 gap-y-1 flex-wrap md:justify-end">
        <span className="text-xl sm:text-2xl font-extrabold">Hola, {name} 👋</span>
        <span className="chip chip-green">
          {pos}º de {total}
        </span>
      </div>

      {/* Mini-ranking, solo en celular */}
      <div className="md:hidden mt-3 space-y-1 text-left">
        {wanted.map((i, k) => {
          const gap = k > 0 && i - wanted[k - 1] > 1;
          const isMe = i === idx;
          return (
            <Fragment key={i}>
              {gap && <div className="text-center text-muted text-xs leading-none">⋮</div>}
              <div
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg ${
                  isMe ? "bg-primary/15 border border-primary/40 font-bold" : "bg-[#f4f8f6]"
                }`}
              >
                <span className="w-7 text-center text-muted font-bold shrink-0">{i + 1}º</span>
                <span className="truncate flex-1">
                  {ranking[i].name}
                  {isMe ? " (vos)" : ""}
                </span>
                {i === 0 && <span className="shrink-0">🥇</span>}
              </div>
            </Fragment>
          );
        })}
      </div>
    </div>
  );
}

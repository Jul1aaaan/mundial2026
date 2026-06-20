import { Fragment } from "react";
import type { RankRow } from "@/lib/data";

// Flechita de movimiento (por efecto del último partido).
function Arrow({ delta }: { delta: number }) {
  if (delta > 0) return <span className="text-emerald-600 text-xs font-bold shrink-0">▲{delta}</span>;
  if (delta < 0) return <span className="text-red-500 text-xs font-bold shrink-0">▼{-delta}</span>;
  return <span className="text-muted/50 text-xs shrink-0">–</span>;
}

// Resumen personal: saludo + posición (PC). En celular, mini-pantallazo del ranking
// (1º, el de arriba, vos y el de abajo) con flechita y distancia de puntos.
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

  const me = ranking[idx];
  const total = ranking.length;
  const pos = idx + 1;

  const wanted = [...new Set([0, idx - 1, idx, idx + 1].filter((i) => i >= 0 && i < total))].sort(
    (a, b) => a - b
  );

  const diffLabel = (i: number) => {
    const d = ranking[i].pts - me.pts;
    if (d === 0) return "=";
    return d > 0 ? `+${d}` : `${d}`;
  };

  return (
    <div className="md:text-right w-full md:w-auto">
      <div className="flex items-center gap-x-3 gap-y-1 flex-wrap md:justify-end">
        <span className="text-xl sm:text-2xl font-extrabold">Hola, {name} 👋</span>
        {/* La posición en chip solo en PC; en celular ya se ve en las barritas */}
        <span className="chip chip-green hidden md:inline-flex">
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
                <span className="w-6 text-center text-muted font-bold shrink-0 text-sm">{i + 1}º</span>
                <Arrow delta={ranking[i].delta} />
                <span className="truncate flex-1 text-sm">
                  {ranking[i].name}
                  {isMe ? " (vos)" : ""}
                  {i === 0 ? " 🥇" : ""}
                </span>
                {!isMe && (
                  <span className="text-xs font-bold text-muted shrink-0 w-12 text-right">
                    {diffLabel(i)} pts
                  </span>
                )}
              </div>
            </Fragment>
          );
        })}
      </div>
    </div>
  );
}

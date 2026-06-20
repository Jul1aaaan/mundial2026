import type { RankRow } from "@/lib/data";

const pts = (n: number) => `${n} ${n === 1 ? "pt" : "pts"}`;

// Resumen personal del usuario: puntos, posición y distancias en el ranking.
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
  const above = idx > 0 ? ranking[idx - 1] : null;
  const below = idx < total - 1 ? ranking[idx + 1] : null;
  const first = ranking[0];

  const gapAbove = above ? above.pts - me.pts : 0;
  const gapFirst = first.pts - me.pts;
  const gapBelow = below ? me.pts - below.pts : 0;

  return (
    <div className="mt-3">
      {/* Saludo grande a la izquierda, puntos/posición a la derecha */}
      <div className="flex items-center justify-between flex-wrap gap-x-4 gap-y-2">
        <div className="text-xl sm:text-2xl font-extrabold">Hola, {name} 👋</div>
        <div className="flex items-center gap-2">
          <span className="text-3xl font-extrabold text-primary leading-none">
            {me.pts}
            <span className="text-sm font-bold text-muted"> pts</span>
          </span>
          <span className="chip chip-green">
            {pos}º de {total}
          </span>
        </div>
      </div>

      {/* Distancias en el ranking */}
      <div className="mt-3 space-y-0.5 text-sm text-muted">
        {!above && <p className="font-semibold text-primary">🥇 ¡Vas primero! A no relajarse 😎</p>}

        {above &&
          (gapAbove === 0 ? (
            <p>
              Empatás con <b className="text-foreground">{above.name}</b> 🤝
            </p>
          ) : (
            <p>
              Te faltan <b className="text-foreground">{pts(gapAbove)}</b> para pasar a{" "}
              <b className="text-foreground">{above.name}</b>
              {idx === 1 ? " y quedar 1º 🥇" : ""}.
            </p>
          ))}

        {idx >= 2 && (
          <p>
            Estás a <b className="text-foreground">{pts(gapFirst)}</b> del 1º (
            <b className="text-foreground">{first.name}</b>).
          </p>
        )}

        {below &&
          (gapBelow === 0 ? (
            <p>
              ¡Ojo! Estás empatado con <b className="text-foreground">{below.name}</b>, te pisa los talones 👀
            </p>
          ) : (
            <p>
              ¡Cuidado! A <b className="text-foreground">{below.name}</b> le faltan{" "}
              <b className="text-foreground">{pts(gapBelow)}</b> para alcanzarte 👀
            </p>
          ))}
      </div>
    </div>
  );
}

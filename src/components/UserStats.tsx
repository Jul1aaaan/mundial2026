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
  const first = ranking[0];

  // El más cercano por ARRIBA que tenga ESTRICTAMENTE más puntos (saltea los empatados).
  let tIdx = idx - 1;
  while (tIdx >= 0 && ranking[tIdx].pts === me.pts) tIdx--;
  const target = tIdx >= 0 ? ranking[tIdx] : null;
  const gapTarget = target ? target.pts - me.pts : 0;
  const gapFirst = first.pts - me.pts;

  const below = idx < total - 1 ? ranking[idx + 1] : null;
  const gapBelow = below ? me.pts - below.pts : 0;

  // Si nadie arriba tiene más puntos, estás en la cima (solo o compartida).
  const tiedAtTop = !target && (idx > 0 || (!!below && below.pts === me.pts));

  return (
    <div className="md:text-right w-full md:w-auto">
      <div className="flex items-center gap-x-3 gap-y-1 flex-wrap md:justify-end">
        <span className="text-xl sm:text-2xl font-extrabold">Hola, {name} 👋</span>
        <span className="text-3xl font-extrabold text-primary leading-none">
          {me.pts}
          <span className="text-sm font-bold text-muted"> pts</span>
        </span>
        <span className="chip chip-green">
          {pos}º de {total}
        </span>
      </div>

      <div className="mt-2 space-y-0.5 text-sm text-muted">
        {!target ? (
          <p className="font-semibold text-primary">
            {tiedAtTop ? "🥇 ¡Compartís la punta! A no relajarse 😎" : "🥇 ¡Vas primero! A no relajarse 😎"}
          </p>
        ) : (
          <>
            <p>
              Te faltan <b className="text-foreground">{pts(gapTarget)}</b> para pasar a{" "}
              <b className="text-foreground">{target.name}</b>
              {tIdx === 0 ? " y quedar 1º 🥇" : ""}.
            </p>
            {tIdx > 0 && (
              <p>
                Estás a <b className="text-foreground">{pts(gapFirst)}</b> del 1º (
                <b className="text-foreground">{first.name}</b>).
              </p>
            )}
          </>
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

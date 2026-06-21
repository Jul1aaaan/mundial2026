import type { Lineup, LineupPlayer } from "@/lib/types";

// Profundidad (0 = arquero atrás ... 4 = delanteros adelante) según la posición.
function depth(posName: string): number {
  const n = posName.toLowerCase();
  if (n.includes("goalkeeper")) return 0;
  if (n.includes("forward") || n.includes("striker") || n.includes("winger")) return 4;
  if (n.includes("attacking mid")) return 3;
  if (n.includes("defensive mid")) return 2;
  if (n.includes("midfield")) return 2.5;
  if (n.includes("defender") || n.includes("back")) return 1;
  return 2.5;
}

// Posición horizontal (negativo = izquierda, positivo = derecha).
function side(posName: string): number {
  const n = posName.toLowerCase();
  let s = n.includes("left") ? -2 : n.includes("right") ? 2 : 0;
  if (n.includes("center left")) s = -1;
  if (n.includes("center right")) s = 1;
  return s;
}

function surname(name: string): string {
  const parts = name.trim().split(/\s+/);
  return parts.length > 1 ? parts.slice(1).join(" ") : name;
}

// Arma las líneas según la formación ("4-3-3"), ordenando por profundidad y lado.
function buildRows(formation: string | null, starters: LineupPlayer[]): LineupPlayer[][] {
  const gk = starters.filter((p) => depth(p.posName) === 0);
  const outfield = starters
    .filter((p) => depth(p.posName) > 0)
    .sort((a, b) => depth(a.posName) - depth(b.posName));

  const counts = (formation ?? "").split("-").map(Number).filter((n) => n > 0);
  const rows: LineupPlayer[][] = [gk];

  if (counts.length) {
    let i = 0;
    for (const c of counts) {
      rows.push(outfield.slice(i, i + c).sort((a, b) => side(a.posName) - side(b.posName)));
      i += c;
    }
    if (i < outfield.length) rows.push(outfield.slice(i));
  } else {
    rows.push(outfield);
  }
  return rows.filter((r) => r.length);
}

function Jersey({ p }: { p: LineupPlayer }) {
  return (
    <div className="flex flex-col items-center" style={{ width: "22%" }}>
      <div className="w-7 h-7 rounded-full bg-white text-[#0f1f1a] grid place-items-center font-extrabold text-[11px] shadow border border-black/10">
        {p.num}
      </div>
      <span className="text-[9px] font-semibold text-white leading-tight mt-0.5 text-center truncate w-full [text-shadow:0_1px_2px_rgba(0,0,0,0.7)]">
        {surname(p.name)}
      </span>
    </div>
  );
}

export default function Pitch({ lineup }: { lineup: Lineup }) {
  const rows = buildRows(lineup.formation, lineup.starters);

  return (
    <div className="pitch">
      {/* líneas */}
      <div className="absolute left-0 right-0 top-1/2 border-t-2 border-white/40" />
      <div className="absolute left-1/2 top-1/2 w-14 h-14 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white/40" />
      <div className="absolute left-1/2 bottom-0 w-2/5 h-[13%] -translate-x-1/2 border-2 border-b-0 border-white/40 rounded-t-sm" />
      <div className="absolute left-1/2 top-0 w-2/5 h-[13%] -translate-x-1/2 border-2 border-t-0 border-white/40 rounded-b-sm" />

      {/* jugadores: fila 0 (arquero) abajo, delanteros arriba */}
      {rows.map((row, ri) => (
        <div
          key={ri}
          className="absolute left-1 right-1 flex justify-around items-center"
          style={{ top: `${(1 - (ri + 0.5) / rows.length) * 100}%`, transform: "translateY(-50%)" }}
        >
          {row.map((p, i) => (
            <Jersey key={i} p={p} />
          ))}
        </div>
      ))}
    </div>
  );
}

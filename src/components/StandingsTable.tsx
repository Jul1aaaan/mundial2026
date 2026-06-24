import type { StandingRow } from "@/lib/types";
import Flag from "./Flag";

// Tabla de posiciones. Las primeras `qualify` filas van en verde (clasifican directo);
// los equipos en `qualifiedThirds` (mejores terceros) van en amarillo.
export default function StandingsTable({
  rows,
  qualify = 2,
  qualifiedThirds,
  clinched,
}: {
  rows: StandingRow[];
  qualify?: number;
  qualifiedThirds?: Set<number>;
  clinched?: Set<number>; // ya clasificados sí o sí (verde fuerte)
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-muted text-xs uppercase">
            <th className="text-left font-semibold py-1.5 pl-2 w-8">#</th>
            <th className="text-left font-semibold py-1.5">Equipo</th>
            <th className="font-semibold w-8" title="Partidos jugados">PJ</th>
            <th className="font-semibold w-8 hidden sm:table-cell">G</th>
            <th className="font-semibold w-8 hidden sm:table-cell">E</th>
            <th className="font-semibold w-8 hidden sm:table-cell">P</th>
            <th className="font-semibold w-10" title="Diferencia de gol">DG</th>
            <th className="font-semibold w-10 pr-2" title="Puntos">Pts</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => {
            const isClinched = clinched?.has(r.teamId);
            const qualifies = i < qualify;
            const bestThird = !qualifies && qualifiedThirds?.has(r.teamId);
            return (
              <tr
                key={r.teamId}
                className={`border-t border-line ${
                  isClinched ? "bg-emerald-200/70" : qualifies ? "bg-emerald-50/70" : bestThird ? "bg-amber-50" : ""
                }`}
              >
                <td className="py-1.5 pl-2 text-muted">
                  <span
                    className={`inline-block w-1.5 h-5 rounded-full align-middle mr-1.5 ${
                      isClinched ? "bg-emerald-600" : qualifies ? "bg-emerald-500" : bestThird ? "bg-amber-400" : "bg-transparent"
                    }`}
                  />
                  {i + 1}
                </td>
                <td className="py-1.5 font-medium">
                  <span className="flex items-center gap-2">
                    <Flag code={r.code} size={16} />
                    <span className="truncate">{r.name}</span>
                    {isClinched && <span title="Ya clasificó" className="text-emerald-700 font-bold shrink-0">✓</span>}
                  </span>
                </td>
                <td className="text-center text-muted">{r.pj}</td>
                <td className="text-center text-muted hidden sm:table-cell">{r.g}</td>
                <td className="text-center text-muted hidden sm:table-cell">{r.e}</td>
                <td className="text-center text-muted hidden sm:table-cell">{r.p}</td>
                <td className="text-center text-muted">{r.dg > 0 ? `+${r.dg}` : r.dg}</td>
                <td className="text-center pr-2 font-extrabold text-primary">{r.pts}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

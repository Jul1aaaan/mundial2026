import { requireUser } from "@/lib/auth";
import { getRanking } from "@/lib/data";
import NavBar from "@/components/NavBar";
import Footer from "@/components/Footer";

export const dynamic = "force-dynamic";

const MEDALS = ["🥇", "🥈", "🥉"];

export default async function RankingPage() {
  const user = await requireUser();
  const rows = await getRanking();

  return (
    <>
      <NavBar name={user.name} admin={user.admin} />
      <main className="flex-1 max-w-3xl w-full mx-auto px-4 py-6">
        <div className="card card-top p-5 mb-6">
          <h1 className="text-2xl font-extrabold">Ranking de la familia 🏅</h1>
          <p className="text-muted mt-1 text-sm">Se ordena por puntos. Así se suman:</p>
          <div className="flex flex-wrap gap-2 mt-3">
            <span className="chip chip-blue">✅ Quién gana/empata = 5 pts</span>
            <span className="chip chip-amber">⚽ Goles exactos de un equipo = +1 c/u</span>
            <span className="chip chip-blue">📐 Diferencia de gol exacta = +2</span>
            <span className="chip chip-green">🎯 Resultado perfecto = 10 pts</span>
          </div>
        </div>

        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-muted text-xs uppercase border-b border-line">
                <th className="text-left font-semibold py-3 pl-4 w-12">#</th>
                <th className="text-left font-semibold py-3">Jugador</th>
                <th className="font-semibold w-16" title="Resultados perfectos (10 pts)">Perfectos</th>
                <th className="font-semibold w-16 hidden sm:table-cell" title="Pronósticos que sumaron puntos">Aciertos</th>
                <th className="font-semibold w-20 pr-4">Puntos</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => {
                const me = r.id === user.uid;
                return (
                  <tr key={r.id} className={`border-b border-line ${me ? "bg-emerald-50" : ""}`}>
                    <td className="py-3 pl-4 text-lg">{MEDALS[i] ?? <span className="text-muted text-sm">{i + 1}</span>}</td>
                    <td className="py-3 font-semibold">
                      {r.name}
                      {me && <span className="ml-2 text-xs text-primary font-bold">(vos)</span>}
                    </td>
                    <td className="text-center text-emerald-600 font-bold">{r.exactos}</td>
                    <td className="text-center text-blue-600 hidden sm:table-cell">{r.aciertos}</td>
                    <td className="text-center pr-4 font-extrabold text-lg text-primary">{r.pts}</td>
                  </tr>
                );
              })}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-muted">
                    Todavía no hay jugadores.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </main>
      <Footer />
    </>
  );
}

import { requireUser } from "@/lib/auth";
import { getTeams, getMatchViews } from "@/lib/data";
import NavBar from "@/components/NavBar";
import FixtureClient from "@/components/FixtureClient";
import Footer from "@/components/Footer";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const user = await requireUser();
  const [teams, matches] = await Promise.all([getTeams(), getMatchViews(user.uid)]);

  return (
    <>
      <NavBar name={user.name} admin={user.admin} />
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 py-6">
        <div className="card card-top p-5 mb-6">
          <h1 className="text-2xl font-extrabold flex items-center gap-2">
            Fixture · Mundial <span className="text-primary">2026</span> 🌎
          </h1>
          <p className="text-muted mt-1 text-sm">
            Cargá tu pronóstico de cada partido. La tabla del grupo se actualiza al instante con lo
            que pongas. Podés editar hasta que el partido empiece.
          </p>
          <div className="flex flex-wrap gap-2 mt-3">
            <span className="chip chip-green">🎯 Resultado exacto = 4 pts</span>
            <span className="chip chip-blue">✅ Acertar quién gana/empata = 2 pts</span>
          </div>
        </div>

        <FixtureClient teams={teams} matches={matches} />
      </main>
      <Footer />
    </>
  );
}

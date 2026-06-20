import { requireUser } from "@/lib/auth";
import { getTeams, getMatchViews, getRanking } from "@/lib/data";
import NavBar from "@/components/NavBar";
import FixtureClient from "@/components/FixtureClient";
import UpcomingMatches from "@/components/UpcomingMatches";
import UserStats from "@/components/UserStats";
import Footer from "@/components/Footer";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const user = await requireUser();
  const [teams, matches, ranking] = await Promise.all([
    getTeams(),
    getMatchViews(user.uid),
    getRanking(),
  ]);

  return (
    <>
      <NavBar name={user.name} admin={user.admin} />
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 py-6">
        <div className="card card-top p-5 mb-6">
          <h1 className="text-xl sm:text-2xl font-extrabold">
            <span className="text-primary">Gaznapios</span> Mundial 2026 🏆
          </h1>
          <UserStats ranking={ranking} userId={user.uid} name={user.name} />
        </div>

        <UpcomingMatches matches={matches} />

        <FixtureClient teams={teams} matches={matches} />
      </main>
      <Footer />
    </>
  );
}

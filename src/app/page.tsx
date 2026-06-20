import { requireUser } from "@/lib/auth";
import { getTeams, getMatchViews } from "@/lib/data";
import NavBar from "@/components/NavBar";
import FixtureClient from "@/components/FixtureClient";
import UpcomingMatches from "@/components/UpcomingMatches";
import Footer from "@/components/Footer";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const user = await requireUser();
  const [teams, matches] = await Promise.all([getTeams(), getMatchViews(user.uid)]);

  return (
    <>
      <NavBar name={user.name} admin={user.admin} />
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 py-6">
        <UpcomingMatches matches={matches} />

        <FixtureClient teams={teams} matches={matches} />
      </main>
      <Footer />
    </>
  );
}

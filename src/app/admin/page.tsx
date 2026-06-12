import { requireAdmin } from "@/lib/auth";
import { getTeams, getMatches } from "@/lib/data";
import NavBar from "@/components/NavBar";
import AdminClient from "@/components/AdminClient";
import Footer from "@/components/Footer";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const user = await requireAdmin();
  const [teams, matches] = await Promise.all([getTeams(), getMatches()]);

  return (
    <>
      <NavBar name={user.name} admin={user.admin} />
      <main className="flex-1 max-w-4xl w-full mx-auto px-4 py-6">
        <div className="card card-top p-5 mb-6">
          <h1 className="text-2xl font-extrabold">Panel de administración 🛠️</h1>
          <p className="text-muted mt-1 text-sm">Solo vos ves esto. Los resultados completan todo solos.</p>
        </div>
        <AdminClient teams={teams} matches={matches} />
      </main>
      <Footer />
    </>
  );
}

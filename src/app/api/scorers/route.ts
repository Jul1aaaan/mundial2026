import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { TLA_TO_CODE } from "@/lib/sync";

// Top goleadores del Mundial (football-data.org, plan gratuito).
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "No autenticado." }, { status: 401 });

  const token = process.env.FOOTBALL_DATA_API_KEY;
  if (!token) return NextResponse.json({ scorers: [] });

  try {
    const res = await fetch("https://api.football-data.org/v4/competitions/WC/scorers?limit=10", {
      headers: { "X-Auth-Token": token },
      next: { revalidate: 600 }, // cache 10 min para no pegarle de más
    });
    if (!res.ok) return NextResponse.json({ scorers: [] });
    const data = await res.json();

    const scorers = (data.scorers ?? []).map((s: {
      player?: { name?: string };
      team?: { name?: string; tla?: string };
      goals?: number;
      assists?: number;
      penalties?: number;
    }) => ({
      name: s.player?.name ?? "—",
      team: s.team?.name ?? "",
      code: s.team?.tla ? TLA_TO_CODE[s.team.tla] ?? null : null,
      goals: s.goals ?? 0,
      assists: s.assists ?? 0,
      penalties: s.penalties ?? 0,
    }));

    return NextResponse.json({ scorers });
  } catch {
    return NextResponse.json({ scorers: [] });
  }
}

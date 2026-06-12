import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { setMatchResult, clearMatchResult } from "@/lib/data";

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user?.admin) return NextResponse.json({ error: "Solo admin." }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const matchId = Number(body.matchId);
  if (!Number.isInteger(matchId)) {
    return NextResponse.json({ error: "Partido inválido." }, { status: 400 });
  }

  if (body.clear) {
    await clearMatchResult(matchId);
    return NextResponse.json({ ok: true, cleared: true });
  }

  const home = Number(body.homeScore);
  const away = Number(body.awayScore);
  if (!Number.isInteger(home) || !Number.isInteger(away) || home < 0 || away < 0) {
    return NextResponse.json({ error: "Resultado inválido." }, { status: 400 });
  }
  const winnerTeamId = body.winnerTeamId ? Number(body.winnerTeamId) : null;
  await setMatchResult(matchId, home, away, winnerTeamId);
  return NextResponse.json({ ok: true });
}

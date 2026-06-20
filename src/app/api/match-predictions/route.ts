import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { query } from "@/lib/db";
import { getMatchPredictions } from "@/lib/data";

// Detalle de pronósticos de un partido. Solo para partidos YA jugados
// (para no espiar lo que pusieron los demás en partidos por venir).
export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "No autenticado." }, { status: 401 });

  const matchId = Number(new URL(req.url).searchParams.get("matchId"));
  if (!Number.isInteger(matchId)) {
    return NextResponse.json({ error: "Partido inválido." }, { status: 400 });
  }

  const rows = await query<{ status: string }[]>(
    "SELECT status FROM matches WHERE id = ?",
    [matchId]
  );
  if (rows[0]?.status !== "finished") {
    return NextResponse.json({ predictions: [] });
  }

  const predictions = await getMatchPredictions(matchId);
  return NextResponse.json({ predictions });
}

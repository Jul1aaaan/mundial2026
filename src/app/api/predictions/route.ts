import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { savePrediction } from "@/lib/data";

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "No autenticado." }, { status: 401 });

  const { matchId, predHome, predAway, penWinner } = await req.json().catch(() => ({}));
  const mId = Number(matchId);
  const h = Number(predHome);
  const a = Number(predAway);
  if (!Number.isInteger(mId) || !Number.isInteger(h) || !Number.isInteger(a)) {
    return NextResponse.json({ error: "Datos inválidos." }, { status: 400 });
  }
  // penWinner: opcional. null = limpiar; número = equipo elegido; undefined = no tocar.
  const pen = penWinner === undefined ? undefined : penWinner === null ? null : Number(penWinner);
  if (pen !== undefined && pen !== null && !Number.isInteger(pen)) {
    return NextResponse.json({ error: "Datos inválidos." }, { status: 400 });
  }

  const result = await savePrediction(user.uid, mId, h, a, pen);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({ ok: true });
}

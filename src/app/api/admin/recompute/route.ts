import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { recomputeBracket } from "@/lib/data";

// Recalcula el cuadro de eliminatorias a partir de los resultados reales actuales.
export async function POST() {
  const user = await getCurrentUser();
  if (!user?.admin) return NextResponse.json({ error: "Solo admin." }, { status: 403 });
  await recomputeBracket();
  return NextResponse.json({ ok: true });
}

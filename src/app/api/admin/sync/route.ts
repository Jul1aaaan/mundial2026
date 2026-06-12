import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { syncResults } from "@/lib/sync";

// Permite al admin disparar la sincronización con la API manualmente.
export async function POST() {
  const user = await getCurrentUser();
  if (!user?.admin) return NextResponse.json({ error: "Solo admin." }, { status: 403 });

  const result = await syncResults();
  return NextResponse.json(result, { status: result.ok ? 200 : 502 });
}

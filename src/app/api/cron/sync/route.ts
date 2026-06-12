import { NextResponse } from "next/server";
import { syncResults } from "@/lib/sync";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Llamado por el cron de Vercel (Authorization: Bearer <CRON_SECRET>)
// o manualmente con ?key=<CRON_SECRET>.
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  const key = new URL(req.url).searchParams.get("key");
  if (secret && auth !== `Bearer ${secret}` && key !== secret) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  const result = await syncResults();
  return NextResponse.json(result, { status: result.ok ? 200 : 502 });
}

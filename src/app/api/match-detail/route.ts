import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { query } from "@/lib/db";
import { findEspnEventId, getEspnDetail } from "@/lib/espn";

// Detalle completo de un partido (alineaciones, eventos, estadísticas) desde ESPN.
export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "No autenticado." }, { status: 401 });

  const matchId = Number(new URL(req.url).searchParams.get("matchId"));
  if (!Number.isInteger(matchId)) {
    return NextResponse.json({ error: "Partido inválido." }, { status: 400 });
  }

  const rows = await query<
    { espn_id: string | null; status: string; kickoff: string | null; home_code: string; away_code: string }[]
  >(
    `SELECT m.espn_id, m.status, DATE_FORMAT(m.kickoff, '%Y-%m-%dT%H:%i:%s') AS kickoff,
            th.code AS home_code, ta.code AS away_code
     FROM matches m
     JOIN teams th ON th.id = m.home_team_id
     JOIN teams ta ON ta.id = m.away_team_id
     WHERE m.id = ?`,
    [matchId]
  );
  const m = rows[0];
  if (!m || m.status !== "finished") return NextResponse.json({ detail: null });

  let eventId = m.espn_id;
  if (!eventId && m.kickoff) {
    eventId = await findEspnEventId(m.kickoff, m.home_code, m.away_code);
    if (eventId) await query("UPDATE matches SET espn_id = ? WHERE id = ?", [eventId, matchId]);
  }
  if (!eventId) return NextResponse.json({ detail: null });

  const detail = await getEspnDetail(eventId);
  return NextResponse.json({ detail });
}

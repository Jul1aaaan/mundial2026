import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { verifyPassword, setSession } from "@/lib/auth";

export async function POST(req: Request) {
  const { email, password } = await req.json().catch(() => ({}));
  if (!email || !password) {
    return NextResponse.json({ error: "Completá email y contraseña." }, { status: 400 });
  }
  const cleanEmail = String(email).trim().toLowerCase();

  const rows = await query<{ id: number; name: string; password_hash: string; is_admin: number }[]>(
    "SELECT id, name, password_hash, is_admin FROM users WHERE email = ?",
    [cleanEmail]
  );
  const user = rows[0];
  if (!user || !(await verifyPassword(String(password), user.password_hash))) {
    return NextResponse.json({ error: "Email o contraseña incorrectos." }, { status: 401 });
  }

  await setSession({ uid: user.id, name: user.name, admin: Boolean(user.is_admin) });
  return NextResponse.json({ ok: true, admin: Boolean(user.is_admin) });
}

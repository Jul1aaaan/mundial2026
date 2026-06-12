import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { hashPassword, setSession } from "@/lib/auth";

export async function POST(req: Request) {
  const { name, email, password } = await req.json().catch(() => ({}));

  if (!name || !email || !password) {
    return NextResponse.json({ error: "Completá nombre, email y contraseña." }, { status: 400 });
  }
  if (String(password).length < 4) {
    return NextResponse.json({ error: "La contraseña debe tener al menos 4 caracteres." }, { status: 400 });
  }
  const cleanEmail = String(email).trim().toLowerCase();

  const existing = await query<{ id: number }[]>("SELECT id FROM users WHERE email = ?", [cleanEmail]);
  if (existing.length > 0) {
    return NextResponse.json({ error: "Ya existe una cuenta con ese email." }, { status: 409 });
  }

  const isAdmin = cleanEmail === String(process.env.ADMIN_EMAIL ?? "").trim().toLowerCase();
  const hash = await hashPassword(String(password));

  const cleanName = String(name).trim().slice(0, 80);
  const res = await query<{ insertId: number }>(
    "INSERT INTO users (name, email, password_hash, is_admin) VALUES (?, ?, ?, ?)",
    [cleanName, cleanEmail, hash, isAdmin ? 1 : 0]
  );
  const uid = res.insertId;

  await setSession({ uid, name: cleanName, admin: isAdmin });
  return NextResponse.json({ ok: true, admin: isAdmin });
}

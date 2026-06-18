import { NextResponse } from "next/server";
import { getCurrentUser, hashPassword } from "@/lib/auth";
import { setUserPassword } from "@/lib/data";

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user?.admin) return NextResponse.json({ error: "Solo admin." }, { status: 403 });

  const { userId, newPassword } = await req.json().catch(() => ({}));
  const id = Number(userId);
  if (!Number.isInteger(id)) {
    return NextResponse.json({ error: "Usuario inválido." }, { status: 400 });
  }
  if (!newPassword || String(newPassword).length < 4) {
    return NextResponse.json({ error: "La contraseña debe tener al menos 4 caracteres." }, { status: 400 });
  }

  const hash = await hashPassword(String(newPassword));
  const ok = await setUserPassword(id, hash);
  if (!ok) return NextResponse.json({ error: "No se encontró el usuario." }, { status: 404 });
  return NextResponse.json({ ok: true });
}

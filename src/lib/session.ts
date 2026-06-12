import { SignJWT, jwtVerify } from "jose";

// Edge-safe: solo usa `jose` (sirve en middleware y en server components).
const secret = new TextEncoder().encode(
  process.env.AUTH_SECRET ?? "dev-insecure-secret-change-me"
);

export type SessionPayload = {
  uid: number;
  name: string;
  admin: boolean;
};

export const SESSION_COOKIE = "mundial_session";

export async function createSessionToken(payload: SessionPayload): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(secret);
}

export async function verifySessionToken(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secret);
    return { uid: Number(payload.uid), name: String(payload.name), admin: Boolean(payload.admin) };
  } catch {
    return null;
  }
}

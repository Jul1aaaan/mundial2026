"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function AuthForm({ mode }: { mode: "login" | "register" }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const isRegister = mode === "register";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/auth/${isRegister ? "register" : "login"}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(isRegister ? { name, email, password } : { email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Algo salió mal.");
        return;
      }
      router.push("/");
      router.refresh();
    } catch {
      setError("No se pudo conectar. Probá de nuevo.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="w-full max-w-sm mx-auto">
      <div className="text-center mb-8">
        <div className="text-5xl mb-3">⚽</div>
        <h1 className="text-2xl font-extrabold">Mundial <span className="text-primary">2026</span> Gaznapios</h1>
        <p className="text-sm text-muted mt-1">
          {isRegister ? "Creá tu cuenta para empezar a pronosticar" : "Entrá con tu cuenta"}
        </p>
      </div>

      <form onSubmit={submit} className="card card-top p-6 space-y-4">
        {isRegister && (
          <div>
            <label className="text-sm font-medium text-muted">Nombre</label>
            <input
              className="field mt-1"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Cómo te ven en el ranking"
              required
            />
          </div>
        )}
        <div>
          <label className="text-sm font-medium text-muted">Email</label>
          <input
            className="field mt-1"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="tu@email.com"
            required
          />
        </div>
        <div>
          <label className="text-sm font-medium text-muted">Contraseña</label>
          <input
            className="field mt-1"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••"
            required
          />
        </div>

        {error && <p className="text-sm text-red-500">{error}</p>}

        <button type="submit" className="btn btn-primary w-full" disabled={loading}>
          {loading ? "Cargando…" : isRegister ? "Crear cuenta" : "Entrar"}
        </button>
      </form>

      <p className="text-center text-sm text-muted mt-4">
        {isRegister ? (
          <>
            ¿Ya tenés cuenta?{" "}
            <Link href="/login" className="text-primary font-semibold hover:underline">
              Entrá acá
            </Link>
          </>
        ) : (
          <>
            ¿No tenés cuenta?{" "}
            <Link href="/register" className="text-primary font-semibold hover:underline">
              Registrate
            </Link>
          </>
        )}
      </p>
    </div>
  );
}

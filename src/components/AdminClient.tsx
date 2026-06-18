"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export type AdminUser = { id: number; name: string; email: string; is_admin: number };

function UserRow({ user }: { user: AdminUser }) {
  const [editing, setEditing] = useState(false);
  const [pass, setPass] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function save() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/admin/set-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id, newPassword: pass }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMsg(`⚠️ ${data.error ?? "No se pudo cambiar."}`);
      } else {
        setMsg(`✅ Contraseña cambiada. Pasásela: ${pass}`);
        setEditing(false);
        setPass("");
      }
    } catch {
      setMsg("⚠️ No se pudo conectar.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="py-2.5 border-t border-line">
      <div className="flex items-center gap-2">
        <div className="flex-1 min-w-0">
          <div className="font-semibold truncate flex items-center gap-2">
            {user.name}
            {user.is_admin ? <span className="chip chip-green !py-0 !px-2 text-[11px]">admin</span> : null}
          </div>
          <div className="text-xs text-muted truncate">{user.email}</div>
        </div>
        <button
          className="btn btn-ghost py-1.5 px-3 text-sm"
          onClick={() => { setEditing((e) => !e); setMsg(null); }}
          title="Cambiar contraseña"
        >
          ✏️ Contraseña
        </button>
      </div>

      {editing && (
        <div className="flex flex-wrap items-center gap-2 mt-2">
          <input
            className="field !py-1.5 text-sm flex-1 min-w-[10rem]"
            type="text"
            placeholder="Nueva contraseña (mín. 4)"
            value={pass}
            onChange={(e) => setPass(e.target.value)}
          />
          <button
            className="btn btn-primary py-1.5 px-3 text-sm"
            disabled={busy || pass.length < 4}
            onClick={save}
          >
            {busy ? "Guardando…" : "Guardar"}
          </button>
          <button
            className="btn btn-ghost py-1.5 px-3 text-sm"
            onClick={() => { setEditing(false); setPass(""); setMsg(null); }}
          >
            Cancelar
          </button>
        </div>
      )}

      {msg && <p className="text-xs mt-1.5 text-muted">{msg}</p>}
    </div>
  );
}

export default function AdminClient({ users }: { users: AdminUser[] }) {
  const [syncMsg, setSyncMsg] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [recomputing, setRecomputing] = useState(false);
  const router = useRouter();

  async function runSync() {
    setSyncing(true);
    setSyncMsg(null);
    try {
      const res = await fetch("/api/admin/sync", { method: "POST" });
      const data = await res.json();
      if (!res.ok) setSyncMsg(`⚠️ ${data.error ?? "Falló la sincronización."}`);
      else setSyncMsg(`✅ Listo: ${data.resultsApplied} resultados, ${data.datesUpdated} fechas actualizadas (${data.unmapped} sin mapear de ${data.fetched}).`);
      router.refresh();
    } catch {
      setSyncMsg("⚠️ No se pudo conectar.");
    } finally {
      setSyncing(false);
    }
  }

  async function runRecompute() {
    setRecomputing(true);
    await fetch("/api/admin/recompute", { method: "POST" });
    setRecomputing(false);
    router.refresh();
  }

  return (
    <div className="space-y-6">
      {/* Sync */}
      <div className="card card-top p-5">
        <h2 className="font-extrabold text-lg mb-1">Resultados automáticos (API)</h2>
        <p className="text-sm text-muted mb-3">
          Trae los resultados reales desde football-data.org y completa las llaves solas.
          También corre cada hora automáticamente.
        </p>
        <div className="flex flex-wrap gap-2">
          <button className="btn btn-primary" disabled={syncing} onClick={runSync}>
            {syncing ? "Sincronizando…" : "Sincronizar ahora"}
          </button>
          <button className="btn btn-ghost" disabled={recomputing} onClick={runRecompute}>
            {recomputing ? "Recalculando…" : "Recalcular cuadro"}
          </button>
        </div>
        {syncMsg && <p className="text-sm mt-3">{syncMsg}</p>}
      </div>

      {/* Usuarios */}
      <div className="card card-top p-5">
        <h2 className="font-extrabold text-lg mb-1">Usuarios y contraseñas</h2>
        <p className="text-sm text-muted mb-2">
          Tocá <b>✏️ Contraseña</b> para cambiarle la clave a alguien que se la olvidó, y después se la pasás.
          <span className="block text-xs mt-0.5">{users.length} usuarios registrados.</span>
        </p>
        <div>
          {users.map((u) => (
            <UserRow key={u.id} user={u} />
          ))}
        </div>
      </div>
    </div>
  );
}

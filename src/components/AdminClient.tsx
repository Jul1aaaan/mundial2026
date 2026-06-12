"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { Match, Team } from "@/lib/types";
import { formatKickoff } from "@/lib/format";
import Flag from "./Flag";

function ResultEditor({
  match,
  teamName,
}: {
  match: Match;
  teamName: (id: number | null) => { name: string; code: string | null };
}) {
  const router = useRouter();
  const [home, setHome] = useState(match.home_score?.toString() ?? "");
  const [away, setAway] = useState(match.away_score?.toString() ?? "");
  const [winner, setWinner] = useState(match.winner_team_id?.toString() ?? "");
  const [busy, setBusy] = useState(false);
  const h = teamName(match.home_team_id);
  const a = teamName(match.away_team_id);
  const clamp = (v: string) => v.replace(/[^0-9]/g, "").slice(0, 2);

  const isKo = match.stage !== "group";
  const isDraw = home !== "" && away !== "" && home === away;
  const needWinner = isKo && isDraw;

  async function save(clear = false) {
    setBusy(true);
    await fetch("/api/admin/result", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(
        clear
          ? { matchId: match.id, clear: true }
          : {
              matchId: match.id,
              homeScore: Number(home),
              awayScore: Number(away),
              winnerTeamId: needWinner ? Number(winner) || null : null,
            }
      ),
    });
    setBusy(false);
    if (clear) { setHome(""); setAway(""); setWinner(""); }
    router.refresh();
  }

  return (
    <div className="py-2 text-sm">
      <div className="flex items-center gap-2">
        <div className="flex-1 flex items-center justify-end gap-1.5 truncate"><span className="truncate">{h.name}</span> <Flag code={h.code} size={16} /></div>
        <input className="score-input !w-11 !h-9" inputMode="numeric" value={home} onChange={(e) => setHome(clamp(e.target.value))} />
        <span className="text-muted">-</span>
        <input className="score-input !w-11 !h-9" inputMode="numeric" value={away} onChange={(e) => setAway(clamp(e.target.value))} />
        <div className="flex-1 flex items-center gap-1.5 truncate"><Flag code={a.code} size={16} /> <span className="truncate">{a.name}</span></div>
        <button className="btn btn-primary py-1 px-2.5 text-xs" disabled={busy || home === "" || away === "" || (needWinner && !winner)} onClick={() => save(false)}>
          Guardar
        </button>
        {match.status === "finished" && (
          <button className="btn btn-ghost py-1 px-2.5 text-xs" disabled={busy} onClick={() => save(true)}>
            Borrar
          </button>
        )}
      </div>
      {needWinner && (
        <div className="flex items-center justify-center gap-2 mt-1.5 text-xs text-muted">
          <span>Empate — ¿quién pasa (penales)?</span>
          <select className="field !py-1 !w-auto text-xs" value={winner} onChange={(e) => setWinner(e.target.value)}>
            <option value="">Elegir…</option>
            {match.home_team_id && <option value={match.home_team_id}>{h.name}</option>}
            {match.away_team_id && <option value={match.away_team_id}>{a.name}</option>}
          </select>
        </div>
      )}
    </div>
  );
}

export default function AdminClient({ teams, matches }: { teams: Team[]; matches: Match[] }) {
  const [syncMsg, setSyncMsg] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [recomputing, setRecomputing] = useState(false);
  const router = useRouter();

  const teamById = useMemo(() => new Map(teams.map((t) => [t.id, t])), [teams]);
  const teamName = (id: number | null) => {
    const t = id ? teamById.get(id) : null;
    return { name: t?.name ?? "Por definir", code: t?.code ?? null };
  };

  const groupMatches = matches.filter((m) => m.stage === "group");
  const assignedKo = matches.filter((m) => m.stage !== "group" && m.home_team_id && m.away_team_id);

  const byGroup = useMemo(() => {
    const map = new Map<string, Match[]>();
    for (const m of groupMatches) {
      const g = m.group_letter ?? "?";
      (map.get(g) ?? map.set(g, []).get(g)!).push(m);
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [groupMatches]);

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
          También corre todos los días automáticamente.
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

      {/* Resultados reales manuales */}
      <div className="card card-top p-5">
        <h2 className="font-extrabold text-lg mb-1">Cargar resultado real (manual)</h2>
        <p className="text-sm text-muted mb-3">
          Respaldo por si la API falla. Al guardar, se recalculan los puntos y las llaves de eliminatorias.
        </p>

        {byGroup.map(([g, list]) => (
          <details key={g} className="border-t border-line py-2">
            <summary className="cursor-pointer font-bold py-1">Grupo {g}</summary>
            <div className="divide-y divide-line mt-1">
              {list.map((m) => (
                <ResultEditor key={m.id} match={m} teamName={teamName} />
              ))}
            </div>
          </details>
        ))}

        <details className="border-t border-line py-2" open>
          <summary className="cursor-pointer font-bold py-1">
            Eliminatorias {assignedKo.length === 0 && <span className="text-xs text-muted font-normal">(se habilitan cuando se definan los equipos)</span>}
          </summary>
          <div className="divide-y divide-line mt-1">
            {assignedKo.map((m) => (
              <div key={m.id}>
                <div className="text-xs text-muted pt-1">{m.round_name} · {formatKickoff(m.kickoff)}</div>
                <ResultEditor match={m} teamName={teamName} />
              </div>
            ))}
          </div>
        </details>
      </div>
    </div>
  );
}

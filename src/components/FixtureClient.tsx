"use client";
import { Fragment, useMemo, useRef, useState } from "react";
import type { MatchView, Team } from "@/lib/types";
import { computeStandings, clinchedTop2 } from "@/lib/scoring";
import { isLockedClient } from "@/lib/clientLock";
import { parseKickoffMs, arDayKey, formatLongDateAr } from "@/lib/format";
import StandingsTable from "./StandingsTable";
import MatchRow from "./MatchRow";
import Bracket from "./Bracket";
import MatchDetail from "./MatchDetail";
import MatchFullDetail from "./MatchFullDetail";
import Goleadores from "./Goleadores";

// Orden cronológico (por horario real); los que no tienen fecha van al final.
function byKickoff(a: MatchView, b: MatchView) {
  const ka = parseKickoffMs(a.kickoff);
  const kb = parseKickoffMs(b.kickoff);
  if (ka == null && kb == null) return a.ord - b.ord;
  if (ka == null) return 1;
  if (kb == null) return -1;
  return ka - kb || a.ord - b.ord;
}

// Agrupa partidos por día (hora Argentina), ascendente o descendente.
function groupByDay(list: MatchView[], descending: boolean) {
  const byDay = new Map<number, MatchView[]>();
  for (const m of list) {
    const ms = parseKickoffMs(m.kickoff);
    if (ms == null) continue;
    const k = arDayKey(ms);
    (byDay.get(k) ?? byDay.set(k, []).get(k)!).push(m);
  }
  return [...byDay.keys()]
    .sort((a, b) => (descending ? b - a : a - b))
    .map((day) => ({ day, list: byDay.get(day)!.slice().sort(byKickoff) }));
}

type SaveStatus = "saving" | "saved" | "error" | undefined;
type PredMap = Record<number, { home: string; away: string }>;

const KO_ORDER = ["r32", "r16", "qf", "sf", "third", "final"];
const KO_TITLE: Record<string, string> = {
  r32: "16avos de final",
  r16: "Octavos de final",
  qf: "Cuartos de final",
  sf: "Semifinal",
  third: "Tercer puesto",
  final: "Final",
};

export default function FixtureClient({
  teams,
  matches,
  isAdmin = false,
}: {
  teams: Team[];
  matches: MatchView[];
  isAdmin?: boolean;
}) {
  const [tab, setTab] = useState<"proximos" | "jugados" | "tablas" | "goleadores" | "llaves">("proximos");
  const [preds, setPreds] = useState<PredMap>(() => {
    const init: PredMap = {};
    for (const m of matches) {
      if (m.pred_home != null && m.pred_away != null) {
        init[m.id] = { home: String(m.pred_home), away: String(m.pred_away) };
      }
    }
    return init;
  });
  const [status, setStatus] = useState<Record<number, SaveStatus>>({});
  const timers = useRef<Record<number, ReturnType<typeof setTimeout>>>({});

  function setStat(id: number, s: SaveStatus) {
    setStatus((prev) => ({ ...prev, [id]: s }));
  }

  function onChange(matchId: number, home: string, away: string) {
    setPreds((prev) => ({ ...prev, [matchId]: { home, away } }));
    if (timers.current[matchId]) clearTimeout(timers.current[matchId]);
    if (home === "" || away === "") return;

    timers.current[matchId] = setTimeout(async () => {
      setStat(matchId, "saving");
      try {
        const res = await fetch("/api/predictions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ matchId, predHome: Number(home), predAway: Number(away) }),
        });
        if (!res.ok) throw new Error();
        setStat(matchId, "saved");
        setTimeout(() => setStat(matchId, undefined), 1500);
      } catch {
        setStat(matchId, "error");
      }
    }, 600);
  }

  // La tabla del grupo muestra SOLO los resultados reales (partidos ya jugados),
  // no los pronósticos de cada uno.
  function realResults(groupMatches: MatchView[]) {
    return groupMatches.map((m) => ({
      home_team_id: m.home_team_id,
      away_team_id: m.away_team_id,
      home_score: m.status === "finished" ? m.home_score : null,
      away_score: m.status === "finished" ? m.away_score : null,
    }));
  }

  const groups = useMemo(() => {
    const letters = [...new Set(teams.map((t) => t.group_letter))].sort();
    return letters.map((letter) => ({
      letter,
      groupTeams: teams.filter((t) => t.group_letter === letter),
      groupMatches: matches.filter((m) => m.stage === "group" && m.group_letter === letter).sort(byKickoff),
    }));
  }, [teams, matches]);

  // Los 8 mejores terceros (con los resultados reales de hoy), para pintarlos de amarillo.
  const qualifiedThirds = useMemo(() => {
    const thirds = groups
      .map(({ groupTeams, groupMatches }) => computeStandings(groupTeams, realResults(groupMatches))[2])
      .filter(Boolean);
    const ranked = [...thirds].sort(
      (a, b) => b.pts - a.pts || b.dg - a.dg || b.gf - a.gf || a.name.localeCompare(b.name)
    );
    return new Set(ranked.slice(0, 8).map((r) => r.teamId));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groups]);

  const knockout = useMemo(() => {
    const koMatches = matches.filter((m) => m.stage !== "group");
    return KO_ORDER.map((stage) => ({
      stage,
      name: KO_TITLE[stage],
      list: koMatches.filter((m) => m.stage === stage).sort(byKickoff),
    })).filter((r) => r.list.length > 0);
  }, [matches]);

  // Partidos de grupos agrupados por día: próximos (no jugados, ascendente) y jugados (descendente).
  const groupMatchesAll = useMemo(() => matches.filter((m) => m.stage === "group"), [matches]);
  const proximosDays = useMemo(
    () => groupByDay(groupMatchesAll.filter((m) => m.status !== "finished"), false),
    [groupMatchesAll]
  );
  const jugadosDays = useMemo(
    () => groupByDay(groupMatchesAll.filter((m) => m.status === "finished"), true),
    [groupMatchesAll]
  );

  function row(m: MatchView, tag?: string) {
    const p = preds[m.id];
    return (
      <MatchRow
        key={m.id}
        match={m}
        homeValue={p?.home ?? ""}
        awayValue={p?.away ?? ""}
        locked={isLockedClient(m)}
        status={status[m.id]}
        onChange={(h, a) => onChange(m.id, h, a)}
        tag={tag}
      />
    );
  }

  // Eliminatorias: visible cuando ya hay cruces con equipos, o siempre para el admin (preview).
  const hasKnockout = matches.some((m) => m.stage !== "group" && m.home_team && m.away_team);
  const showKnockout = hasKnockout || isAdmin;
  const activeTab = tab === "llaves" && !showKnockout ? "proximos" : tab;

  // Tarjeta de un día: separador de fecha + los partidos de ese día.
  const dayCard = (day: number, list: MatchView[], withDetail: boolean) => (
    <div key={day} className="card card-top p-4">
      <div className="flex items-center gap-2 mb-3 pb-2 border-b-2 border-primary/15">
        <h3 className="font-extrabold text-base sm:text-lg capitalize">{formatLongDateAr(list[0].kickoff)}</h3>
        <span className="ml-auto text-xs text-muted shrink-0">
          {list.length} {list.length === 1 ? "partido" : "partidos"}
        </span>
      </div>
      <div className="grid md:grid-cols-2 gap-x-6 divide-y md:divide-y-0 divide-line">
        {list.map((m) =>
          withDetail ? (
            <div key={m.id} className="pb-1">
              {row(m, `Grupo ${m.group_letter}`)}
              <MatchDetail matchId={m.id} />
            </div>
          ) : (
            row(m, `Grupo ${m.group_letter}`)
          )
        )}
      </div>
    </div>
  );

  return (
    <div>
      {/* Tabs (simétricos: 2 columnas en celular, una fila en PC) */}
      <div
        className={`grid grid-cols-2 ${
          showKnockout ? "sm:grid-cols-5" : "sm:grid-cols-4"
        } gap-2 mb-5 p-1.5 bg-[#e3ede8] rounded-2xl w-full max-w-sm sm:max-w-none sm:w-fit mx-auto`}
      >
        <button className={`tab ${activeTab === "proximos" ? "tab-active" : ""}`} onClick={() => setTab("proximos")}>
          📅 Próximos
        </button>
        <button className={`tab ${activeTab === "jugados" ? "tab-active" : ""}`} onClick={() => setTab("jugados")}>
          ✅ Jugados
        </button>
        <button className={`tab ${activeTab === "tablas" ? "tab-active" : ""}`} onClick={() => setTab("tablas")}>
          📊 Tablas
        </button>
        <button className={`tab ${activeTab === "goleadores" ? "tab-active" : ""}`} onClick={() => setTab("goleadores")}>
          🥅 Goleadores
        </button>
        {showKnockout && (
          <button
            className={`tab col-span-2 sm:col-span-1 ${activeTab === "llaves" ? "tab-active" : ""}`}
            onClick={() => setTab("llaves")}
          >
            🏆 Eliminatorias{!hasKnockout && isAdmin ? " 👁️" : ""}
          </button>
        )}
      </div>

      {/* Próximos partidos: en juego + por jugar, por día (ascendente) */}
      {activeTab === "proximos" && (
        <section className="space-y-5">
          {proximosDays.length === 0 ? (
            <div className="card p-6 text-center text-muted text-sm">
              No quedan partidos de grupos por jugar. Mirá los <b>Jugados</b>
              {hasKnockout ? " o las Eliminatorias" : ""}.
            </div>
          ) : (
            proximosDays.map(({ day, list }) => dayCard(day, list, false))
          )}
        </section>
      )}

      {/* Jugados: finalizados, por día (descendente) */}
      {activeTab === "jugados" && (
        <section className="space-y-5">
          {jugadosDays.length === 0 ? (
            <div className="card p-6 text-center text-muted text-sm">
              Todavía no se jugó ningún partido de grupos.
            </div>
          ) : (
            jugadosDays.map(({ day, list }) => dayCard(day, list, true))
          )}
        </section>
      )}

      {activeTab === "tablas" && (
        <section>
          <div className="flex flex-wrap justify-center gap-x-4 gap-y-1.5 text-xs text-muted mb-4">
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-3 h-3 rounded bg-emerald-500" /> Ya clasificó ✓
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-3 h-3 rounded bg-emerald-300" /> Puestos 1º y 2º
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-3 h-3 rounded bg-amber-400" /> Mejores 8 terceros (provisorio)
            </span>
          </div>
          <div className="grid lg:grid-cols-2 gap-5 items-start">
          {groups.map(({ letter, groupTeams, groupMatches }) => {
            const standings = computeStandings(groupTeams, realResults(groupMatches));
            const clinched = clinchedTop2(groupTeams, groupMatches);
            return (
              <details key={letter} className="card card-top p-4 group">
                <summary className="flex items-center gap-2 cursor-pointer list-none [&::-webkit-details-marker]:hidden">
                  <span className="grid place-items-center w-9 h-9 rounded-xl bg-primary text-white font-extrabold shadow-sm">
                    {letter}
                  </span>
                  <h2 className="font-extrabold text-lg">Grupo {letter}</h2>
                  <span className="ml-auto text-muted text-sm transition-transform group-open:rotate-180">▾</span>
                </summary>
                <div className="mt-3">
                  <StandingsTable rows={standings} qualify={2} qualifiedThirds={qualifiedThirds} clinched={clinched} />
                  <div className="mt-3 pt-1 border-t border-line">
                    {groupMatches.map((m, i) => (
                      <Fragment key={m.id}>
                        {i % 2 === 0 && (
                          <div className="text-[11px] font-bold uppercase tracking-wide text-primary/90 px-2 pt-3 pb-1">
                            Fecha {Math.floor(i / 2) + 1}
                          </div>
                        )}
                        {row(m)}
                        {m.status === "finished" && <MatchFullDetail matchId={m.id} />}
                      </Fragment>
                    ))}
                  </div>
                </div>
              </details>
            );
          })}
          </div>
        </section>
      )}

      {activeTab === "goleadores" && <Goleadores />}

      {activeTab === "llaves" && (
        <section className="space-y-5">
          <p className="text-sm text-muted text-center -mt-1">
            Las llaves se completan <b className="text-primary">automáticamente</b> con los resultados reales.
            Cuando se definan los equipos vas a poder pronosticarlas.
          </p>

          {/* Cuadro tipo llaves (pantallas grandes) */}
          <div className="hidden xl:block card card-top p-4">
            <Bracket
              matches={matches.filter((m) => m.stage !== "group")}
              preds={preds}
              status={status}
              onChange={onChange}
            />
          </div>

          {/* Lista por rondas (pantallas chicas) */}
          <div className="xl:hidden space-y-5">
            {knockout.map((r) => (
              <div key={r.stage} className="card card-top p-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="chip chip-green">{r.name}</span>
                  <span className="text-xs text-muted">{r.list.length} {r.list.length === 1 ? "partido" : "partidos"}</span>
                </div>
                <div className="grid md:grid-cols-2 gap-x-6 divide-y md:divide-y-0 divide-line">
                  {r.list.map((m) => row(m))}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

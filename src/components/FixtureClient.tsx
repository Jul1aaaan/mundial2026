"use client";
import { Fragment, useMemo, useRef, useState } from "react";
import type { MatchView, Team } from "@/lib/types";
import { computeStandings } from "@/lib/scoring";
import { isLockedClient } from "@/lib/clientLock";
import { parseKickoffMs, arDayKey, formatLongDateAr } from "@/lib/format";
import StandingsTable from "./StandingsTable";
import MatchRow from "./MatchRow";
import Bracket from "./Bracket";
import MatchDetail from "./MatchDetail";

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
}: {
  teams: Team[];
  matches: MatchView[];
}) {
  const [tab, setTab] = useState<"proximos" | "jugados" | "tablas" | "llaves">("proximos");
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

  // Eliminatorias: solo se muestra cuando ya hay cruces con equipos definidos.
  const hasKnockout = matches.some((m) => m.stage !== "group" && m.home_team && m.away_team);
  const activeTab = tab === "llaves" && !hasKnockout ? "proximos" : tab;
  const isGroupTab = activeTab === "proximos" || activeTab === "jugados" || activeTab === "tablas";

  // Tarjeta de un día: separador de fecha + los partidos de ese día.
  const dayCard = (day: number, list: MatchView[], withDetail: boolean) => (
    <div key={day} className="card card-top p-4">
      <div className="flex items-center gap-2 mb-3 pb-2 border-b-2 border-primary/15">
        <span className="text-lg">📅</span>
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
      {/* Tabs */}
      <div className="flex flex-wrap gap-2 mb-3 p-1.5 bg-[#e3ede8] rounded-full w-fit mx-auto">
        <button className={`tab ${activeTab === "proximos" ? "tab-active" : ""}`} onClick={() => setTab("proximos")}>
          📅 Próximos partidos
        </button>
        <button className={`tab ${activeTab === "jugados" ? "tab-active" : ""}`} onClick={() => setTab("jugados")}>
          ✅ Jugados
        </button>
        <button className={`tab ${activeTab === "tablas" ? "tab-active" : ""}`} onClick={() => setTab("tablas")}>
          📊 Tablas
        </button>
        {hasKnockout && (
          <button className={`tab ${activeTab === "llaves" ? "tab-active" : ""}`} onClick={() => setTab("llaves")}>
            🏆 Eliminatorias
          </button>
        )}
      </div>

      {/* Título de la sección de grupos */}
      {isGroupTab && (
        <h2 className="text-center font-extrabold text-lg text-muted/90 mb-4">⚽ Fase de grupos</h2>
      )}

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
        <section className="grid lg:grid-cols-2 gap-5 items-start">
          {groups.map(({ letter, groupTeams, groupMatches }) => {
            const standings = computeStandings(groupTeams, realResults(groupMatches));
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
                  <StandingsTable rows={standings} qualify={2} />
                  <div className="mt-3 pt-1 border-t border-line">
                    {groupMatches.map((m, i) => (
                      <Fragment key={m.id}>
                        {i % 2 === 0 && (
                          <div className="text-[11px] font-bold uppercase tracking-wide text-primary/90 px-2 pt-3 pb-1">
                            Fecha {Math.floor(i / 2) + 1}
                          </div>
                        )}
                        {row(m)}
                      </Fragment>
                    ))}
                  </div>
                </div>
              </details>
            );
          })}
        </section>
      )}

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

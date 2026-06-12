"use client";
import { Fragment, useMemo, useRef, useState } from "react";
import type { MatchView, Team } from "@/lib/types";
import { computeStandings } from "@/lib/scoring";
import { isLockedClient } from "@/lib/clientLock";
import { parseKickoffMs } from "@/lib/format";
import StandingsTable from "./StandingsTable";
import MatchRow from "./MatchRow";
import Bracket from "./Bracket";

// Orden cronológico (por horario real); los que no tienen fecha van al final.
function byKickoff(a: MatchView, b: MatchView) {
  const ka = parseKickoffMs(a.kickoff);
  const kb = parseKickoffMs(b.kickoff);
  if (ka == null && kb == null) return a.ord - b.ord;
  if (ka == null) return 1;
  if (kb == null) return -1;
  return ka - kb || a.ord - b.ord;
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
  const [tab, setTab] = useState<"grupos" | "llaves">("grupos");
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

  // Resultados para la tabla: el pronóstico del usuario, o el real si el partido ya terminó.
  function resultsFor(groupMatches: MatchView[]) {
    return groupMatches.map((m) => {
      const p = preds[m.id];
      if (p && p.home !== "" && p.away !== "") {
        return { home_team_id: m.home_team_id, away_team_id: m.away_team_id, home_score: Number(p.home), away_score: Number(p.away) };
      }
      if (m.status === "finished") {
        return { home_team_id: m.home_team_id, away_team_id: m.away_team_id, home_score: m.home_score, away_score: m.away_score };
      }
      return { home_team_id: m.home_team_id, away_team_id: m.away_team_id, home_score: null, away_score: null };
    });
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

  function row(m: MatchView) {
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
      />
    );
  }

  return (
    <div>
      {/* Tabs */}
      <div className="flex gap-2 mb-5 p-1.5 bg-[#e3ede8] rounded-full w-fit mx-auto">
        <button className={`tab ${tab === "grupos" ? "tab-active" : ""}`} onClick={() => setTab("grupos")}>
          ⚽ Fase de grupos
        </button>
        <button className={`tab ${tab === "llaves" ? "tab-active" : ""}`} onClick={() => setTab("llaves")}>
          🏆 Eliminatorias
        </button>
      </div>

      {tab === "grupos" && (
        <section className="grid lg:grid-cols-2 gap-5">
          {groups.map(({ letter, groupTeams, groupMatches }) => {
            const standings = computeStandings(groupTeams, resultsFor(groupMatches));
            return (
              <div key={letter} className="card card-top p-4">
                <div className="flex items-center gap-2 mb-3">
                  <span className="grid place-items-center w-9 h-9 rounded-xl bg-primary text-white font-extrabold shadow-sm">
                    {letter}
                  </span>
                  <h2 className="font-extrabold text-lg">Grupo {letter}</h2>
                </div>
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
            );
          })}
        </section>
      )}

      {tab === "llaves" && (
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
                  {r.list.map(row)}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

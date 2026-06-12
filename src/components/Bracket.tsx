"use client";
import type { MatchView } from "@/lib/types";
import { matchBoxState } from "@/lib/matchBox";
import { isLockedClient } from "@/lib/clientLock";
import Flag from "./Flag";

type SaveStatus = "saving" | "saved" | "error" | undefined;
type PredMap = Record<number, { home: string; away: string }>;

// Orden de las llaves en cada columna (de afuera hacia el centro), para que los
// conectores caigan alineados con cada par.
const LEFT = {
  r32: ["M74", "M77", "M73", "M75", "M83", "M84", "M81", "M82"],
  r16: ["M89", "M90", "M93", "M94"],
  qf: ["M97", "M98"],
  sf: ["M101"],
};
const RIGHT = {
  sf: ["M102"],
  qf: ["M99", "M100"],
  r16: ["M91", "M92", "M95", "M96"],
  r32: ["M76", "M78", "M79", "M80", "M86", "M88", "M85", "M87"],
};

const clamp = (v: string) => v.replace(/[^0-9]/g, "").slice(0, 2);

function BracketMatch({
  m,
  pred,
  status,
  onChange,
}: {
  m: MatchView | undefined;
  pred?: { home: string; away: string };
  status: SaveStatus;
  onChange: (home: string, away: string) => void;
}) {
  if (!m) return <div className="w-[150px] h-[52px]" />;
  const homeValue = pred?.home ?? "";
  const awayValue = pred?.away ?? "";
  const locked = isLockedClient(m);
  const s = matchBoxState(m, homeValue, awayValue, locked);

  const homeName = m.home_team?.name ?? m.home_label ?? "Por definir";
  const awayName = m.away_team?.name ?? m.away_label ?? "Por definir";
  const inputStyle = s.boxStyle ?? { background: "#f4f8f6", borderColor: "rgba(15,40,30,0.14)" };

  return (
    <div className="relative w-[150px] rounded-lg border border-line bg-surface shadow-sm overflow-hidden">
      {status === "saved" && <span className="absolute top-0.5 right-0.5 text-[9px] text-emerald-600 z-10">✓</span>}
      {s.variant === "scored" && m.points != null && (
        <span className="absolute -top-1.5 -right-1.5 text-[9px] font-bold px-1 rounded bg-emerald-600 text-white shadow z-10">
          +{m.points}
        </span>
      )}
      <div className="flex items-center gap-1.5 px-2 py-1">
        <Flag code={m.home_team?.code ?? null} size={14} />
        <span className="truncate flex-1 text-[11px] font-semibold">{homeName}</span>
        <input
          className="w-6 h-6 rounded text-center text-[11px] font-bold border outline-none disabled:opacity-50"
          style={inputStyle}
          inputMode="numeric"
          value={s.displayHome}
          readOnly={s.readOnly}
          disabled={s.disabled}
          onChange={(e) => onChange(clamp(e.target.value), awayValue)}
          aria-label={`Goles ${homeName}`}
        />
      </div>
      <div className="border-t border-line" />
      <div className="flex items-center gap-1.5 px-2 py-1">
        <Flag code={m.away_team?.code ?? null} size={14} />
        <span className="truncate flex-1 text-[11px] font-semibold">{awayName}</span>
        <input
          className="w-6 h-6 rounded text-center text-[11px] font-bold border outline-none disabled:opacity-50"
          style={inputStyle}
          inputMode="numeric"
          value={s.displayAway}
          readOnly={s.readOnly}
          disabled={s.disabled}
          onChange={(e) => onChange(homeValue, clamp(e.target.value))}
          aria-label={`Goles ${awayName}`}
        />
      </div>
    </div>
  );
}

// Columna de conectores (elbows) entre dos rondas. `count` = nº de llaves de salida.
function Connector({ count, side }: { count: number; side: "left" | "right" }) {
  const feederLeft = side === "left" ? "0%" : "50%";
  const outLeft = side === "left" ? "50%" : "0%";
  return (
    <div className="flex flex-col w-6 shrink-0">
      <div className="text-[9px] pb-1">&nbsp;</div>
      <div className="flex-1 flex flex-col">
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className="relative flex-1 min-h-[40px]">
            <span style={{ position: "absolute", top: "25%", left: feederLeft, width: "50%", height: 2, background: "var(--line)" }} />
            <span style={{ position: "absolute", top: "75%", left: feederLeft, width: "50%", height: 2, background: "var(--line)" }} />
            <span style={{ position: "absolute", top: "25%", left: "50%", width: 2, height: "50%", background: "var(--line)", marginLeft: -1 }} />
            <span style={{ position: "absolute", top: "50%", left: outLeft, width: "50%", height: 2, background: "var(--line)" }} />
          </div>
        ))}
      </div>
    </div>
  );
}

function Column({
  title,
  codes,
  byCode,
  preds,
  statusOf,
  onChangeFor,
}: {
  title: string;
  codes: string[];
  byCode: Map<string, MatchView>;
  preds: PredMap;
  statusOf: (id: number | undefined) => SaveStatus;
  onChangeFor: (m: MatchView | undefined) => (h: string, a: string) => void;
}) {
  return (
    <div className="flex flex-col shrink-0">
      <div className="text-center text-[9px] font-bold uppercase tracking-wide text-muted pb-1">{title}</div>
      <div className="flex-1 flex flex-col justify-around gap-2">
        {codes.map((code) => {
          const m = byCode.get(code);
          return (
            <BracketMatch
              key={code}
              m={m}
              pred={m ? preds[m.id] : undefined}
              status={statusOf(m?.id)}
              onChange={onChangeFor(m)}
            />
          );
        })}
      </div>
    </div>
  );
}

export default function Bracket({
  matches,
  preds,
  status,
  onChange,
}: {
  matches: MatchView[];
  preds: PredMap;
  status: Record<number, SaveStatus>;
  onChange: (matchId: number, home: string, away: string) => void;
}) {
  const byCode = new Map(matches.filter((m) => m.code).map((m) => [m.code!, m]));
  const statusOf = (id: number | undefined) => (id ? status[id] : undefined);
  const onChangeFor = (m: MatchView | undefined) => (h: string, a: string) => {
    if (m) onChange(m.id, h, a);
  };
  const colProps = { byCode, preds, statusOf, onChangeFor };
  const final = byCode.get("M104");
  const third = byCode.get("M103");

  return (
    <div className="overflow-x-auto pb-3">
      <div className="flex items-stretch min-h-[560px] min-w-[1320px] mx-auto w-fit">
        {/* IZQUIERDA */}
        <Column title="16avos" codes={LEFT.r32} {...colProps} />
        <Connector count={4} side="left" />
        <Column title="Octavos" codes={LEFT.r16} {...colProps} />
        <Connector count={2} side="left" />
        <Column title="Cuartos" codes={LEFT.qf} {...colProps} />
        <Connector count={1} side="left" />
        <Column title="Semis" codes={LEFT.sf} {...colProps} />

        {/* CENTRO */}
        <div className="flex flex-col items-center justify-center px-3 shrink-0 w-[180px]">
          <div className="text-4xl mb-1">🏆</div>
          <div className="text-[10px] font-extrabold uppercase tracking-widest text-amber-600 mb-2">Campeón</div>
          <BracketMatch m={final} pred={final ? preds[final.id] : undefined} status={statusOf(final?.id)} onChange={onChangeFor(final)} />
          <div className="text-[9px] font-bold uppercase tracking-wide text-muted mt-4 mb-1">3er puesto</div>
          <BracketMatch m={third} pred={third ? preds[third.id] : undefined} status={statusOf(third?.id)} onChange={onChangeFor(third)} />
        </div>

        {/* DERECHA */}
        <Column title="Semis" codes={RIGHT.sf} {...colProps} />
        <Connector count={1} side="right" />
        <Column title="Cuartos" codes={RIGHT.qf} {...colProps} />
        <Connector count={2} side="right" />
        <Column title="Octavos" codes={RIGHT.r16} {...colProps} />
        <Connector count={4} side="right" />
        <Column title="16avos" codes={RIGHT.r32} {...colProps} />
      </div>
    </div>
  );
}

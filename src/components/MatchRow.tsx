"use client";
import type { MatchView } from "@/lib/types";
import { formatKickoff } from "@/lib/format";
import { matchBoxState, pointsBadgeClass } from "@/lib/matchBox";
import Flag from "./Flag";

type SaveStatus = "saving" | "saved" | "error" | undefined;

// "Brian Brobbey" -> "B. Brobbey"
function abbrevName(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length < 2) return name;
  return `${parts[0][0]}. ${parts.slice(1).join(" ")}`;
}

function TeamSide({
  code,
  name,
  align,
}: {
  code: string | null;
  name: string;
  align: "left" | "right";
}) {
  return (
    <div
      className={`flex items-center gap-2 min-w-0 ${
        align === "right" ? "justify-end text-right flex-row-reverse sm:flex-row" : ""
      }`}
    >
      <Flag code={code} size={22} />
      <span className="truncate font-semibold">{name}</span>
    </div>
  );
}

export default function MatchRow({
  match,
  homeValue,
  awayValue,
  penWinner,
  locked,
  status,
  onChange,
  onPen,
  tag,
}: {
  match: MatchView;
  homeValue: string;
  awayValue: string;
  penWinner?: number | null;
  locked: boolean;
  status: SaveStatus;
  onChange: (home: string, away: string) => void;
  onPen?: (teamId: number) => void;
  tag?: string; // etiqueta opcional (ej. "Grupo J") que se muestra junto a la fecha
}) {
  const homeName = match.home_team?.name ?? match.home_label ?? "Por definir";
  const awayName = match.away_team?.name ?? match.away_label ?? "Por definir";
  const homeCode = match.home_team?.code ?? null;
  const awayCode = match.away_team?.code ?? null;
  const clamp = (v: string) => v.replace(/[^0-9]/g, "").slice(0, 2);

  const { finished, variant, displayHome, displayAway, boxStyle, readOnly, disabled } =
    matchBoxState(match, homeValue, awayValue, locked);

  // Penales: en eliminatorias, si se pronostica empate y se puede editar, se elige quién pasa.
  const isKnockout = match.stage !== "group";
  const drawPredicted = homeValue !== "" && homeValue === awayValue;
  const bothTeams = match.home_team_id != null && match.away_team_id != null;
  const showPen = isKnockout && bothTeams && drawPredicted && !readOnly && !disabled && !finished;
  const penBtn = (teamId: number, code: string | null, name: string) => (
    <button
      type="button"
      onClick={() => onPen?.(teamId)}
      className={`flex items-center gap-1 px-2 py-1 rounded-full border transition-colors ${
        penWinner === teamId
          ? "bg-primary text-white border-transparent font-bold"
          : "bg-white text-foreground border-line hover:bg-[#f1f6f3]"
      }`}
    >
      <Flag code={code} size={13} />
      <span className="truncate max-w-[7rem]">{name}</span>
    </button>
  );

  return (
    <div className="py-2.5 px-2 sm:px-3 rounded-xl hover:bg-[#f4f8f6] transition-colors">
      <div className="flex items-center justify-between text-[11px] text-muted mb-1.5 min-h-[16px]">
        <span className="flex items-center gap-2">
          {formatKickoff(match.kickoff)}
          {tag && <span className="chip chip-gray !py-0.5 !px-2 font-bold">{tag}</span>}
        </span>
        <span className="flex items-center gap-2">
          {variant === "scored" && match.points != null && (
            <span className={`px-1.5 py-0.5 rounded-md font-bold ${pointsBadgeClass(match.points)}`}>
              {match.points === 0 ? "0 pts" : `+${match.points} pts`}
            </span>
          )}
          {variant === "real" && <span className="chip chip-gray !py-0.5 !px-2">Jugado</span>}
          {locked && !finished && <span title="Cerrado">🔒</span>}
          {status === "saving" && <span className="text-muted">guardando…</span>}
          {status === "saved" && <span className="text-emerald-600 font-bold">✓</span>}
          {status === "error" && <span className="text-red-500">error</span>}
        </span>
      </div>

      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 sm:gap-3">
        <TeamSide code={homeCode} name={homeName} align="right" />
        <div className="flex items-center gap-1.5 justify-center">
          <input
            className="score-input"
            style={boxStyle}
            inputMode="numeric"
            value={displayHome}
            readOnly={readOnly}
            disabled={disabled}
            onChange={(e) => onChange(clamp(e.target.value), awayValue)}
            aria-label={`Goles ${homeName}`}
          />
          <span className="text-muted font-bold">-</span>
          <input
            className="score-input"
            style={boxStyle}
            inputMode="numeric"
            value={displayAway}
            readOnly={readOnly}
            disabled={disabled}
            onChange={(e) => onChange(homeValue, clamp(e.target.value))}
            aria-label={`Goles ${awayName}`}
          />
        </div>
        <TeamSide code={awayCode} name={awayName} align="left" />
      </div>

      {/* Penales: en eliminatorias con empate pronosticado, elegir quién pasa (+bonus si acierta) */}
      {showPen && (
        <div className="mt-2 flex flex-wrap items-center justify-center gap-1.5 text-[11px]">
          <span className="text-muted">🥅 ¿Quién pasa en penales?</span>
          {penBtn(match.home_team_id!, homeCode, homeName)}
          {penBtn(match.away_team_id!, awayCode, awayName)}
        </div>
      )}

      {/* Goles del partido (de ESPN), debajo de cada equipo */}
      {match.goals.length > 0 && (
        <div className="grid grid-cols-[1fr_auto_1fr] gap-2 sm:gap-3 mt-1.5 text-[11px] text-muted">
          <div className="space-y-0.5 text-right">
            {match.goals.filter((g) => g.code === homeCode).map((g, i) => (
              <div key={i}>
                <b className="text-foreground">{g.min.replace(/'/g, "")}&apos;</b> {abbrevName(g.scorer)}
                {g.pen ? " (P)" : ""}{g.og ? " (e/c)" : ""} ⚽
              </div>
            ))}
          </div>
          <div className="w-[5.7rem] sm:w-[6.2rem]" />
          <div className="space-y-0.5 text-left">
            {match.goals.filter((g) => g.code === awayCode).map((g, i) => (
              <div key={i}>
                ⚽ <b className="text-foreground">{g.min.replace(/'/g, "")}&apos;</b> {abbrevName(g.scorer)}
                {g.pen ? " (P)" : ""}{g.og ? " (e/c)" : ""}
              </div>
            ))}
          </div>
        </div>
      )}

      {variant === "scored" && (
        <div className="text-center text-[11px] text-muted mt-1">
          Resultado real: <b className="text-foreground">{match.home_score}-{match.away_score}</b>
        </div>
      )}
    </div>
  );
}

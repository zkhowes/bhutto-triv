"use client";

import Link from "next/link";
import Avatar from "@/components/ui/Avatar";

interface RoundInfo {
  id: string;
  number: number;
  status: string;
  isCancelled: boolean;
  atBatPlayerId?: string | null;
  onDeckPlayerId?: string | null;
  inTheHolePlayerId?: string | null;
}

interface PlayerSnippet {
  leaguePlayerId: string;
  nickname: string;
  avatarUrl: string | null;
  points: number;
}

interface GameControlProps {
  seasonNumber: number;
  gameNumber: number;
  gameId: string;
  gameStatus: string;
  rounds: RoundInfo[];
  totalRounds: number;
  mode: "league" | "game";
  leagueId?: string;
  // League mode: top 3 players
  topPlayers?: PlayerSnippet[];
  // Game mode: batting order
  battingOrder?: {
    youreUp: string;
    onDeck: string;
    inTheHole: string;
  };
  // Game mode: selected round
  selectedRoundId?: string | null;
  onRoundSelect?: (roundId: string) => void;
  // League mode: link params
  actAsParam?: string;
}

export default function GameControl({
  seasonNumber,
  gameNumber,
  gameId,
  gameStatus,
  rounds,
  totalRounds,
  mode,
  leagueId,
  topPlayers,
  battingOrder,
  selectedRoundId,
  onRoundSelect,
  actAsParam = "",
}: GameControlProps) {
  const nonCancelledRounds = rounds.filter((r) => !r.isCancelled);
  const activeRound = nonCancelledRounds.find(
    (r) => r.status !== "pending" && r.status !== "graded"
  ) || nonCancelledRounds[nonCancelledRounds.length - 1];

  return (
    <div className="round-card p-5 mb-6">
      {/* Season X Game Y header */}
      <div className="text-center mb-4">
        <p className="text-xl uppercase tracking-[0.3em] drop-shadow-[0_2px_4px_rgba(233,69,96,0.3)]">
          {mode === "league" ? (
            <>
              <span className="text-[#e94560] font-extrabold">Season </span>
              <span className="text-white font-extrabold">{seasonNumber}</span>
              <span className="text-[#a0a0b8] mx-2">&middot;</span>
              <Link href={`/games/${gameId}${actAsParam}`} className="hover:opacity-80 transition-opacity">
                <span className="text-[#e94560] font-extrabold">Game </span>
                <span className="text-white font-extrabold">{gameNumber}</span>
              </Link>
            </>
          ) : (
            <>
              {leagueId ? (
                <Link href={`/leagues/${leagueId}`} className="hover:opacity-80 transition-opacity">
                  <span className="text-[#e94560] font-extrabold">Season </span>
                  <span className="text-white font-extrabold">{seasonNumber}</span>
                </Link>
              ) : (
                <>
                  <span className="text-[#e94560] font-extrabold">Season </span>
                  <span className="text-white font-extrabold">{seasonNumber}</span>
                </>
              )}
              <span className="text-[#a0a0b8] mx-2">&middot;</span>
              <span className="text-[#e94560] font-extrabold">Game </span>
              <span className="text-white font-extrabold">{gameNumber}</span>
            </>
          )}
        </p>
      </div>

      {/* Round indicator circles */}
      <div className="mb-4">
        <p className="text-xs text-[#e94560] uppercase tracking-wider font-bold mb-2 text-center">
          Rounds
        </p>
        <div className="flex flex-wrap gap-1.5 justify-center">
          {rounds.map((r) =>
            r.isCancelled ? (
              <div
                key={r.id}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold bg-gray-800/50 text-gray-600 line-through cursor-not-allowed"
                title="Cancelled"
              >
                {r.number}
              </div>
            ) : mode === "game" ? (
              <button
                key={r.id}
                onClick={() => onRoundSelect?.(r.id)}
                className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold transition-colors ${
                  selectedRoundId === r.id
                    ? "ring-2 ring-[#e94560] ring-offset-1 ring-offset-[#0f0f23]"
                    : ""
                } ${
                  r.status === "graded"
                    ? "bg-emerald-500/20 text-emerald-400"
                    : r.status === "pending"
                      ? "bg-[#0f0f23] text-[#666680]"
                      : r.status === "under_review"
                        ? "bg-amber-500/20 text-amber-400 animate-pulse-slow"
                        : "bg-[#e94560]/20 text-[#e94560] animate-pulse-slow"
                }`}
              >
                {r.number}
              </button>
            ) : (
              <Link
                key={r.id}
                href={`/games/${gameId}?round=${r.id}${actAsParam ? `&${actAsParam.slice(1)}` : ""}`}
                className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold transition-colors ${
                  r.status === "graded"
                    ? "bg-emerald-500/20 text-emerald-400"
                    : r.status === "pending"
                      ? "bg-[#0f0f23] text-[#666680]"
                      : r.status === "under_review"
                        ? "bg-amber-500/20 text-amber-400 animate-pulse-slow"
                        : "bg-[#e94560]/20 text-[#e94560] animate-pulse-slow"
                }`}
              >
                {r.number}
              </Link>
            )
          )}
        </div>
      </div>

      {/* Play Control */}
      {mode === "league" && topPlayers && topPlayers.length > 0 && (
        <div className="border-t border-[#1e3a5f] pt-3">
          <p className="text-xs text-[#e94560] uppercase tracking-wider font-bold mb-2 text-center">
            Top 3
          </p>
          <div className="max-w-[220px] mx-auto space-y-1.5">
            {topPlayers.slice(0, 3).map((p, i) => (
              <div key={p.leaguePlayerId} className="flex items-center gap-2">
                <span className={`w-5 text-center font-bold text-xs ${
                  i === 0 ? "text-[#fbbf24]" : i === 1 ? "text-gray-300" : "text-amber-700"
                }`}>
                  {i + 1}
                </span>
                <Avatar src={p.avatarUrl} name={p.nickname} size="sm" />
                <span className="flex-1 text-white text-xs font-medium truncate">
                  {p.nickname}
                </span>
                <span className="text-xs font-mono text-[#fbbf24]">
                  {p.points}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {mode === "game" && battingOrder && (
        <div className="border-t border-[#1e3a5f] pt-3">
          <div className="flex justify-center gap-4 text-xs">
            <div className="text-center">
              <span className="text-[#e94560] font-bold block">YOU&apos;RE UP:</span>
              <span className="text-white">{battingOrder.youreUp}</span>
            </div>
            <div className="text-center">
              <span className="text-amber-400 font-bold block">ON DECK:</span>
              <span className="text-[#a0a0b8]">{battingOrder.onDeck}</span>
            </div>
            <div className="text-center">
              <span className="text-blue-400 font-bold block">IN THE HOLE:</span>
              <span className="text-[#a0a0b8]">{battingOrder.inTheHole}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

"use client";

import { useSession } from "next-auth/react";
import { useRouter, useParams, useSearchParams } from "next/navigation";
import { useState, useEffect, useCallback } from "react";
import NavBar from "@/components/layout/NavBar";
import Link from "next/link";
import Avatar from "@/components/ui/Avatar";

interface GameData {
  id: string;
  number: number;
  status: string;
  totalRounds: number;
  season: {
    id: string;
    number: number;
    league: {
      id: string;
      name: string;
      dailyDeadline: string;
      deadlineTimezone: string;
    };
  };
  rounds: Array<{
    id: string;
    number: number;
    status: string;
    isCancelled: boolean;
    atBatPlayerId: string | null;
    onDeckPlayerId: string | null;
    inTheHolePlayerId: string | null;
    question: { id: string; category: string; answerFormat: string } | null;
  }>;
  battingOrder: Array<{
    position: number;
    leaguePlayer: {
      id: string;
      fakeNickname: string | null;
      user: { id: string; nickname: string; avatarUrl: string | null; image: string | null };
    };
  }>;
  playerStates: Array<{
    leaguePlayerId: string;
    points: number;
    totalF1Points: number;
    isEliminated: boolean;
    leaguePlayer: {
      id: string;
      fakeNickname: string | null;
      user: { id: string; nickname: string; avatarUrl: string | null; image: string | null };
    };
  }>;
}

export default function GamePage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const gameId = params.id as string;
  const actAsPlayerId = searchParams.get("actAs");
  const actAsParam = actAsPlayerId ? `?actAs=${actAsPlayerId}` : "";
  const [game, setGame] = useState<GameData | null>(null);
  const [loading, setLoading] = useState(true);
  const [isCommissioner, setIsCommissioner] = useState(false);
  const [commissionerLoading, setCommissionerLoading] = useState<string | null>(null);

  const fetchGame = useCallback(async () => {
    try {
      const res = await fetch(`/api/games/${gameId}`);
      if (!res.ok) throw new Error();
      setGame(await res.json());
    } catch {
      router.push("/dashboard");
    } finally {
      setLoading(false);
    }
  }, [gameId, router]);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/");
    if (session?.user) fetchGame();
  }, [status, session, router, fetchGame]);

  // Poll for updates every 90 seconds; stop for completed games; pause when tab hidden
  useEffect(() => {
    if (!session?.user || !game) return;
    if (game.status === "completed") return; // terminal state, no more updates

    let interval: ReturnType<typeof setInterval>;

    const startPolling = () => {
      interval = setInterval(fetchGame, 90000);
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        clearInterval(interval);
      } else {
        fetchGame();
        startPolling();
      }
    };

    startPolling();
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [session, game, fetchGame]);

  // Check if user is commissioner
  useEffect(() => {
    if (!game) return;
    const leagueId = game.season.league.id;
    fetch(`/api/leagues/${leagueId}`)
      .then((res) => res.json())
      .then((data) => {
        setIsCommissioner(data.myRole === "commissioner");
      })
      .catch(() => setIsCommissioner(false));
  }, [game?.season.league.id]);

  if (status === "loading" || loading || !game) {
    return (
      <div className="min-h-screen">
        <NavBar />
        <div className="flex items-center justify-center py-20">
          <div className="animate-pulse text-[#e94560]">Loading...</div>
        </div>
      </div>
    );
  }

  const activeRound = game.rounds.find(
    (r) =>
      !r.isCancelled && r.status !== "pending" && r.status !== "graded"
  ) || game.rounds.filter((r) => !r.isCancelled).pop() || game.rounds[game.rounds.length - 1];

  const getPlayerName = (playerId: string | null) => {
    if (!playerId) return "TBD";
    const bo = game.battingOrder.find(
      (b) => b.leaguePlayer.id === playerId
    );
    return (
      bo?.leaguePlayer.fakeNickname ||
      bo?.leaguePlayer.user.nickname ||
      "Unknown"
    );
  };

  // Commissioner inline actions
  const commissionerSkipPlayer = async () => {
    if (!activeRound) return;
    setCommissionerLoading("skip");
    try {
      await fetch(`/api/rounds/${activeRound.id}/skip`, { method: "POST" });
      await fetchGame();
    } finally {
      setCommissionerLoading(null);
    }
  };

  const commissionerRevealCategory = async () => {
    if (!activeRound) return;
    setCommissionerLoading("reveal");
    try {
      await fetch(`/api/rounds/${activeRound.id}/reveal`, { method: "POST" });
      await fetchGame();
    } finally {
      setCommissionerLoading(null);
    }
  };

  const commissionerForceClose = async () => {
    if (!activeRound) return;
    if (!confirm("Force close this round? Players who haven't answered will be marked absent.")) return;
    setCommissionerLoading("force-close");
    try {
      await fetch(`/api/rounds/${activeRound.id}/force-close`, { method: "POST" });
      await fetchGame();
    } finally {
      setCommissionerLoading(null);
    }
  };

  const commissionerForceGrade = async () => {
    if (!activeRound) return;
    if (!confirm("Force grade and score this round?")) return;
    setCommissionerLoading("force-grade");
    try {
      await fetch(`/api/rounds/${activeRound.id}/close`, { method: "POST" });
      await fetchGame();
    } finally {
      setCommissionerLoading(null);
    }
  };

  const sortedStandings = [...game.playerStates].sort((a, b) =>
    game.status === "completed"
      ? b.totalF1Points - a.totalF1Points
      : b.points - a.points
  );

  return (
    <div className="min-h-screen">
      <NavBar />
      <div className="max-w-4xl mx-auto px-4 py-6">
        {/* Breadcrumb */}
        <div className="text-sm text-[#a0a0b8] mb-4">
          <Link
            href={`/leagues/${game.season.league.id}`}
            className="hover:text-white"
          >
            {game.season.league.name}
          </Link>
          <span className="mx-2">&gt;</span>
          <span className="text-white">
            Season {game.season.number} &middot; Game {game.number}
          </span>
        </div>

        {/* Round Card - Boxing style */}
        <div className="round-card p-6 mb-6">
          <div className="text-center">
            <p className="text-xs text-[#a0a0b8] uppercase tracking-[0.3em] mb-1">
              {game.status === "completed" ? "GAME COMPLETE" : "ROUND"}
            </p>
            {activeRound && game.status !== "completed" ? (
              <>
                <div className="flex items-center justify-center gap-4">
                  <span className="round-card-number">
                    {activeRound.number}
                  </span>
                  <span className="text-2xl text-[#a0a0b8]">of</span>
                  <span className="text-4xl font-bold text-[#a0a0b8]">
                    {game.totalRounds || game.rounds.filter((r) => !r.isCancelled).length}
                  </span>
                </div>
                <div className="mt-3">
                  <span
                    className={`badge text-sm px-3 py-1 ${
                      activeRound.status === "category_revealed"
                        ? "bg-emerald-500/20 text-emerald-400"
                        : activeRound.status === "awaiting_question"
                          ? "bg-amber-500/20 text-amber-400"
                          : "bg-blue-500/20 text-blue-400"
                    }`}
                  >
                    {activeRound.status.replace(/_/g, " ").toUpperCase()}
                  </span>
                </div>
                <Link
                  href={`/rounds/${activeRound.id}${actAsParam}`}
                  className="inline-block mt-3 btn-primary text-sm"
                >
                  Go to Round
                </Link>
              </>
            ) : (
              <p className="text-2xl font-bold text-[#fbbf24] mt-2">
                Final Results
              </p>
            )}
          </div>
        </div>

        {/* Inline Commissioner Controls */}
        {isCommissioner && activeRound && game.status !== "completed" && (
          <div className="card p-3 mb-4 border-[#e94560]/20">
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs font-semibold text-[#e94560] uppercase tracking-wider flex-shrink-0">
                Commissioner
              </span>
              <div className="flex flex-wrap gap-2">
                {activeRound.status === "awaiting_question" && (
                  <button
                    onClick={commissionerSkipPlayer}
                    disabled={commissionerLoading !== null}
                    className="btn-secondary text-xs"
                  >
                    {commissionerLoading === "skip" ? "Skipping..." : "Skip At-Bat Player"}
                  </button>
                )}
                {activeRound.status === "question_submitted" && (
                  <button
                    onClick={commissionerRevealCategory}
                    disabled={commissionerLoading !== null}
                    className="btn-primary text-xs"
                  >
                    {commissionerLoading === "reveal" ? "Revealing..." : "Reveal Category"}
                  </button>
                )}
                {activeRound.status === "category_revealed" && (
                  <button
                    onClick={commissionerForceClose}
                    disabled={commissionerLoading !== null}
                    className="btn-danger text-xs"
                  >
                    {commissionerLoading === "force-close" ? "Closing..." : "Force Close Round"}
                  </button>
                )}
                {activeRound.status === "closed" && (
                  <button
                    onClick={commissionerForceGrade}
                    disabled={commissionerLoading !== null}
                    className="btn-danger text-xs"
                  >
                    {commissionerLoading === "force-grade" ? "Grading..." : "Force Grade & Score"}
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          {/* Batting Order */}
          <div className="card p-4">
            <h3 className="text-xs font-semibold text-[#a0a0b8] uppercase tracking-wider mb-3">
              Batting Order
            </h3>
            {activeRound && (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <span className="text-[#e94560] font-bold text-xs w-16">
                    AT BAT
                  </span>
                  <span className="text-white text-sm font-medium">
                    {getPlayerName(activeRound.atBatPlayerId)}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-amber-400 font-bold text-xs w-16">
                    ON DECK
                  </span>
                  <span className="text-[#a0a0b8] text-sm">
                    {getPlayerName(activeRound.onDeckPlayerId)}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-blue-400 font-bold text-xs w-16">
                    IN HOLE
                  </span>
                  <span className="text-[#a0a0b8] text-sm">
                    {getPlayerName(activeRound.inTheHolePlayerId)}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Game Stats */}
          <div className="card p-4 col-span-2">
            <h3 className="text-xs font-semibold text-[#a0a0b8] uppercase tracking-wider mb-3">
              Rounds
            </h3>
            <div className="flex flex-wrap gap-2">
              {game.rounds.map((r) =>
                r.isCancelled ? (
                  <div
                    key={r.id}
                    className="w-10 h-10 rounded-lg flex items-center justify-center text-sm font-bold bg-gray-800/50 text-gray-600 line-through cursor-not-allowed"
                    title="Cancelled"
                  >
                    {r.number}
                  </div>
                ) : (
                  <Link
                    key={r.id}
                    href={`/rounds/${r.id}${actAsParam}`}
                    className={`w-10 h-10 rounded-lg flex items-center justify-center text-sm font-bold transition-colors ${
                      r.status === "graded"
                        ? "bg-emerald-500/20 text-emerald-400"
                        : r.status === "pending"
                          ? "bg-[#0f0f23] text-[#666680]"
                          : "bg-[#e94560]/20 text-[#e94560] animate-pulse-slow"
                    }`}
                  >
                    {r.number}
                  </Link>
                )
              )}
            </div>
          </div>
        </div>

        {/* Leaderboard */}
        <div className="card p-5">
          <h2 className="text-sm font-semibold text-[#a0a0b8] uppercase tracking-wider mb-4">
            Game Leaderboard
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left">
                  <th className="table-header pb-3 w-10">#</th>
                  <th className="table-header pb-3">Player</th>
                  {game.status === "completed" && (
                    <th className="table-header pb-3 text-right">
                      Season Points
                    </th>
                  )}
                  <th className="table-header pb-3 text-right">
                    Game Points
                  </th>
                  <th className="table-header pb-3 text-right">Status</th>
                </tr>
              </thead>
              <tbody>
                {sortedStandings.map((ps, i) => (
                  <tr key={ps.leaguePlayerId} className="table-row">
                    <td className="py-3">
                      <span
                        className={`font-bold ${
                          i === 0
                            ? "text-[#fbbf24]"
                            : i === 1
                              ? "text-gray-300"
                              : i === 2
                                ? "text-amber-700"
                                : "text-[#666680]"
                        }`}
                      >
                        {i + 1}
                      </span>
                    </td>
                    <td className="py-3">
                      <div className="flex items-center gap-2">
                        <Avatar
                          src={ps.leaguePlayer.user.avatarUrl || ps.leaguePlayer.user.image}
                          name={ps.leaguePlayer.fakeNickname || ps.leaguePlayer.user.nickname}
                          size="sm"
                        />
                        <span className="text-white text-sm font-medium">
                          {ps.leaguePlayer.fakeNickname ||
                            ps.leaguePlayer.user.nickname}
                        </span>
                      </div>
                    </td>
                    {game.status === "completed" && (
                      <td className="py-3 text-right">
                        <span className="font-mono font-bold text-[#fbbf24]">
                          {ps.totalF1Points}
                        </span>
                      </td>
                    )}
                    <td className="py-3 text-right">
                      <span className="font-mono text-[#a0a0b8]">
                        {ps.points}
                      </span>
                    </td>
                    <td className="py-3 text-right">
                      {ps.isEliminated ? (
                        <span className="badge-incorrect">Out</span>
                      ) : (
                        <span className="badge-correct">Active</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

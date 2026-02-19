"use client";

import { useSession } from "next-auth/react";
import { useRouter, useParams } from "next/navigation";
import { useState, useEffect, useCallback } from "react";
import NavBar from "@/components/layout/NavBar";
import Link from "next/link";
import Avatar from "@/components/ui/Avatar";
import dynamic from "next/dynamic";

const SeasonChart = dynamic(() => import("@/components/league/SeasonChart"), {
  ssr: false,
});

interface LeagueData {
  id: string;
  name: string;
  type: string;
  inviteCode: string;
  maxPlayers: number;
  gamesPerSeason: number;
  isPlayer: boolean;
  myRole: string | null;
  myPlayerId: string | null;
  players: Array<{
    id: string;
    role: string;
    isFake: boolean;
    fakeNickname: string | null;
    user: { id: string; nickname: string; avatarUrl: string | null; image: string | null; name: string };
  }>;
  seasons: Array<{
    id: string;
    number: number;
    status: string;
    games: Array<{
      id: string;
      number: number;
      status: string;
      totalRounds: number;
      rounds: Array<{ id: string; number: number; status: string; isCancelled: boolean }>;
      playerStates: Array<{
        leaguePlayerId: string;
        points: number;
        totalF1Points: number;
        leaguePlayer: {
          id: string;
          fakeNickname: string | null;
          user: { nickname: string; avatarUrl: string | null; image: string | null };
        };
      }>;
    }>;
  }>;
  seasonStandings: Array<{
    leaguePlayerId: string;
    nickname: string;
    avatarUrl: string | null;
    totalF1Points: number;
    gamesPlayed: number;
  }>;
  seasonChartData: Array<Record<string, number>>;
}

export default function LeagueDetailPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const params = useParams();
  const leagueId = params.id as string;
  const [league, setLeague] = useState<LeagueData | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [startingSeason, setStartingSeason] = useState(false);
  const [startingNextGame, setStartingNextGame] = useState(false);
  const [advancing, setAdvancing] = useState(false);
  const [advanceMessage, setAdvanceMessage] = useState("");
  const [activeTestPlayerId, setActiveTestPlayerId] = useState<string | null>(null);

  const fetchLeague = useCallback(async () => {
    try {
      const res = await fetch(`/api/leagues/${leagueId}`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setLeague(data);
    } catch {
      router.push("/dashboard");
    } finally {
      setLoading(false);
    }
  }, [leagueId, router]);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/");
    if (session?.user) fetchLeague();
  }, [status, session, router, fetchLeague]);

  const copyInviteCode = () => {
    if (!league) return;
    navigator.clipboard.writeText(league.inviteCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const startSeason = async () => {
    setStartingSeason(true);
    try {
      const res = await fetch(`/api/leagues/${leagueId}/start`, {
        method: "POST",
      });
      if (!res.ok) {
        const data = await res.json();
        alert(data.error || "Failed to start season");
        return;
      }
      await fetchLeague();
    } catch {
      alert("Failed to start season");
    } finally {
      setStartingSeason(false);
    }
  };

  const startNextGame = async () => {
    setStartingNextGame(true);
    try {
      const res = await fetch(`/api/leagues/${leagueId}/next-game`, {
        method: "POST",
      });
      if (!res.ok) {
        const data = await res.json();
        alert(data.error || "Failed to start next game");
        return;
      }
      await fetchLeague();
    } catch {
      alert("Failed to start next game");
    } finally {
      setStartingNextGame(false);
    }
  };

  const testAdvance = async (action: string = "advance") => {
    setAdvancing(true);
    setAdvanceMessage("");
    try {
      const res = await fetch(`/api/leagues/${leagueId}/test-advance`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (!res.ok) {
        setAdvanceMessage(data.error || "Failed to advance");
      } else {
        setAdvanceMessage(data.message || "Advanced!");
      }
      await fetchLeague();
    } catch (err) {
      setAdvanceMessage("Failed to advance: " + (err instanceof Error ? err.message : "unknown error"));
    } finally {
      setAdvancing(false);
    }
  };

  if (status === "loading" || loading) {
    return (
      <div className="min-h-screen">
        <NavBar />
        <div className="flex items-center justify-center py-20">
          <div className="animate-pulse text-[#e94560]">Loading...</div>
        </div>
      </div>
    );
  }

  if (!league) return null;

  // Build query string for test mode player switching
  const actAsParam = activeTestPlayerId ? `?actAs=${activeTestPlayerId}` : "";

  const currentSeason = league.seasons[0];
  const currentGame = currentSeason?.games[0];
  // Pick the first non-graded, non-cancelled round (the active one), or fall back to the last non-cancelled round
  const currentRound = currentGame?.rounds?.find(
    (r) => !r.isCancelled && r.status !== "graded"
  ) || currentGame?.rounds?.filter((r) => !r.isCancelled).pop() || currentGame?.rounds?.[currentGame.rounds.length - 1];
  const isCommissioner = league.myRole === "commissioner";
  const activeSeason = currentSeason?.status === "active";
  const hasEnoughPlayers = league.players.length >= 2;
  // Game is effectively done if completed, or active with all rounds graded/cancelled
  const gameEffectivelyDone =
    currentGame?.status === "completed" ||
    (currentGame?.status === "active" &&
      !!currentGame.rounds?.length &&
      currentGame.rounds.every((r) => r.status === "graded" || r.isCancelled));
  const canStartNextGame =
    isCommissioner &&
    activeSeason &&
    gameEffectivelyDone &&
    (currentGame?.number ?? 0) < league.gamesPerSeason;

  return (
    <div className="min-h-screen">
      <NavBar />
      <div className="max-w-4xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white">{league.name}</h1>
            <p className="text-[#a0a0b8] text-sm mt-0.5">
              {league.players.length}/{league.maxPlayers} players
              {currentSeason && ` \u00b7 Season ${currentSeason.number}`}
              {league.type === "test" && (
                <span className="ml-2 badge bg-purple-500/20 text-purple-400">
                  Test Mode
                </span>
              )}
            </p>
          </div>
          {isCommissioner && (
            <Link
              href={`/leagues/${leagueId}/commissioner`}
              className="btn-secondary text-sm"
            >
              Commissioner Tools
            </Link>
          )}
        </div>

        {/* Invite Code */}
        <div className="card p-4 mb-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-[#a0a0b8] uppercase tracking-wider">
                Invite Code
              </p>
              <p className="text-lg font-mono font-bold text-white mt-0.5">
                {league.inviteCode}
              </p>
            </div>
            <button
              onClick={copyInviteCode}
              className="btn-secondary text-sm"
            >
              {copied ? "Copied!" : "Copy"}
            </button>
          </div>
        </div>

        {/* Completed Season - Champion Display */}
        {currentSeason?.status === "completed" && league.seasonStandings.length > 0 && (
          <div className="card p-6 mb-6 text-center bg-gradient-to-br from-[#fbbf24]/10 to-[#1a1a2e]">
            <p className="text-xs text-[#a0a0b8] uppercase tracking-wider mb-2">
              Season {currentSeason.number} Complete
            </p>
            <p className="text-3xl font-bold text-[#fbbf24] mb-3">👑 Champion</p>
            <div className="flex items-center justify-center gap-3 mb-4">
              <Avatar
                src={league.seasonStandings[0].avatarUrl}
                name={league.seasonStandings[0].nickname}
                size="lg"
              />
              <div className="text-left">
                <p className="text-xl font-bold text-white">
                  {league.seasonStandings[0].nickname}
                </p>
                <p className="text-sm text-[#a0a0b8]">
                  {league.seasonStandings[0].totalF1Points} F1 Points · {league.seasonStandings[0].gamesPlayed} Games
                </p>
              </div>
            </div>
            <Link
              href={`/leagues/${leagueId}/hall-of-fame`}
              className="btn-secondary text-sm inline-block"
            >
              View Hall of Fame →
            </Link>
          </div>
        )}

        {/* Test Mode Controls */}
        {league.type === "test" && isCommissioner && (
          <div className="card p-4 mb-4 border-purple-500/30 space-y-4">
            <h3 className="text-sm font-semibold text-purple-400">
              Test Mode Controls
            </h3>

            {/* Player Switcher */}
            {league.players.length > 1 && (
              <div>
                <p className="text-xs text-[#a0a0b8] mb-1.5">Act As Player</p>
                <select
                  value={activeTestPlayerId || ""}
                  onChange={(e) => setActiveTestPlayerId(e.target.value || null)}
                  className="input-field text-sm"
                >
                  <option value="">Commissioner (you)</option>
                  {league.players.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.fakeNickname || p.user.nickname || p.user.name}
                      {p.role === "commissioner" ? " (Commissioner)" : ""}
                      {p.isFake ? " (test)" : ""}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Advance Round */}
            {activeSeason && currentRound && currentRound.status !== "graded" && (
              <div>
                <p className="text-xs text-[#a0a0b8] mb-1.5">
                  Round {currentRound.number} &mdash;{" "}
                  <span className="text-purple-400">{currentRound.status.replace(/_/g, " ")}</span>
                  {" "}&rarr;{" "}
                  <span className="text-emerald-400">
                    {currentRound.status === "awaiting_question"
                      ? "question submitted"
                      : currentRound.status === "question_submitted"
                        ? "category revealed"
                        : currentRound.status === "category_revealed"
                          ? "graded"
                          : "next"}
                  </span>
                </p>
                <div className="space-y-2">
                  <button
                    onClick={() => testAdvance("advance")}
                    disabled={advancing}
                    className="btn-primary text-xs w-full"
                  >
                    {advancing
                      ? "Advancing..."
                      : currentRound.status === "awaiting_question"
                        ? "Auto-Submit Question"
                        : currentRound.status === "question_submitted"
                          ? "Reveal Category"
                          : currentRound.status === "category_revealed"
                            ? "Auto-Bet, Answer & Grade"
                            : "Advance Stage"}
                  </button>
                  <div className="flex gap-2">
                    <button
                      onClick={() => testAdvance("complete_round")}
                      disabled={advancing}
                      className="btn-secondary text-xs flex-1"
                    >
                      Complete Round
                    </button>
                    <button
                      onClick={() => testAdvance("complete_game")}
                      disabled={advancing}
                      className="btn-secondary text-xs flex-1"
                    >
                      Complete Game
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* All rounds graded - show option to advance or start next game */}
            {activeSeason && currentGame?.status === "completed" && (
              <div>
                <p className="text-xs text-[#fbbf24] mb-1.5">
                  Game {currentGame.number} complete!
                </p>
                <button
                  onClick={() => testAdvance("start_next_game")}
                  disabled={advancing}
                  className="btn-primary text-xs w-full"
                >
                  {advancing ? "Starting..." : "Start Next Game"}
                </button>
              </div>
            )}
            {activeSeason && currentRound && currentRound.status === "graded" && currentGame?.status === "active" && (
              <div>
                <p className="text-xs text-emerald-400 mb-1.5">
                  Round {currentRound.number} graded! Refresh to see next round.
                </p>
                <button
                  onClick={fetchLeague}
                  className="btn-secondary text-xs w-full"
                >
                  Refresh
                </button>
              </div>
            )}

            {/* End Season / End League */}
            {activeSeason && (
              <div className="border-t border-purple-500/20 pt-3">
                <p className="text-xs text-[#a0a0b8] mb-1.5">Quick Complete</p>
                <div className="flex gap-2">
                  <button
                    onClick={() => testAdvance("end_season")}
                    disabled={advancing}
                    className="btn-secondary text-xs flex-1"
                  >
                    {advancing ? "Working..." : "End Season"}
                  </button>
                  <button
                    onClick={() => {
                      if (confirm("End the league? This will complete the season and deactivate the league.")) {
                        testAdvance("end_league");
                      }
                    }}
                    disabled={advancing}
                    className="text-xs flex-1 px-3 py-1.5 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors"
                  >
                    {advancing ? "Working..." : "End League"}
                  </button>
                </div>
              </div>
            )}

            {/* Advance Message */}
            {advanceMessage && (
              <p className="text-xs text-[#a0a0b8] bg-[#0f0f23] rounded-lg p-2">
                {advanceMessage}
              </p>
            )}
          </div>
        )}

        {/* Start Season / Season Complete Message */}
        {!activeSeason && (
          <>
            {currentSeason?.status === "completed" ? (
              <div className="card p-4 mb-4 text-center">
                <p className="text-[#fbbf24] text-lg mb-2">🏆 Season Complete!</p>
                <p className="text-[#a0a0b8] text-sm mb-4">
                  View the Hall of Fame to see all awards and final standings.
                </p>
                {isCommissioner && hasEnoughPlayers && (
                  <button
                    onClick={startSeason}
                    disabled={startingSeason}
                    className="btn-primary"
                  >
                    {startingSeason ? "Starting New Season..." : "Start New Season"}
                  </button>
                )}
                {!hasEnoughPlayers && (
                  <p className="text-sm text-[#666680] mt-2">
                    Need at least 2 players to start a new season.
                  </p>
                )}
              </div>
            ) : (
              <>
                {isCommissioner && hasEnoughPlayers && (
                  <button
                    onClick={startSeason}
                    disabled={startingSeason}
                    className="btn-gold w-full mb-4"
                  >
                    {startingSeason ? "Starting..." : "Start Season"}
                  </button>
                )}
                {!hasEnoughPlayers && (
                  <div className="card p-4 mb-4 text-center text-[#a0a0b8]">
                    Need at least 2 players to start. Share the invite code!
                  </div>
                )}
              </>
            )}
          </>
        )}

        {/* Active Game */}
        {currentGame && currentGame.status === "active" && (
          <div className="card p-5 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-white">
                Game {currentGame.number}
                {gameEffectivelyDone && (
                  <span className="ml-2 text-sm font-normal text-[#fbbf24]">Complete</span>
                )}
              </h2>
              <div className="flex gap-2">
                {canStartNextGame && (
                  <button
                    onClick={startNextGame}
                    disabled={startingNextGame}
                    className="btn-gold text-sm"
                  >
                    {startingNextGame ? "Starting..." : `Start Game ${currentGame.number + 1}`}
                  </button>
                )}
                <Link
                  href={`/games/${currentGame.id}${actAsParam}`}
                  className="btn-primary text-sm"
                >
                  View Game
                </Link>
              </div>
            </div>

            {/* Round Card */}
            {currentRound && (
              <div className="round-card p-4 mb-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-[#a0a0b8] uppercase tracking-wider">
                      Current Round
                    </p>
                    <p className="round-card-number">
                      {currentRound.number}
                    </p>
                    <p className="text-xs text-[#a0a0b8]">
                      of {currentGame?.totalRounds || currentGame?.rounds?.filter((r: { isCancelled: boolean }) => !r.isCancelled).length || 0}
                    </p>
                  </div>
                  <div className="text-right">
                    <span
                      className={`badge ${
                        currentRound.status === "category_revealed"
                          ? "bg-emerald-500/20 text-emerald-400"
                          : currentRound.status === "awaiting_question"
                            ? "bg-amber-500/20 text-amber-400"
                            : currentRound.status === "graded"
                              ? "bg-blue-500/20 text-blue-400"
                              : "bg-gray-500/20 text-gray-400"
                      }`}
                    >
                      {currentRound.status.replace(/_/g, " ")}
                    </span>
                    <Link
                      href={`/rounds/${currentRound.id}${actAsParam}`}
                      className="block mt-2 text-sm text-[#e94560] hover:underline"
                    >
                      Go to Round &rarr;
                    </Link>
                  </div>
                </div>
              </div>
            )}

            {/* Leaderboard */}
            {currentGame.playerStates.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-[#a0a0b8] uppercase tracking-wider mb-2">
                  Standings
                </h3>
                <div className="space-y-1">
                  {currentGame.playerStates
                    .sort((a, b) => b.points - a.points)
                    .map((ps, i) => (
                      <div
                        key={ps.leaguePlayerId}
                        className="flex items-center gap-3 py-2 px-3 rounded-lg hover:bg-[#0f0f23]/50"
                      >
                        <span
                          className={`w-6 text-center font-bold ${
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
                        <Avatar
                          src={ps.leaguePlayer.user.avatarUrl || ps.leaguePlayer.user.image}
                          name={ps.leaguePlayer.fakeNickname || ps.leaguePlayer.user.nickname}
                          size="sm"
                        />
                        <span className="flex-1 text-white text-sm font-medium">
                          {ps.leaguePlayer.fakeNickname ||
                            ps.leaguePlayer.user.nickname}
                        </span>
                        <span className="text-sm font-mono text-[#fbbf24]">
                          {ps.points} pts
                        </span>
                      </div>
                    ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Completed Game */}
        {currentGame && currentGame.status === "completed" && (
          <div className="card p-5 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-white">
                Game {currentGame.number}{" "}
                <span className="text-sm font-normal text-[#fbbf24]">Complete</span>
              </h2>
              <div className="flex gap-2">
                {canStartNextGame && (
                  <button
                    onClick={startNextGame}
                    disabled={startingNextGame}
                    className="btn-gold text-sm"
                  >
                    {startingNextGame ? "Starting..." : `Start Game ${currentGame.number + 1}`}
                  </button>
                )}
                <Link
                  href={`/games/${currentGame.id}${actAsParam}`}
                  className="btn-primary text-sm"
                >
                  View Results
                </Link>
              </div>
            </div>

            {/* Final Standings */}
            {currentGame.playerStates.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-[#a0a0b8] uppercase tracking-wider mb-2">
                  Final Standings
                </h3>
                <div className="space-y-1">
                  {currentGame.playerStates
                    .sort((a, b) => b.totalF1Points - a.totalF1Points)
                    .map((ps, i) => (
                      <div
                        key={ps.leaguePlayerId}
                        className="flex items-center gap-3 py-2 px-3 rounded-lg hover:bg-[#0f0f23]/50"
                      >
                        <span
                          className={`w-6 text-center font-bold ${
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
                        <Avatar
                          src={ps.leaguePlayer.user.avatarUrl || ps.leaguePlayer.user.image}
                          name={ps.leaguePlayer.fakeNickname || ps.leaguePlayer.user.nickname}
                          size="sm"
                        />
                        <span className="flex-1 text-white text-sm font-medium">
                          {ps.leaguePlayer.fakeNickname ||
                            ps.leaguePlayer.user.nickname}
                        </span>
                        <span className="text-sm font-mono text-[#fbbf24]">
                          {ps.totalF1Points} season pts
                        </span>
                        <span className="text-xs text-[#a0a0b8]">
                          {ps.points} bet pts
                        </span>
                      </div>
                    ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Season Standings */}
        {league.seasonStandings && league.seasonStandings.length > 0 && (
          <div className="card p-5 mb-6">
            <h2 className="text-sm font-semibold text-[#a0a0b8] uppercase tracking-wider mb-3">
              Season {currentSeason?.number} Standings
            </h2>
            <div className="space-y-1">
              {league.seasonStandings.map((ps, i) => (
                <div
                  key={ps.leaguePlayerId}
                  className="flex items-center gap-3 py-2 px-3 rounded-lg hover:bg-[#0f0f23]/50"
                >
                  <span
                    className={`w-6 text-center font-bold ${
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
                  <Avatar
                    src={ps.avatarUrl}
                    name={ps.nickname}
                    size="sm"
                  />
                  <span className="flex-1 text-white text-sm font-medium">
                    {ps.nickname}
                  </span>
                  <span className="text-sm font-mono text-[#fbbf24]">
                    {ps.totalF1Points} pts
                  </span>
                  <span className="text-xs text-[#a0a0b8]">
                    {ps.gamesPlayed} games
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Season Chart */}
        {league.seasonChartData && league.seasonChartData.length >= 2 && league.seasonStandings.length > 0 && (
          <div className="mb-6">
            <SeasonChart
              data={league.seasonChartData}
              playerNames={league.seasonStandings.map((ps) => ps.nickname)}
            />
          </div>
        )}

        {/* Players */}
        <div className="card p-5 mb-6">
          <h2 className="text-sm font-semibold text-[#a0a0b8] uppercase tracking-wider mb-3">
            Players
          </h2>
          <div className="space-y-2">
            {league.players.map((p) => (
              <div
                key={p.id}
                className="flex items-center gap-3 py-2"
              >
                <Avatar
                  src={p.user.avatarUrl || p.user.image}
                  name={p.fakeNickname || p.user.nickname || p.user.name}
                  size="sm"
                />
                <span className="flex-1 text-white text-sm">
                  {p.fakeNickname || p.user.nickname || p.user.name}
                  {p.isFake && (
                    <span className="ml-1.5 text-xs text-purple-400">(test)</span>
                  )}
                </span>
                {p.role === "commissioner" && (
                  <span className="badge bg-amber-500/20 text-amber-400 text-xs">
                    Commissioner
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Season History */}
        {league.seasons.length > 0 && (
          <div className="card p-5">
            <h2 className="text-sm font-semibold text-[#a0a0b8] uppercase tracking-wider mb-3">
              Season History
            </h2>
            <div className="space-y-2">
              {league.seasons.map((s) => (
                <div
                  key={s.id}
                  className="flex items-center justify-between py-2 border-b border-[#1e3a5f] last:border-0"
                >
                  <span className="text-white text-sm">
                    Season {s.number}
                  </span>
                  <span
                    className={`badge ${
                      s.status === "active"
                        ? "bg-emerald-500/20 text-emerald-400"
                        : s.status === "completed"
                          ? "bg-blue-500/20 text-blue-400"
                          : s.status === "paused"
                            ? "bg-amber-500/20 text-amber-400"
                            : "bg-gray-500/20 text-gray-400"
                    }`}
                  >
                    {s.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Hall of Fame link */}
        <Link
          href={`/leagues/${leagueId}/hall-of-fame`}
          className="card-hover block p-4 mt-4 text-center"
        >
          <span className="text-[#fbbf24] font-bold">&#127942; Hall of Fame</span>
          <p className="text-xs text-[#a0a0b8] mt-1">
            All-time records and statistics
          </p>
        </Link>
      </div>
    </div>
  );
}

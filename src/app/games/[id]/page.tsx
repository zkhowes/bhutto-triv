"use client";

import { useSession } from "next-auth/react";
import { useRouter, useParams, useSearchParams } from "next/navigation";
import { useState, useEffect, useCallback, useRef } from "react";
import NavBar from "@/components/layout/NavBar";
import Link from "next/link";
import Avatar from "@/components/ui/Avatar";
import dynamic from "next/dynamic";
import LeagueHeader from "@/components/game/LeagueHeader";
import GameControl from "@/components/game/GameControl";
import GuideControl from "@/components/game/GuideControl";
import RoundControl from "@/components/game/RoundControl";
import BoxScoreControl from "@/components/game/BoxScoreControl";

const GameChart = dynamic(() => import("@/components/game/GameChart"), {
  ssr: false,
});

interface GameData {
  id: string;
  number: number;
  status: string;
  totalRounds: number;
  myRole: string | null;
  myPlayerId: string | null;
  season: {
    id: string;
    number: number;
    league: {
      id: string;
      name: string;
      type: string;
      dailyDeadline: string;
      deadlineTimezone: string;
      answerTimerSeconds: number;
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

interface RoundData {
  id: string;
  number: number;
  status: string;
  funFact: string | null;
  categoryRevealAt: string | null;
  atBatPlayerId: string | null;
  onDeckPlayerId: string | null;
  inTheHolePlayerId: string | null;
  atBatAvgRating?: number | null;
  atBatRatingCount?: number;
  questionScore?: {
    avgRating: number | null;
    successRate: number | null;
    composite: number | null;
  } | null;
  question: {
    id: string;
    category: string;
    questionText: string;
    answerFormat: string;
    optionA: string | null;
    optionB: string | null;
    optionC: string | null;
    optionD: string | null;
    correctOption: string | null;
    correctAnswer: string | null;
  } | null;
  answers: Array<{
    id: string;
    leaguePlayerId: string;
    userId: string;
    betAmount: number | null;
    betPlacedAt: string | null;
    answeredAt: string | null;
    selectedOption: string | null;
    freeTextAnswer: string | null;
    isCorrect: boolean | null;
    gradedBy: string | null;
    pointsWon: number;
    f1Points: number;
    placement: number | null;
    fastestLap: boolean;
    isAbsent: boolean;
    powerUpType: string | null;
    powerUpCost: number;
    powerUpData: string | null;
    cheatSeekerData: string | null;
    questionRating: number | null;
    leaguePlayer: {
      id: string;
      fakeNickname: string | null;
      user: { id: string; nickname: string; avatarUrl: string | null; image: string | null };
    };
  }>;
  game: {
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
        type: string;
        dailyDeadline: string;
        deadlineTimezone: string;
        answerTimerSeconds: number;
      };
    };
    playerStates: Array<{
      leaguePlayerId: string;
      points: number;
      totalF1Points: number;
      leaguePlayer: {
        id: string;
        fakeNickname: string | null;
        user: { id: string; nickname: string; avatarUrl: string | null; image: string | null };
      };
    }>;
    battingOrder: Array<{
      position: number;
      leaguePlayer: {
        id: string;
        fakeNickname: string | null;
        user: { id: string; nickname: string; avatarUrl: string | null; image: string | null };
      };
    }>;
  };
}

export default function GamePage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const gameId = params.id as string;
  const actAsPlayerId = searchParams.get("actAs");
  const initialRoundId = searchParams.get("round");
  const actAsParam = actAsPlayerId ? `?actAs=${actAsPlayerId}` : "";

  const [game, setGame] = useState<GameData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedRoundId, setSelectedRoundId] = useState<string | null>(initialRoundId);
  const [roundDataCache, setRoundDataCache] = useState<Map<string, RoundData>>(new Map());
  const prevActiveRoundIdRef = useRef<string | null>(null);

  // Determine active round from game data
  const getActiveRound = useCallback((gameData: GameData) => {
    const nonCancelled = gameData.rounds.filter((r) => !r.isCancelled);
    return (
      nonCancelled.find((r) => r.status !== "pending" && r.status !== "graded") ||
      nonCancelled[nonCancelled.length - 1] ||
      gameData.rounds[gameData.rounds.length - 1]
    );
  }, []);

  const fetchRoundData = useCallback(
    async (roundId: string): Promise<RoundData | null> => {
      try {
        const roundActAs = actAsPlayerId ? `?actAs=${actAsPlayerId}` : "";
        const res = await fetch(`/api/rounds/${roundId}${roundActAs}`);
        if (!res.ok) return null;
        const data = await res.json();
        setRoundDataCache((prev) => new Map(prev).set(roundId, data));
        return data;
      } catch {
        return null;
      }
    },
    [actAsPlayerId]
  );

  const fetchGame = useCallback(async () => {
    try {
      const res = await fetch(`/api/games/${gameId}`);
      if (!res.ok) throw new Error();
      const gameData: GameData = await res.json();
      setGame(gameData);

      // Determine which round to fetch
      const activeRound = getActiveRound(gameData);
      const roundToFetch = selectedRoundId || activeRound?.id;

      // Auto-progress: if active round changed from previous poll
      if (activeRound && prevActiveRoundIdRef.current && prevActiveRoundIdRef.current !== activeRound.id) {
        // Active round moved forward, auto-select it
        setSelectedRoundId(activeRound.id);
      }
      prevActiveRoundIdRef.current = activeRound?.id || null;

      // Default to active round if no selection
      if (!selectedRoundId && activeRound) {
        setSelectedRoundId(activeRound.id);
      }

      // Fetch round data for selected/active round
      if (roundToFetch) {
        await fetchRoundData(roundToFetch);
      }

      // Fetch all graded rounds for the chart (in parallel)
      const gradedRoundIds = gameData.rounds
        .filter((r) => !r.isCancelled && r.status === "graded")
        .map((r) => r.id);
      await Promise.all(
        gradedRoundIds.map((id) => fetchRoundData(id))
      );
    } catch {
      router.push("/dashboard");
    } finally {
      setLoading(false);
    }
  }, [gameId, router, selectedRoundId, getActiveRound, fetchRoundData]);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/");
    if (session?.user) fetchGame();
  }, [status, session, router, fetchGame]);

  // Poll every 45 seconds
  useEffect(() => {
    if (!session?.user || !game) return;
    if (game.status === "completed") return;

    let interval: ReturnType<typeof setInterval>;

    const startPolling = () => {
      interval = setInterval(fetchGame, 45000);
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

  // Handle round selection changes -- fetch data if not cached
  const handleRoundSelect = useCallback(
    async (roundId: string) => {
      setSelectedRoundId(roundId);
      if (!roundDataCache.has(roundId)) {
        await fetchRoundData(roundId);
      }
    },
    [roundDataCache, fetchRoundData]
  );

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

  const league = game.season.league;
  const isCommissioner = game.myRole === "commissioner";
  const activeRound = getActiveRound(game);
  const currentRoundData = selectedRoundId ? roundDataCache.get(selectedRoundId) : null;

  // Determine myPlayerId (from game API or actAs)
  const myPlayerId = actAsPlayerId
    ? (game.playerStates.find((ps) => ps.leaguePlayerId === actAsPlayerId)?.leaguePlayerId || null)
    : game.myPlayerId;

  const myPlayerState = game.playerStates.find((ps) => ps.leaguePlayerId === myPlayerId);

  const getPlayerName = (playerId: string | null) => {
    if (!playerId) return "TBD";
    const bo = game.battingOrder.find((b) => b.leaguePlayer.id === playerId);
    return bo?.leaguePlayer.fakeNickname || bo?.leaguePlayer.user.nickname || "Unknown";
  };

  // Build batting order for GameControl
  const battingOrder = activeRound
    ? {
        youreUp: getPlayerName(activeRound.atBatPlayerId),
        onDeck: getPlayerName(activeRound.onDeckPlayerId),
        inTheHole: getPlayerName(activeRound.inTheHolePlayerId),
      }
    : undefined;

  // Build scorecard data
  const getPlayerRoundStatus = (leaguePlayerId: string): string => {
    if (!currentRoundData) return "";
    if (leaguePlayerId === currentRoundData.atBatPlayerId) {
      return currentRoundData.status === "awaiting_question" ? "You're Up" : "Question Submitted";
    }
    const answer = currentRoundData.answers.find((a) => a.leaguePlayerId === leaguePlayerId);
    if (!answer) return "Not bet";
    if (answer.isAbsent) return "Missed";
    if (answer.answeredAt) return "Answered";
    if (answer.betPlacedAt) return `Bet: ${answer.betAmount}`;
    return "Not bet";
  };

  const sortedStandings = [...game.playerStates].sort((a, b) => b.points - a.points);

  // Build game chart data: cumulative points per round
  const buildGameChartData = () => {
    const gradedRounds = game.rounds
      .filter((r) => !r.isCancelled && r.status === "graded")
      .sort((a, b) => a.number - b.number);

    if (gradedRounds.length < 2) return { data: [], playerNames: [] };

    const playerNames = game.playerStates.map(
      (ps) => ps.leaguePlayer.fakeNickname || ps.leaguePlayer.user.nickname
    );

    // We need round answer data from the cache
    const data: Array<Record<string, number>> = [];
    const cumulative: Record<string, number> = {};
    playerNames.forEach((n) => (cumulative[n] = 0));

    for (const r of gradedRounds) {
      const rd = roundDataCache.get(r.id);
      if (!rd) continue;
      const point: Record<string, number> = { round: r.number };
      for (const ps of game.playerStates) {
        const name = ps.leaguePlayer.fakeNickname || ps.leaguePlayer.user.nickname;
        const answer = rd.answers.find((a) => a.leaguePlayerId === ps.leaguePlayerId);
        cumulative[name] = (cumulative[name] || 0) + (answer?.pointsWon || 0);
        point[name] = cumulative[name];
      }
      data.push(point);
    }

    return { data, playerNames };
  };

  const chartInfo = buildGameChartData();

  // Determine if we should show round results (RoundControl + BoxScoreControl)
  const showRoundResults = currentRoundData && currentRoundData.status === "graded" && currentRoundData.question;

  // Determine which round data to use for the guide (always the active round, not selected)
  const activeRoundData = activeRound ? roundDataCache.get(activeRound.id) : null;
  // Use active round for guide unless game is completed
  const guideRoundData = game.status === "completed" ? currentRoundData : activeRoundData;

  // Find the previous graded round for "last round results" display
  const getPreviousGradedRound = () => {
    if (!activeRound || game.status === "completed") return null;
    // Only show when actively viewing the current round (not browsing history)
    if (selectedRoundId && selectedRoundId !== activeRound.id) return null;
    // Don't show if the active round itself is graded (results already visible)
    if (activeRoundData?.status === "graded") return null;
    const nonCancelled = game.rounds.filter((r) => !r.isCancelled);
    const activeIdx = nonCancelled.findIndex((r) => r.id === activeRound.id);
    // Walk backwards to find the most recent graded round
    for (let i = activeIdx - 1; i >= 0; i--) {
      if (nonCancelled[i].status === "graded") {
        return roundDataCache.get(nonCancelled[i].id) || null;
      }
    }
    return null;
  };
  const previousGradedRound = getPreviousGradedRound();

  return (
    <div className="min-h-screen">
      <NavBar />
      <div className="max-w-4xl mx-auto px-4 py-6">
        {/* Test mode banner */}
        {league.type === "test" && (
          <div className="card p-3 mb-4 border-purple-500/30 flex items-center justify-between gap-3">
            <span className="text-xs text-purple-400 font-semibold flex-shrink-0">TEST MODE</span>
            <select
              value={actAsPlayerId || ""}
              onChange={(e) => {
                const newActAs = e.target.value;
                const url = newActAs
                  ? `/games/${gameId}?actAs=${newActAs}`
                  : `/games/${gameId}`;
                router.push(url);
              }}
              className="input-field text-sm flex-1 min-w-0"
            >
              <option value="">Commissioner (you)</option>
              {game.playerStates.map((ps) => (
                <option key={ps.leaguePlayerId} value={ps.leaguePlayerId}>
                  {ps.leaguePlayer.fakeNickname || ps.leaguePlayer.user.nickname}
                </option>
              ))}
            </select>
            <Link
              href={`/leagues/${league.id}`}
              className="text-xs text-purple-400 hover:text-purple-300 flex-shrink-0"
            >
              &larr; League
            </Link>
          </div>
        )}

        {/* League Header */}
        <LeagueHeader
          leagueId={league.id}
          leagueName={league.name}
          shareType="game"
          shareEntityId={game.id}
        />

        {/* Game Control */}
        <GameControl
          seasonNumber={game.season.number}
          gameNumber={game.number}
          gameId={game.id}
          gameStatus={game.status}
          rounds={game.rounds}
          totalRounds={game.totalRounds}
          mode="game"
          leagueId={league.id}
          battingOrder={battingOrder}
          selectedRoundId={selectedRoundId}
          onRoundSelect={handleRoundSelect}
          actAsParam={actAsParam}
        />

        {/* Guide Control */}
        <GuideControl
          mode="game"
          round={guideRoundData || null}
          myPlayerId={myPlayerId}
          myPlayerState={myPlayerState ? { leaguePlayerId: myPlayerState.leaguePlayerId, points: myPlayerState.points, isEliminated: myPlayerState.isEliminated } : null}
          allPlayerStates={game.playerStates.map((ps) => ({ leaguePlayerId: ps.leaguePlayerId, points: ps.points, isEliminated: ps.isEliminated }))}
          isCommissioner={isCommissioner}
          leagueId={league.id}
          leagueType={league.type}
          answerTimerSeconds={league.answerTimerSeconds}
          actAsPlayerId={actAsPlayerId}
          onRefresh={fetchGame}
          atBatPlayerName={activeRound ? getPlayerName(activeRound.atBatPlayerId) : undefined}
          roundNumber={activeRound?.number}
          gameNumber={game.number}
        />

        {/* Previous round results (shown when a new round is active) */}
        {previousGradedRound && previousGradedRound.question && (
          <div className="mb-6">
            <p className="text-xs text-[#a0a0b8] uppercase tracking-wider mb-3">
              Last Round (Round {previousGradedRound.number})
            </p>
            <RoundControl
              round={previousGradedRound}
              myPlayerId={myPlayerId}
            />
            <div className="mt-4">
              <BoxScoreControl
                answers={previousGradedRound.answers}
                question={previousGradedRound.question}
                myPlayerId={myPlayerId}
                categoryRevealAt={previousGradedRound.categoryRevealAt}
              />
            </div>
          </div>
        )}

        {/* Round Control (graded round content) */}
        {showRoundResults && currentRoundData && (
          <div className="mb-6">
            <RoundControl
              round={currentRoundData}
              myPlayerId={myPlayerId}
            />
          </div>
        )}

        {/* Box Score Control (collapsible) */}
        {showRoundResults && currentRoundData && currentRoundData.question && (
          <div className="mb-6">
            <BoxScoreControl
              answers={currentRoundData.answers}
              question={currentRoundData.question}
              myPlayerId={myPlayerId}
              categoryRevealAt={currentRoundData.categoryRevealAt}
            />
          </div>
        )}

        {/* Score and Standings - Round Scorecard */}
        <div className="card p-5 mb-6">
          <h2 className="text-sm font-semibold text-[#a0a0b8] uppercase tracking-wider mb-4">
            Game Scorecard
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left">
                  <th className="table-header pb-3 w-10">#</th>
                  <th className="table-header pb-3">Player</th>
                  {game.status !== "completed" && currentRoundData && (
                    <th className="table-header pb-3 text-right">Status</th>
                  )}
                  <th className="table-header pb-3 text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {sortedStandings.map((ps, i) => (
                  <tr
                    key={ps.leaguePlayerId}
                    className={`table-row ${ps.leaguePlayerId === myPlayerId ? "bg-[#e94560]/5" : ""}`}
                  >
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
                          {ps.leaguePlayer.fakeNickname || ps.leaguePlayer.user.nickname}
                          {ps.leaguePlayerId === myPlayerId && (
                            <span className="text-xs text-[#e94560] ml-1">(you)</span>
                          )}
                        </span>
                      </div>
                    </td>
                    {game.status !== "completed" && currentRoundData && (
                      <td className="py-3 text-right">
                        <span className="text-xs text-[#a0a0b8]">
                          {getPlayerRoundStatus(ps.leaguePlayerId)}
                        </span>
                      </td>
                    )}
                    <td className="py-3 text-right">
                      <span className="font-mono font-bold text-[#fbbf24]">
                        {ps.points}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Game Chart */}
        {chartInfo.data.length >= 2 && (
          <div className="mb-6">
            <GameChart data={chartInfo.data} playerNames={chartInfo.playerNames} />
          </div>
        )}
      </div>
    </div>
  );
}

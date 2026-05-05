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
import { STARTING_POINTS } from "@/lib/constants";
import { CHART_COLORS } from "@/components/game/GameChart";
import AutoSkipAnnouncementModal from "@/components/ui/AutoSkipAnnouncementModal";

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
  canJoinLate: boolean;
  previousGameLastRoundId: string | null;
  season: {
    id: string;
    number: number;
    league: {
      id: string;
      name: string;
      type: string;
      answerTimerSeconds: number;
      autoSkipEnabled: boolean;
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
    startingPoints: number;
    bonusEarned: number;
    totalF1Points: number;
    isEliminated: boolean;
    blindBetUsed: boolean;
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
  updatedAt: string;
  funFact: string | null;
  categoryRevealAt: string | null;
  atBatPlayerId: string | null;
  onDeckPlayerId: string | null;
  inTheHolePlayerId: string | null;
  skippedPlayerId: string | null;
  atBatAvgRating?: number | null;
  atBatSuccessRate?: number | null;
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
    imageUrl: string | null;
    imageAttribution: string | null;
    orderingItems: string | null;
    orderingCorrectOrder: string | null;
    orderingDirection: string | null;
    orderingItemValues: string | null;
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
    isBlindBet: boolean;
    leaguePlayer: {
      id: string;
      fakeNickname: string | null;
      user: { id: string; nickname: string; avatarUrl: string | null; image: string | null };
    };
  }>;
  flagReview: {
    id: string;
    status: string;
    flaggedById: string;
    objection: string;
  } | null;
  flagUsed: boolean;
  flagWindowOpen: boolean;
  activePlayerCount: number;
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

      // Also fetch previous game's last round if available (for cross-game recap)
      const roundIdsToFetch = [...gradedRoundIds];
      if (gameData.previousGameLastRoundId && !roundIdsToFetch.includes(gameData.previousGameLastRoundId)) {
        roundIdsToFetch.push(gameData.previousGameLastRoundId);
      }

      await Promise.all(
        roundIdsToFetch.map((id) => fetchRoundData(id))
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
    const playerState = game.playerStates.find((ps) => ps.leaguePlayerId === leaguePlayerId);
    // Busted players can answer for a +1 next-game bonus, so reflect their per-round state.
    if (playerState?.isEliminated) {
      const answer = currentRoundData.answers.find((a) => a.leaguePlayerId === leaguePlayerId);
      if (!answer || answer.isAbsent) return "Busted";
      if (answer.answeredAt) {
        if (currentRoundData.status === "graded") {
          return answer.isCorrect ? "Busted ✓ (+1)" : "Busted ✗";
        }
        return "Busted (answered)";
      }
      return "Busted";
    }
    if (leaguePlayerId === currentRoundData.atBatPlayerId) {
      return currentRoundData.status === "awaiting_question" ? "You're Up" : "Question Submitted";
    }
    const answer = currentRoundData.answers.find((a) => a.leaguePlayerId === leaguePlayerId);
    if (!answer) return "Not bet";
    if (answer.isAbsent) return "Missed";
    if (answer.answeredAt) return answer.isBlindBet ? `Answered (BLIND)` : "Answered";
    if (answer.betPlacedAt) return answer.isBlindBet ? `Bet: ${answer.betAmount} (BLIND)` : `Bet: ${answer.betAmount}`;
    return "Not bet";
  };

  const sortedStandings = [...game.playerStates].sort((a, b) => b.points - a.points);

  // Build game chart data: total game points per round
  const buildGameChartData = () => {
    const gradedRounds = game.rounds
      .filter((r) => !r.isCancelled && r.status === "graded")
      .sort((a, b) => a.number - b.number);

    if (gradedRounds.length < 2) return { data: [], playerNames: [], playerAvatars: {} as Record<string, string>, playerColorMap: {} as Record<string, string> };

    const playerNames = game.playerStates.map(
      (ps) => ps.leaguePlayer.fakeNickname || ps.leaguePlayer.user.nickname
    );

    const playerAvatars: Record<string, string> = {};
    const startingByName: Record<string, number> = {};
    for (const ps of game.playerStates) {
      const name = ps.leaguePlayer.fakeNickname || ps.leaguePlayer.user.nickname;
      playerAvatars[name] = ps.leaguePlayer.user.avatarUrl || ps.leaguePlayer.user.image || "";
      // Per-player starting points (20 + carryover bonus from prior bust). Fallback for legacy data.
      startingByName[name] = ps.startingPoints ?? STARTING_POINTS;
    }

    const data: Array<Record<string, number | string>> = [];
    const cumulative: Record<string, number> = {};
    const eliminated: Record<string, boolean> = {};
    playerNames.forEach((n) => { cumulative[n] = startingByName[n]; eliminated[n] = false; });

    // Starting point
    const startPoint: Record<string, number | string> = { round: "Start" };
    playerNames.forEach((n) => (startPoint[n] = startingByName[n]));
    data.push(startPoint);

    for (const r of gradedRounds) {
      const rd = roundDataCache.get(r.id);
      if (!rd) continue;
      const point: Record<string, number | string> = { round: r.number };
      for (const ps of game.playerStates) {
        const name = ps.leaguePlayer.fakeNickname || ps.leaguePlayer.user.nickname;
        // Once eliminated (hit 0), freeze the line at 0
        if (eliminated[name]) {
          point[name] = 0;
          continue;
        }
        const answer = rd.answers.find((a) => a.leaguePlayerId === ps.leaguePlayerId);
        cumulative[name] = Math.max(0, (cumulative[name] ?? startingByName[name]) + (answer?.pointsWon || 0) - (answer?.powerUpCost || 0));
        point[name] = cumulative[name];
        if (cumulative[name] === 0) eliminated[name] = true;
      }
      data.push(point);
    }

    const playerColorMap: Record<string, string> = {};
    game.playerStates.forEach((ps, i) => {
      playerColorMap[ps.leaguePlayerId] = CHART_COLORS[i % CHART_COLORS.length];
    });

    return { data, playerNames, playerAvatars, playerColorMap };
  };

  const chartInfo = buildGameChartData();

  // Determine if we should show round results (RoundControl + BoxScoreControl)
  const showRoundResults = currentRoundData && (currentRoundData.status === "graded" || currentRoundData.status === "under_review") && currentRoundData.question;

  // Determine which round data to use for the guide (always the active round, not selected)
  const activeRoundData = activeRound ? roundDataCache.get(activeRound.id) : null;
  // Use active round for guide unless game is completed
  const guideRoundData = game.status === "completed" ? currentRoundData : activeRoundData;

  // Find the previous graded round for "last round results" display
  const getPreviousGradedRound = (): { round: RoundData; fromPreviousGame: boolean } | null => {
    if (!activeRound || game.status === "completed") return null;
    // Only show when actively viewing the current round (not browsing history)
    if (selectedRoundId && selectedRoundId !== activeRound.id) return null;
    // Don't show if the active round itself is graded (results already visible)
    if (activeRoundData?.status === "graded") return null;
    const nonCancelled = game.rounds.filter((r) => !r.isCancelled);
    const activeIdx = nonCancelled.findIndex((r) => r.id === activeRound.id);
    // Walk backwards to find the most recent graded round within this game
    for (let i = activeIdx - 1; i >= 0; i--) {
      if (nonCancelled[i].status === "graded") {
        const rd = roundDataCache.get(nonCancelled[i].id);
        return rd ? { round: rd, fromPreviousGame: false } : null;
      }
    }
    // Fall back to previous game's last round
    if (game.previousGameLastRoundId) {
      const rd = roundDataCache.get(game.previousGameLastRoundId);
      return rd ? { round: rd, fromPreviousGame: true } : null;
    }
    return null;
  };
  const previousGradedRoundInfo = getPreviousGradedRound();
  const previousGradedRound = previousGradedRoundInfo?.round ?? null;


  return (
    <div className="min-h-screen">
      <NavBar />
      <AutoSkipAnnouncementModal leagueId={league.id} />
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

        {/* Late Join Banner */}
        {game.canJoinLate && !myPlayerState && (
          <div className="card p-4 mb-4 border-amber-500/30 bg-amber-500/5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-white">Game in progress</p>
                <p className="text-xs text-[#a0a0b8]">Jump in now — you can still join until the first round is graded.</p>
              </div>
              <button
                onClick={async () => {
                  try {
                    const res = await fetch(`/api/games/${game.id}/join`, { method: "POST" });
                    if (res.ok) {
                      fetchGame();
                    } else {
                      const data = await res.json();
                      alert(data.error || "Failed to join game");
                    }
                  } catch {
                    alert("Failed to join game");
                  }
                }}
                className="btn-primary text-sm whitespace-nowrap"
              >
                Join Game
              </button>
            </div>
          </div>
        )}

        {/* League Header */}
        <LeagueHeader
          leagueId={league.id}
          leagueName={league.name}
          shareType="game"
          shareEntityId={selectedRoundId ? `${game.id}?round=${selectedRoundId}` : game.id}
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
          myPlayerState={myPlayerState ? { leaguePlayerId: myPlayerState.leaguePlayerId, points: myPlayerState.points, isEliminated: myPlayerState.isEliminated, blindBetUsed: myPlayerState.blindBetUsed, bonusEarned: myPlayerState.bonusEarned } : null}
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
          autoSkipEnabled={league.autoSkipEnabled}
          roundUpdatedAt={guideRoundData?.updatedAt}
        />

        {/* Previous round results (shown when a new round is active) */}
        {previousGradedRound && previousGradedRound.question && (
          <div className="mb-6">
            <p className="text-xs text-[#a0a0b8] uppercase tracking-wider mb-3">
              Last Round {previousGradedRoundInfo?.fromPreviousGame
                ? `(Game ${(game.number - 1)} Round ${previousGradedRound.number})`
                : `(Round ${previousGradedRound.number})`}
            </p>
            <RoundControl
              round={previousGradedRound}
              myPlayerId={myPlayerId}
              flagUsed={previousGradedRound.flagUsed}
              flagWindowOpen={previousGradedRound.flagWindowOpen}
              activePlayerCount={previousGradedRound.activePlayerCount}
              actAsPlayerId={actAsPlayerId}
              onRefresh={fetchGame}
              isCommissioner={isCommissioner}
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
              flagUsed={currentRoundData.flagUsed}
              flagWindowOpen={currentRoundData.flagWindowOpen}
              activePlayerCount={currentRoundData.activePlayerCount}
              actAsPlayerId={actAsPlayerId}
              onRefresh={fetchGame}
              isCommissioner={isCommissioner}
            />
          </div>
        )}

        {/* Box Score Control (collapsible) */}
        {showRoundResults && currentRoundData && currentRoundData.question && (
          <div className="mb-6">
            <BoxScoreControl
              answers={currentRoundData.answers}
              eliminatedPlayerIds={new Set(game.playerStates.filter((ps) => ps.isEliminated).map((ps) => ps.leaguePlayerId))}
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
                        <span
                          className="text-sm sm:text-base font-medium"
                          style={chartInfo.playerColorMap[ps.leaguePlayerId] ? { color: chartInfo.playerColorMap[ps.leaguePlayerId] } : { color: "white" }}
                        >
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
                      <span className="font-mono font-bold text-[#fbbf24] text-base">
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
            <GameChart data={chartInfo.data} playerNames={chartInfo.playerNames} playerAvatars={chartInfo.playerAvatars} />
          </div>
        )}

        {/* Season Standings Link */}
        <Link
          href={`/leagues/${league.id}`}
          className="card-hover block p-5 mb-6"
        >
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-[#a0a0b8] uppercase tracking-wider">
                Season {game.season.number} Standings
              </h3>
              <p className="text-white text-sm mt-1">
                See season standings
              </p>
            </div>
            <svg className="w-5 h-5 text-[#666680]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </div>
        </Link>
      </div>
    </div>
  );
}

"use client";

import { useSession } from "next-auth/react";
import { useRouter, useParams, useSearchParams } from "next/navigation";
import { useState, useEffect, useCallback } from "react";
import NavBar from "@/components/layout/NavBar";
import Link from "next/link";
import QuestionSubmitForm from "@/components/question/QuestionSubmitForm";
import BettingInterface from "@/components/game/BettingInterface";
import AnswerInterface from "@/components/game/AnswerInterface";
import RoundResults from "@/components/game/RoundResults";
import GradingInterface from "@/components/game/GradingInterface";
import Avatar from "@/components/ui/Avatar";

interface RoundData {
  id: string;
  number: number;
  status: string;
  funFact: string | null;
  categoryRevealAt: string | null;
  atBatPlayerId: string | null;
  onDeckPlayerId: string | null;
  inTheHolePlayerId: string | null;
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

export default function RoundPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const roundId = params.id as string;
  const actAsPlayerId = searchParams.get("actAs");
  const [round, setRound] = useState<RoundData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchRound = useCallback(async () => {
    try {
      const actAsParam = actAsPlayerId ? `?actAs=${actAsPlayerId}` : "";
      const res = await fetch(`/api/rounds/${roundId}${actAsParam}`);
      if (!res.ok) throw new Error();
      setRound(await res.json());
    } catch {
      router.push("/dashboard");
    } finally {
      setLoading(false);
    }
  }, [roundId, router, actAsPlayerId]);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/");
    if (session?.user) fetchRound();
  }, [status, session, router, fetchRound]);

  useEffect(() => {
    if (!session?.user || !round) return;
    const interval = setInterval(fetchRound, 15000);
    return () => clearInterval(interval);
  }, [session, round, fetchRound]);

  if (status === "loading" || loading || !round) {
    return (
      <div className="min-h-screen">
        <NavBar />
        <div className="flex items-center justify-center py-20">
          <div className="animate-pulse text-[#e94560]">Loading...</div>
        </div>
      </div>
    );
  }

  const league = round.game.season.league;
  // In test mode with actAs, use the selected player; otherwise match session user
  const myPlayerId = actAsPlayerId
    ? (round.game.playerStates.find(
        (ps) => ps.leaguePlayerId === actAsPlayerId
      )?.leaguePlayerId || null)
    : (round.game.playerStates.find(
        (ps) => ps.leaguePlayer.user.id === session?.user?.id
      )?.leaguePlayerId || null);

  const actingPlayerName = actAsPlayerId
    ? (round.game.playerStates.find(
        (ps) => ps.leaguePlayerId === actAsPlayerId
      )?.leaguePlayer.fakeNickname ||
      round.game.playerStates.find(
        (ps) => ps.leaguePlayerId === actAsPlayerId
      )?.leaguePlayer.user.nickname || null)
    : null;

  const isAtBat = round.atBatPlayerId === myPlayerId;
  const myAnswer = round.answers.find(
    (a) => a.leaguePlayerId === myPlayerId
  );
  const myPlayerState = round.game.playerStates.find(
    (ps) => ps.leaguePlayerId === myPlayerId
  );
  const hasBet = !!myAnswer?.betPlacedAt;
  const hasAnswered = !!myAnswer?.answeredAt;
  const isGraded = round.status === "graded";
  const isAwaitingGrading = round.status === "closed";

  // Compute answer deadline from category reveal + timer
  const answerDeadline = round.categoryRevealAt && league.answerTimerSeconds
    ? new Date(new Date(round.categoryRevealAt).getTime() + league.answerTimerSeconds * 1000).toISOString()
    : null;

  const getPlayerName = (playerId: string | null) => {
    if (!playerId) return "TBD";
    const bo = round.game.battingOrder.find(
      (b) => b.leaguePlayer.id === playerId
    );
    return (
      bo?.leaguePlayer.fakeNickname ||
      bo?.leaguePlayer.user.nickname ||
      "Unknown"
    );
  };

  // Player status for dashboard
  const getPlayerStatus = (answer: RoundData["answers"][0]) => {
    // At-bat player submitted the question, they don't bet/answer
    if (answer.leaguePlayerId === round.atBatPlayerId) {
      if (isGraded) return { icon: "\u26BE", label: "At Bat", color: "text-[#e94560]" };
      if (round.status === "awaiting_question") return { icon: "\u26BE", label: "At Bat", color: "text-[#e94560]" };
      return { icon: "\u26BE", label: "Question Submitted", color: "text-[#e94560]" };
    }
    if (isGraded) {
      if (answer.isAbsent) return { icon: "\u274C", label: "Missed", color: "text-gray-400" };
      if (answer.isCorrect) return { icon: "\u2713", label: `+${answer.pointsWon}`, color: "text-emerald-400" };
      return { icon: "\u2717", label: `${answer.pointsWon}`, color: "text-red-400" };
    }
    if (answer.isAbsent) return { icon: "\u274C", label: "Missed", color: "text-gray-400" };
    if (answer.answeredAt) return { icon: "\u23F3", label: "Answered", color: "text-blue-400" };
    if (answer.betPlacedAt) return { icon: "\uD83C\uDFB2", label: `Bet: ${answer.betAmount}`, color: "text-amber-400" };
    return { icon: "\u26A0", label: "Not bet", color: "text-gray-500" };
  };

  return (
    <div className="min-h-screen">
      <NavBar />
      <div className="max-w-4xl mx-auto px-4 py-6">
        {/* Test mode banner with player switcher */}
        {league.type === "test" && (
          <div className="card p-3 mb-4 border-purple-500/30 flex items-center justify-between gap-3">
            <span className="text-xs text-purple-400 font-semibold flex-shrink-0">TEST MODE</span>
            <select
              value={actAsPlayerId || ""}
              onChange={(e) => {
                const newActAs = e.target.value;
                const url = newActAs
                  ? `/rounds/${roundId}?actAs=${newActAs}`
                  : `/rounds/${roundId}`;
                router.push(url);
              }}
              className="input-field text-sm flex-1 min-w-0"
            >
              <option value="">Commissioner (you)</option>
              {round.game.playerStates.map((ps) => (
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

        {/* Breadcrumb */}
        <div className="text-sm text-[#a0a0b8] mb-4">
          <Link href={`/leagues/${league.id}`} className="hover:text-white">
            {league.name}
          </Link>
          <span className="mx-2">&gt;</span>
          <Link href={`/games/${round.game.id}`} className="hover:text-white">
            Game {round.game.number}
          </Link>
          <span className="mx-2">&gt;</span>
          <span className="text-white">Round {round.number}</span>
        </div>

        {/* Round Card */}
        <div className="round-card p-6 mb-6 text-center">
          <p className="text-xs text-[#a0a0b8] uppercase tracking-[0.3em]">
            ROUND
          </p>
          <div className="flex items-center justify-center gap-4">
            <span className="round-card-number">{round.number}</span>
            <span className="text-2xl text-[#a0a0b8]">of</span>
            <span className="text-4xl font-bold text-[#a0a0b8]">
              {round.game.totalRounds || round.game.playerStates.length}
            </span>
          </div>
          <div className="mt-2">
            <span
              className={`badge text-sm px-3 py-1 ${
                round.status === "category_revealed"
                  ? "bg-emerald-500/20 text-emerald-400"
                  : round.status === "awaiting_question"
                    ? "bg-amber-500/20 text-amber-400"
                    : round.status === "graded"
                      ? "bg-blue-500/20 text-blue-400"
                      : round.status === "closed"
                        ? "bg-orange-500/20 text-orange-400"
                        : "bg-gray-500/20 text-gray-400"
              }`}
            >
              {round.status === "closed" ? "AWAITING REVIEW" : round.status.replace(/_/g, " ").toUpperCase()}
            </span>
          </div>

          {/* Batting order */}
          <div className="flex justify-center gap-6 mt-4 text-xs">
            <div>
              <span className="text-[#e94560] font-bold">AT BAT: </span>
              <span className="text-white">
                {getPlayerName(round.atBatPlayerId)}
              </span>
            </div>
            <div>
              <span className="text-amber-400 font-bold">ON DECK: </span>
              <span className="text-[#a0a0b8]">
                {getPlayerName(round.onDeckPlayerId)}
              </span>
            </div>
            <div>
              <span className="text-blue-400 font-bold">IN HOLE: </span>
              <span className="text-[#a0a0b8]">
                {getPlayerName(round.inTheHolePlayerId)}
              </span>
            </div>
          </div>
        </div>

        {/* Category display (when revealed) */}
        {round.question && (round.status === "category_revealed" || isGraded || isAwaitingGrading) && (
          <div className="card p-4 mb-4 text-center">
            <p className="text-xs text-[#a0a0b8] uppercase tracking-wider">
              Category
            </p>
            <p className="text-xl font-bold text-[#fbbf24] mt-1">
              {round.question.category}
            </p>
          </div>
        )}

        {/* Action Area */}
        <div className="mb-6">
          {/* At Bat: Submit Question */}
          {isAtBat && round.status === "awaiting_question" && myPlayerId && (
            <QuestionSubmitForm
              roundId={round.id}
              leaguePlayerId={myPlayerId}
              onSubmitted={fetchRound}
            />
          )}

          {/* Eliminated player message */}
          {!isGraded &&
            !isAwaitingGrading &&
            !isAtBat &&
            myPlayerState &&
            myPlayerState.points === 0 &&
            !hasBet && (
              <div className="card p-6 text-center">
                <p className="text-lg font-bold text-red-400 mb-2">
                  Eliminated
                </p>
                <p className="text-[#a0a0b8]">
                  You&apos;ve run out of points for this game. You can still view questions and results.
                </p>
              </div>
            )}

          {/* Betting Phase */}
          {!isGraded &&
            !isAtBat &&
            round.question &&
            (round.status === "category_revealed" || round.status === "question_submitted") &&
            !hasBet &&
            myPlayerId &&
            myPlayerState &&
            myPlayerState.points > 0 && (
              <BettingInterface
                roundId={round.id}
                leaguePlayerId={myPlayerId}
                maxPoints={myPlayerState.points}
                category={round.question.category}
                answerDeadline={answerDeadline}
                onBetPlaced={fetchRound}
              />
            )}

          {/* Answer Phase */}
          {!isGraded && !isAtBat && hasBet && !hasAnswered && round.question && myPlayerId && (
            <AnswerInterface
              roundId={round.id}
              leaguePlayerId={myPlayerId}
              question={round.question}
              betAmount={myAnswer?.betAmount || 0}
              answerDeadline={answerDeadline}
              onAnswered={fetchRound}
            />
          )}

          {/* At Bat - grading review */}
          {isAwaitingGrading && isAtBat && round.question && (
            <GradingInterface
              roundId={round.id}
              answers={round.answers}
              question={round.question}
              atBatPlayerId={round.atBatPlayerId}
              onGradingComplete={fetchRound}
            />
          )}

          {/* Non-at-bat waiting for grading review */}
          {isAwaitingGrading && !isAtBat && (
            <div className="card p-6 text-center">
              <p className="text-lg font-bold text-orange-400 mb-2">
                Awaiting Review
              </p>
              <p className="text-[#a0a0b8]">
                Waiting for the question creator to review and confirm grades...
              </p>
            </div>
          )}

          {/* At Bat - you submitted the question */}
          {!isGraded && !isAwaitingGrading && isAtBat && round.status !== "awaiting_question" && (
            <div className="card p-6 text-center">
              <p className="text-lg font-bold text-[#e94560] mb-2">
                You&apos;re At Bat!
              </p>
              <p className="text-[#a0a0b8]">
                You submitted the question for this round. Waiting for other players to bet and answer...
              </p>
            </div>
          )}

          {/* Waiting for results */}
          {!isGraded && !isAwaitingGrading && !isAtBat && hasAnswered && (
            <div className="card p-6 text-center">
              <p className="text-lg font-bold text-white mb-2">
                Answer Submitted!
              </p>
              <p className="text-[#a0a0b8]">
                Waiting for all players and round close...
              </p>
              <p className="text-sm text-[#666680] mt-2">
                Your bet: {myAnswer?.betAmount} points
              </p>
            </div>
          )}

          {/* Results */}
          {isGraded && (
            <>
              <RoundResults
                round={round}
                myPlayerId={myPlayerId || null}
              />

              {/* Game complete or next round link */}
              {round.game.status === "completed" ? (
                <Link
                  href={`/games/${round.game.id}${actAsPlayerId ? `?actAs=${actAsPlayerId}` : ""}`}
                  className="btn-gold w-full text-center block mt-4"
                >
                  View Game Results
                </Link>
              ) : (
                <Link
                  href={`/games/${round.game.id}${actAsPlayerId ? `?actAs=${actAsPlayerId}` : ""}`}
                  className="btn-primary w-full text-center block mt-4"
                >
                  Continue to Next Round
                </Link>
              )}
            </>
          )}
        </div>

        {/* Player Status Dashboard */}
        <div className="card p-5">
          <h2 className="text-sm font-semibold text-[#a0a0b8] uppercase tracking-wider mb-3">
            Player Status
          </h2>
          <div className="space-y-2">
            {round.game.playerStates.map((ps) => {
              const answer = round.answers.find(
                (a) => a.leaguePlayerId === ps.leaguePlayerId
              );
              const playerStatus = ps.leaguePlayerId === round.atBatPlayerId
                ? (round.status === "awaiting_question"
                    ? { icon: "\u26BE", label: "At Bat", color: "text-[#e94560]" }
                    : { icon: "\u26BE", label: "Question Submitted", color: "text-[#e94560]" })
                : ps.points === 0
                  ? { icon: "\uD83D\uDCA5", label: "Busted", color: "text-red-500" }
                  : answer
                    ? getPlayerStatus(answer)
                    : {
                        icon: "\u26A0",
                        label: "Not bet",
                        color: "text-gray-500",
                      };
              const playerName =
                ps.leaguePlayer.fakeNickname ||
                ps.leaguePlayer.user.nickname;

              return (
                <div
                  key={ps.leaguePlayerId}
                  className="flex items-center gap-3 py-2 px-3 rounded-lg hover:bg-[#0f0f23]/50"
                >
                  <Avatar
                    src={ps.leaguePlayer.user.avatarUrl || ps.leaguePlayer.user.image}
                    name={playerName}
                    size="sm"
                  />
                  <span className="flex-1 text-white text-sm font-medium">
                    {playerName}
                    {ps.leaguePlayerId === myPlayerId && (
                      <span className="ml-1 text-xs text-[#e94560]">(you)</span>
                    )}
                  </span>
                  <span className={`text-sm font-medium ${playerStatus.color}`}>
                    {playerStatus.icon} {playerStatus.label}
                  </span>
                  {isGraded && answer?.fastestLap && (
                    <span className="text-xs text-purple-400">
                      &#9889; Fastest
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

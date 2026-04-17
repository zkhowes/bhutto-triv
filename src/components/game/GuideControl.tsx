"use client";

import { useState } from "react";
import Link from "next/link";
import QuestionSubmitForm from "@/components/question/QuestionSubmitForm";
import BettingInterface from "@/components/game/BettingInterface";
import AnswerInterface from "@/components/game/AnswerInterface";
import GradingInterface from "@/components/game/GradingInterface";
import FlagReviewInterface from "@/components/game/FlagReviewInterface";
import AutoSkipCountdown from "@/components/game/AutoSkipCountdown";

interface RoundData {
  id: string;
  number: number;
  status: string;
  categoryRevealAt: string | null;
  atBatPlayerId: string | null;
  skippedPlayerId: string | null;
  atBatAvgRating?: number | null;
  atBatSuccessRate?: number | null;
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
    isBlindBet?: boolean;
    leaguePlayer: {
      id: string;
      fakeNickname: string | null;
      user: { id: string; nickname: string; avatarUrl: string | null; image: string | null };
    };
  }>;
}

interface PlayerState {
  leaguePlayerId: string;
  points: number;
  isEliminated: boolean;
  blindBetUsed?: boolean;
}

// League mode props
interface LeagueGuideProps {
  mode: "league";
  gameId?: string;
  gameStatus?: string;
  roundStatus?: string | null;
  canStartNextGame?: boolean;
  startingNextGame?: boolean;
  onStartNextGame?: () => void;
  nextGameNumber?: number;
  actAsParam?: string;
  leagueId?: string;
}

// Game mode props
interface GameGuideProps {
  mode: "game";
  round: RoundData | null;
  myPlayerId: string | null;
  myPlayerState: PlayerState | null;
  allPlayerStates: PlayerState[];
  isCommissioner: boolean;
  leagueId: string;
  leagueType: string;
  answerTimerSeconds: number;
  actAsPlayerId: string | null;
  onRefresh: () => void;
  atBatPlayerName?: string;
  roundNumber?: number;
  gameNumber?: number;
  autoSkipEnabled?: boolean;
  roundUpdatedAt?: string;
}

type GuideControlProps = LeagueGuideProps | GameGuideProps;

export default function GuideControl(props: GuideControlProps) {
  const [editingGrades, setEditingGrades] = useState(false);
  const [revertingSkip, setRevertingSkip] = useState(false);

  // League mode
  if (props.mode === "league") {
    const { gameId, gameStatus, roundStatus, canStartNextGame, startingNextGame, onStartNextGame, nextGameNumber, actAsParam = "", leagueId } = props;

    if (canStartNextGame && onStartNextGame) {
      return (
        <div className="card p-5 mb-6 text-center">
          <p className="text-lg font-bold text-[#e94560] mb-2">
            Game Complete
          </p>
          <button
            onClick={onStartNextGame}
            disabled={startingNextGame}
            className="btn-gold text-sm"
          >
            {startingNextGame ? "Starting..." : `Start Game ${nextGameNumber}`}
          </button>
        </div>
      );
    }

    if (gameStatus === "active" || gameStatus === "in_progress") {
      return (
        <div className="card p-5 mb-6 text-center">
          <p className="text-lg font-bold text-[#e94560] mb-2">
            Game is in progress
          </p>
          {gameId && (
            <Link
              href={`/games/${gameId}${actAsParam}`}
              className="btn-primary text-sm inline-block"
            >
              View Game
            </Link>
          )}
        </div>
      );
    }

    if (gameStatus === "completed" && leagueId) {
      return (
        <div className="card p-5 mb-6 text-center">
          <p className="text-lg font-bold text-[#fbbf24] mb-2">
            Season Complete
          </p>
          <Link
            href={`/leagues/${leagueId}/hall-of-fame`}
            className="btn-secondary text-sm inline-block"
          >
            View Hall of Fame
          </Link>
        </div>
      );
    }

    return null;
  }

  // Game mode
  const {
    round,
    myPlayerId,
    myPlayerState,
    allPlayerStates,
    isCommissioner,
    leagueId,
    leagueType,
    answerTimerSeconds,
    actAsPlayerId,
    onRefresh,
    atBatPlayerName,
    roundNumber,
    gameNumber,
    autoSkipEnabled,
    roundUpdatedAt,
  } = props;

  if (!round) return null;

  const isAtBat = round.atBatPlayerId === myPlayerId;
  const myAnswer = round.answers.find((a) => a.leaguePlayerId === myPlayerId);
  const hasBet = !!myAnswer?.betPlacedAt;
  const hasAnswered = !!myAnswer?.answeredAt;
  const isGraded = round.status === "graded";

  const answerDeadline =
    round.categoryRevealAt && answerTimerSeconds
      ? new Date(new Date(round.categoryRevealAt).getTime() + answerTimerSeconds * 1000).toISOString()
      : null;

  const showAutoSkipTimer = autoSkipEnabled && roundUpdatedAt && !isGraded && round.status !== "cancelled";

  const actAsParam = actAsPlayerId ? `?actAs=${actAsPlayerId}` : "";

  // Under review -> flag review interface
  if (round.status === "under_review") {
    const roundContext = round.question ? {
      questionText: round.question.questionText,
      correctAnswer: round.question.correctAnswer,
      category: round.question.category,
      answers: round.answers
        .filter((a) => a.leaguePlayerId !== round.atBatPlayerId && !a.isAbsent)
        .map((a) => ({
          leaguePlayerId: a.leaguePlayerId,
          nickname: a.leaguePlayer.fakeNickname || a.leaguePlayer.user.nickname,
          freeTextAnswer: a.freeTextAnswer,
          selectedOption: a.selectedOption,
          isCorrect: a.isCorrect,
          pointsWon: a.pointsWon,
        })),
    } : null;

    return (
      <FlagReviewInterface
        roundId={round.id}
        myPlayerId={myPlayerId}
        isCommissioner={isCommissioner}
        actAsPlayerId={actAsPlayerId}
        roundContext={roundContext}
        onResolved={onRefresh}
      />
    );
  }

  // Graded -> contextual message
  if (isGraded) {
    if (editingGrades && isCommissioner && round.question) {
      return (
        <div className="mb-6">
          <div className="mb-4 p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg">
            <p className="text-sm text-amber-400 font-medium">
              ⚠️ Editing completed round
            </p>
            <p className="text-xs text-[#a0a0b8] mt-1">
              Changes will recalculate scores and may affect standings.
            </p>
          </div>
          <GradingInterface
            roundId={round.id}
            answers={round.answers}
            question={round.question}
            atBatPlayerId={round.atBatPlayerId}
            categoryRevealAt={round.categoryRevealAt}
            onGradingComplete={() => {
              setEditingGrades(false);
              onRefresh();
            }}
          />
          <button
            onClick={() => setEditingGrades(false)}
            className="btn-secondary text-sm w-full mt-3"
          >
            Cancel
          </button>
        </div>
      );
    }

    return (
      <div className="card p-5 mb-6 text-center">
        <p className="text-lg font-bold text-[#e94560] mb-1">
          Round {round.number} Complete
        </p>
        <p className="text-sm text-[#a0a0b8]">
          View results below
        </p>
        {isCommissioner && round.question && (
          <button
            onClick={() => setEditingGrades(true)}
            className="btn-secondary text-xs mt-3"
          >
            ✏️ Edit Grades
          </button>
        )}
      </div>
    );
  }

  // Undo Skip button for commissioners (first skip: awaiting_question with no question, second skip: cancelled)
  const canRevertSkip = isCommissioner && round.skippedPlayerId && (
    (round.status === "awaiting_question" && !round.question) ||
    round.status === "cancelled"
  );

  const handleRevertSkip = async () => {
    setRevertingSkip(true);
    try {
      const res = await fetch(`/api/rounds/${round.id}/revert-skip`, { method: "POST" });
      if (!res.ok) {
        const data = await res.json();
        alert(data.error || "Failed to undo skip");
      }
      onRefresh();
    } catch {
      alert("Failed to undo skip");
    } finally {
      setRevertingSkip(false);
    }
  };

  // Cancelled round with revertible skip
  if (round.status === "cancelled" && canRevertSkip) {
    return (
      <div className="card p-5 mb-6 text-center">
        <p className="text-lg font-bold text-red-400 mb-2">
          Round Cancelled
        </p>
        <p className="text-[#a0a0b8] text-sm mb-3">
          This round was cancelled due to a player skip.
        </p>
        <button
          onClick={handleRevertSkip}
          disabled={revertingSkip}
          className="btn-secondary text-xs"
        >
          {revertingSkip ? "Reverting..." : "Undo Skip"}
        </button>
      </div>
    );
  }

  // At bat: submit question
  if (isAtBat && round.status === "awaiting_question" && myPlayerId) {
    return (
      <div className="mb-6">
        {showAutoSkipTimer && <AutoSkipCountdown roundUpdatedAt={roundUpdatedAt!} />}
        <QuestionSubmitForm
          roundId={round.id}
          leaguePlayerId={myPlayerId}
          leagueId={leagueId}
          onSubmitted={onRefresh}
        />
        {canRevertSkip && (
          <button
            onClick={handleRevertSkip}
            disabled={revertingSkip}
            className="btn-secondary text-xs w-full mt-3"
          >
            {revertingSkip ? "Reverting..." : "Undo Skip"}
          </button>
        )}
      </div>
    );
  }

  // At bat: waiting for others
  if (isAtBat && !isGraded && round.status !== "awaiting_question") {
    return (
      <div className="card p-5 mb-6 text-center">
        <p className="text-lg font-bold text-[#e94560] mb-2">
          You&apos;re Up!
        </p>
        <p className="text-[#a0a0b8]">
          You submitted the question for this round. Waiting for other players to bet and answer...
        </p>
        {showAutoSkipTimer && (
          <div className="flex justify-center">
            <AutoSkipCountdown roundUpdatedAt={roundUpdatedAt!} />
          </div>
        )}
      </div>
    );
  }

  // Eliminated player
  if (!isGraded && !isAtBat && myPlayerState && myPlayerState.points === 0 && !hasBet) {
    return (
      <div className="card p-5 mb-6 text-center">
        <p className="text-lg font-bold text-red-400 mb-2">
          Eliminated
        </p>
        <p className="text-[#a0a0b8]">
          You&apos;ve run out of points for this game. You can still view questions and results.
        </p>
      </div>
    );
  }

  // Betting phase
  if (
    !isGraded &&
    !isAtBat &&
    round.question &&
    (round.status === "category_revealed" || round.status === "question_submitted") &&
    !hasBet &&
    myPlayerId &&
    myPlayerState &&
    myPlayerState.points > 0
  ) {
    return (
      <div className="mb-6">
        <BettingInterface
          roundId={round.id}
          leaguePlayerId={myPlayerId}
          maxPoints={myPlayerState.points}
          category={round.question.category}
          answerFormat={round.question.answerFormat}
          answerDeadline={answerDeadline}
          atBatAvgRating={round.atBatAvgRating}
          atBatSuccessRate={round.atBatSuccessRate}
          onBetPlaced={onRefresh}
          roundStatus={round.status}
          blindBetUsed={myPlayerState.blindBetUsed ?? false}
          isAtBat={isAtBat}
        />
      </div>
    );
  }

  // Answer phase
  if (!isGraded && !isAtBat && hasBet && !hasAnswered && round.question && myPlayerId) {
    return (
      <div className="mb-6">
        <AnswerInterface
          roundId={round.id}
          leaguePlayerId={myPlayerId}
          question={round.question}
          betAmount={myAnswer?.betAmount || 0}
          playerPoints={myPlayerState?.points ?? 0}
          allActivePoints={allPlayerStates
            .filter((ps) => ps.points > 0)
            .map((ps) => ps.points)}
          answerDeadline={answerDeadline}
          roundStatus={round.status}
          powerUpType={myAnswer?.powerUpType ?? null}
          actAsPlayerId={actAsPlayerId}
          onAnswered={onRefresh}
        />
      </div>
    );
  }


  // Answered, waiting for round close
  if (!isGraded && !isAtBat && hasAnswered) {
    return (
      <div className="card p-5 mb-6 text-center">
        <p className="text-lg font-bold text-[#e94560] mb-2">
          Answer Submitted!
        </p>
        <p className="text-[#a0a0b8]">
          Waiting for all players and round close...
        </p>
        <p className="text-sm text-[#666680] mt-2">
          Your bet: {myAnswer?.betAmount} points
        </p>
        {showAutoSkipTimer && (
          <div className="flex justify-center">
            <AutoSkipCountdown roundUpdatedAt={roundUpdatedAt!} />
          </div>
        )}
      </div>
    );
  }

  // Category display (standalone when no other action applies)
  if (round.question && round.status === "category_revealed" && !isAtBat) {
    return (
      <div className="card p-4 mb-6 text-center">
        <p className="text-xs text-[#a0a0b8] uppercase tracking-wider">Category</p>
        <p className="text-xl font-bold text-[#fbbf24] mt-1">
          {round.question.category}
        </p>
      </div>
    );
  }

  // Awaiting question from another player -- welcome message
  if (round.status === "awaiting_question" && !isAtBat) {
    const isFirstRound = roundNumber === 1;
    return (
      <div className="card p-5 mb-6 text-center">
        <p className="text-lg font-bold text-[#e94560] mb-2">
          {isFirstRound
            ? `Welcome to Game ${gameNumber ?? ""}!`
            : `Round ${roundNumber ?? round.number}`}
        </p>
        <p className="text-[#a0a0b8]">
          Waiting for <span className="text-white font-medium">{atBatPlayerName || "the next player"}</span> to submit a question...
        </p>
        <p className="text-xs text-[#666680] mt-2">
          You&apos;ll be able to bet and answer once the question is in.
        </p>
        {showAutoSkipTimer && (
          <div className="flex justify-center">
            <AutoSkipCountdown roundUpdatedAt={roundUpdatedAt!} />
          </div>
        )}
        {canRevertSkip && (
          <button
            onClick={handleRevertSkip}
            disabled={revertingSkip}
            className="btn-secondary text-xs mt-3"
          >
            {revertingSkip ? "Reverting..." : "Undo Skip"}
          </button>
        )}
      </div>
    );
  }

  // Question submitted but no action needed yet (e.g. at-bat player viewing question_submitted)
  if (round.status === "question_submitted" && !isAtBat && !round.question) {
    return (
      <div className="card p-5 mb-6 text-center">
        <p className="text-lg font-bold text-[#e94560] mb-2">
          Question Submitted
        </p>
        <p className="text-[#a0a0b8]">
          A question has been submitted. Waiting for category reveal...
        </p>
      </div>
    );
  }

  return null;
}

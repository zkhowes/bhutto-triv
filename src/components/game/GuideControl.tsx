"use client";

import { useState } from "react";
import Link from "next/link";
import QuestionSubmitForm from "@/components/question/QuestionSubmitForm";
import BettingInterface from "@/components/game/BettingInterface";
import AnswerInterface from "@/components/game/AnswerInterface";
import GradingInterface from "@/components/game/GradingInterface";
import FlagReviewInterface from "@/components/game/FlagReviewInterface";
import FixAndRegradeModal from "@/components/game/FixAndRegradeModal";
import AutoSkipCountdown from "@/components/game/AutoSkipCountdown";
import ReviewProposalBanner from "@/components/game/ReviewProposalBanner";

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
    orderingItemValues: string | null;
    pendingReviewProposal?: string | null;
    pendingReviewNotes?: string | null;
    pendingReviewConfidence?: number | null;
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
  bonusEarned?: number;
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
  const [showRegradeFromGraded, setShowRegradeFromGraded] = useState(false);
  // Per-round opt-in for busted players to enter the answer interface from
  // the "Busted but Not Out" guide card.
  const [bustedAnswerStartedFor, setBustedAnswerStartedFor] = useState<string | null>(null);

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

    const regradeQuestion = round.question
      ? {
          id: round.question.id,
          category: round.question.category,
          questionText: round.question.questionText,
          answerFormat: round.question.answerFormat,
          optionA: round.question.optionA,
          optionB: round.question.optionB,
          optionC: round.question.optionC,
          optionD: round.question.optionD,
          correctOption: round.question.correctOption,
          correctAnswer: round.question.correctAnswer,
          acceptableAnswers: (round.question as Record<string, unknown>).acceptableAnswers as string | null ?? null,
          correctAnswerUnit: (round.question as Record<string, unknown>).correctAnswerUnit as string | null ?? null,
          orderingItems: round.question.orderingItems,
          orderingCorrectOrder: round.question.orderingCorrectOrder,
          orderingItemValues: round.question.orderingItemValues,
          orderingDirection: round.question.orderingDirection,
        }
      : null;

    return (
      <FlagReviewInterface
        roundId={round.id}
        roundNumber={roundNumber ?? round.number}
        gameNumber={gameNumber ?? 1}
        myPlayerId={myPlayerId}
        isCommissioner={isCommissioner}
        actAsPlayerId={actAsPlayerId}
        roundContext={roundContext}
        regradeQuestion={regradeQuestion}
        regradeAnswers={round.answers}
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

    const regradeQuestionGraded = round.question
      ? {
          id: round.question.id,
          category: round.question.category,
          questionText: round.question.questionText,
          answerFormat: round.question.answerFormat,
          optionA: round.question.optionA,
          optionB: round.question.optionB,
          optionC: round.question.optionC,
          optionD: round.question.optionD,
          correctOption: round.question.correctOption,
          correctAnswer: round.question.correctAnswer,
          acceptableAnswers: (round.question as Record<string, unknown>).acceptableAnswers as string | null ?? null,
          correctAnswerUnit: (round.question as Record<string, unknown>).correctAnswerUnit as string | null ?? null,
          orderingItems: round.question.orderingItems,
          orderingCorrectOrder: round.question.orderingCorrectOrder,
          orderingItemValues: round.question.orderingItemValues,
          orderingDirection: round.question.orderingDirection,
        }
      : null;

    return (
      <div className="card p-5 mb-6 text-center">
        <p className="text-lg font-bold text-[#e94560] mb-1">
          Round {round.number} Complete
        </p>
        <p className="text-sm text-[#a0a0b8]">
          View results below
        </p>
        {isCommissioner && round.question && (
          <div className="flex gap-2 justify-center mt-3">
            <button
              onClick={() => setEditingGrades(true)}
              className="btn-secondary text-xs"
            >
              ✏️ Edit Grades
            </button>
            <button
              onClick={() => setShowRegradeFromGraded(true)}
              className="btn-secondary text-xs"
            >
              🔑 Edit Answer Key
            </button>
          </div>
        )}
        {showRegradeFromGraded && regradeQuestionGraded && (
          <FixAndRegradeModal
            roundId={round.id}
            roundNumber={roundNumber ?? round.number}
            gameNumber={gameNumber ?? 1}
            hasFlag={false}
            question={regradeQuestionGraded}
            answers={round.answers}
            isOpen={showRegradeFromGraded}
            onClose={() => setShowRegradeFromGraded(false)}
            onApplied={() => {
              setShowRegradeFromGraded(false);
              onRefresh();
            }}
          />
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
      <>
        {round.question?.pendingReviewProposal && (
          <ReviewProposalBanner question={round.question} onDecided={onRefresh} />
        )}
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
      </>
    );
  }

  // Busted (eliminated): can still answer for a +1 next-game bonus, but no bets/power-ups.
  const isBusted = !!myPlayerState?.isEliminated;
  if (isBusted && !isGraded && !isAtBat) {
    const bonusSoFar = myPlayerState?.bonusEarned ?? 0;
    const bonusLine =
      bonusSoFar > 0
        ? `You've banked +${bonusSoFar} for next game so far.`
        : `Each correct answer banks +1 toward next game's starting points.`;

    // Already answered this round
    if (hasAnswered) {
      return (
        <div className="card p-5 mb-6 text-center border-amber-500/30 bg-amber-500/5">
          <p className="text-lg font-bold text-amber-400 mb-1">Answer Banked</p>
          <p className="text-[#a0a0b8] text-sm">{bonusLine}</p>
          {showAutoSkipTimer && (
            <div className="flex justify-center mt-2">
              <AutoSkipCountdown roundUpdatedAt={roundUpdatedAt!} />
            </div>
          )}
        </div>
      );
    }

    // Question available: busted players skip betting and can answer as soon
    // as a question exists. First show the guide card with an explicit
    // "Answer Question" button; clicking it reveals AnswerInterface.
    const canAnswer =
      (round.status === "question_submitted" || round.status === "category_revealed") &&
      round.question &&
      myPlayerId;
    if (canAnswer) {
      const hasStarted = bustedAnswerStartedFor === round.id;
      if (!hasStarted) {
        return (
          <div className="card p-5 mb-6 text-center border-amber-500/30 bg-amber-500/5">
            <p className="text-lg font-bold text-amber-400 mb-1">Busted but Not Out</p>
            <p className="text-[#a0a0b8] text-sm mb-4">
              You&apos;re out of points for this game. {bonusLine}
            </p>
            <button
              onClick={() => setBustedAnswerStartedFor(round.id)}
              className="btn-primary"
            >
              Answer Question
            </button>
          </div>
        );
      }
      return (
        <div className="mb-6">
          <div className="card p-3 mb-3 text-center border-amber-500/30 bg-amber-500/5">
            <p className="text-sm font-bold text-amber-400">Busted but Not Out</p>
            <p className="text-xs text-[#a0a0b8] mt-0.5">{bonusLine}</p>
          </div>
          <AnswerInterface
            roundId={round.id}
            leaguePlayerId={myPlayerId}
            question={round.question!}
            betAmount={0}
            playerPoints={0}
            allActivePoints={[]}
            answerDeadline={answerDeadline}
            roundStatus={round.status}
            powerUpType={null}
            actAsPlayerId={actAsPlayerId}
            onAnswered={onRefresh}
            isBusted
          />
        </div>
      );
    }

    // No question yet (awaiting at-bat player to submit)
    return (
      <div className="card p-5 mb-6 text-center border-amber-500/30 bg-amber-500/5">
        <p className="text-lg font-bold text-amber-400 mb-1">Busted but Not Out</p>
        <p className="text-[#a0a0b8] text-sm">
          You&apos;re out of points for this game. {bonusLine} Waiting on{" "}
          <span className="text-white font-medium">{atBatPlayerName || "the next player"}</span>{" "}
          to submit a question.
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

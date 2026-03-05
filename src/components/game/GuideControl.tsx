"use client";

import { useState } from "react";
import Link from "next/link";
import QuestionSubmitForm from "@/components/question/QuestionSubmitForm";
import BettingInterface from "@/components/game/BettingInterface";
import AnswerInterface from "@/components/game/AnswerInterface";
import GradingInterface from "@/components/game/GradingInterface";
import StarRating from "@/components/ui/StarRating";

interface RoundData {
  id: string;
  number: number;
  status: string;
  categoryRevealAt: string | null;
  atBatPlayerId: string | null;
  atBatAvgRating?: number | null;
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
}

interface PlayerState {
  leaguePlayerId: string;
  points: number;
  isEliminated: boolean;
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
}

type GuideControlProps = LeagueGuideProps | GameGuideProps;

export default function GuideControl(props: GuideControlProps) {
  const [postAnswerRating, setPostAnswerRating] = useState(0);
  const [ratingSubmitted, setRatingSubmitted] = useState(false);
  const [editingGrades, setEditingGrades] = useState(false);

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
  } = props;

  if (!round) return null;

  const isAtBat = round.atBatPlayerId === myPlayerId;
  const myAnswer = round.answers.find((a) => a.leaguePlayerId === myPlayerId);
  const hasBet = !!myAnswer?.betPlacedAt;
  const hasAnswered = !!myAnswer?.answeredAt;
  const isGraded = round.status === "graded";
  const isClosed = round.status === "closed";

  const answerDeadline =
    round.categoryRevealAt && answerTimerSeconds
      ? new Date(new Date(round.categoryRevealAt).getTime() + answerTimerSeconds * 1000).toISOString()
      : null;

  const actAsParam = actAsPlayerId ? `?actAs=${actAsPlayerId}` : "";

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

  // At bat: submit question
  if (isAtBat && round.status === "awaiting_question" && myPlayerId) {
    return (
      <div className="mb-6">
        <QuestionSubmitForm
          roundId={round.id}
          leaguePlayerId={myPlayerId}
          leagueId={leagueId}
          onSubmitted={onRefresh}
        />
      </div>
    );
  }

  // At bat: waiting for others
  if (isAtBat && !isGraded && !isClosed && round.status !== "awaiting_question") {
    return (
      <div className="card p-5 mb-6 text-center">
        <p className="text-lg font-bold text-[#e94560] mb-2">
          You&apos;re Up!
        </p>
        <p className="text-[#a0a0b8]">
          You submitted the question for this round. Waiting for other players to bet and answer...
        </p>
      </div>
    );
  }

  // Eliminated player
  if (!isGraded && !isClosed && !isAtBat && myPlayerState && myPlayerState.points === 0 && !hasBet) {
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
          onBetPlaced={onRefresh}
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

  // Grading: at bat or commissioner
  if (isClosed && (isAtBat || isCommissioner) && round.question) {
    return (
      <div className="mb-6">
        <GradingInterface
          roundId={round.id}
          answers={round.answers}
          question={round.question}
          atBatPlayerId={round.atBatPlayerId}
          categoryRevealAt={round.categoryRevealAt}
          onGradingComplete={onRefresh}
        />
      </div>
    );
  }

  // Awaiting review (non-at-bat, non-commissioner)
  if (isClosed && !isAtBat && !isCommissioner) {
    return (
      <div className="card p-5 mb-6 text-center">
        <p className="text-lg font-bold text-orange-400 mb-2">
          Awaiting Review
        </p>
        <p className="text-[#a0a0b8]">
          Waiting for the question creator to review and confirm grades...
        </p>
      </div>
    );
  }

  // Answered, waiting for round close
  if (!isGraded && !isClosed && !isAtBat && hasAnswered) {
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

        {/* Rate this question */}
        {myPlayerId && (
          <div className="mt-4 pt-4 border-t border-[#1e3a5f]">
            <p className="text-xs text-[#a0a0b8] uppercase tracking-wider mb-2">
              Rate this question
            </p>
            <StarRating
              value={postAnswerRating}
              onChange={ratingSubmitted ? undefined : async (rating) => {
                setPostAnswerRating(rating);
                setRatingSubmitted(true);
                const ratingActAs = actAsPlayerId ? `?actAs=${actAsPlayerId}` : "";
                await fetch(`/api/rounds/${round.id}/rate${ratingActAs}`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ rating }),
                }).catch(() => {});
              }}
            />
            {postAnswerRating > 0 && (
              <p className="text-xs text-[#666680] mt-1">
                You rated this {postAnswerRating}/5
              </p>
            )}
          </div>
        )}
      </div>
    );
  }

  // Category display (standalone when no other action applies)
  if (round.question && (round.status === "category_revealed" || isClosed) && !isAtBat) {
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

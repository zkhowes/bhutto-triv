"use client";

import { useState } from "react";
import StarRating from "@/components/ui/StarRating";
import InfoTooltip from "@/components/ui/InfoTooltip";

interface RoundControlProps {
  round: {
    id: string;
    number: number;
    funFact?: string | null;
    atBatPlayerId?: string | null;
    questionScore?: {
      avgRating: number | null;
      successRate: number | null;
      composite: number | null;
    } | null;
    question: {
      category: string;
      questionText: string;
      answerFormat: string;
      correctOption: string | null;
      correctAnswer: string | null;
      optionA: string | null;
      optionB: string | null;
      optionC: string | null;
      optionD: string | null;
    } | null;
    answers: Array<{
      id: string;
      leaguePlayerId: string;
      isCorrect: boolean | null;
      pointsWon: number;
      placement: number | null;
      fastestLap: boolean;
      isAbsent: boolean;
      freeTextAnswer: string | null;
      questionRating: number | null;
      leaguePlayer: {
        id: string;
        fakeNickname: string | null;
        user: { id: string; nickname: string; avatarUrl: string | null; image: string | null };
      };
    }>;
  };
  myPlayerId: string | null;
}

export default function RoundControl({ round, myPlayerId }: RoundControlProps) {
  const [liveRating, setLiveRating] = useState<number | null>(null);
  const [ratingSubmitting, setRatingSubmitting] = useState(false);
  const myAnswer = round.answers.find((a) => a.leaguePlayerId === myPlayerId);
  const isAtBat = myPlayerId === round.atBatPlayerId;
  const existingRating = liveRating ?? myAnswer?.questionRating ?? null;
  const canRate = myAnswer && !isAtBat;
  const sortedAnswers = [...round.answers].sort(
    (a, b) => (a.placement || 999) - (b.placement || 999)
  );

  const getOptionText = (option: string | null) => {
    if (!round.question || !option) return "";
    switch (option) {
      case "A": return round.question.optionA;
      case "B": return round.question.optionB;
      case "C": return round.question.optionC;
      case "D": return round.question.optionD;
      default: return option;
    }
  };

  const handleRate = async (rating: number) => {
    setLiveRating(rating);
    setRatingSubmitting(true);
    try {
      await fetch(`/api/rounds/${round.id}/rate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rating }),
      });
    } catch {
      // silently fail
    } finally {
      setRatingSubmitting(false);
    }
  };

  if (!round.question) return null;

  return (
    <div className="space-y-4">
      {/* Merged question card */}
      <div className="card p-5">
        {/* Row 1: Category + question + my result badge */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-xs text-[#a0a0b8] uppercase tracking-wider mb-1">
              {round.question.category}
            </p>
            <p className="text-white font-medium">
              {round.question.questionText}
            </p>
          </div>
          {myAnswer && (
            <div
              className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-center ${
                myAnswer.isCorrect
                  ? "bg-emerald-500/20 border border-emerald-500/30"
                  : "bg-red-500/20 border border-red-500/30"
              }`}
            >
              <p
                className={`text-sm font-bold ${
                  myAnswer.isCorrect ? "text-emerald-400" : "text-red-400"
                }`}
              >
                {myAnswer.isCorrect ? "Correct!" : "Incorrect"}
              </p>
              <p className="text-xs text-[#a0a0b8]">
                {myAnswer.pointsWon > 0 ? "+" : ""}
                {myAnswer.pointsWon} pts &middot; #{myAnswer.placement}
                {myAnswer.fastestLap && (
                  <span className="text-purple-400 font-semibold ml-1">
                    +1
                  </span>
                )}
              </p>
            </div>
          )}
        </div>

        {/* Row 2: Correct answer */}
        <div className="mt-3">
          {round.question.answerFormat === "price_is_right" ? (
            <div>
              <p className="text-sm text-emerald-400">
                Target: {round.question.correctAnswer}
              </p>
              {(() => {
                const winner = sortedAnswers.find((a) => a.isCorrect);
                const winnerName = winner
                  ? winner.leaguePlayer.fakeNickname || winner.leaguePlayer.user.nickname
                  : null;
                const winnerGuess = winner?.freeTextAnswer;
                const target = parseFloat(round.question!.correctAnswer ?? "NaN");
                if (winner && winnerGuess) {
                  return (
                    <p className="text-xs text-[#a0a0b8] mt-0.5">
                      Closest:{" "}
                      <span className="text-white font-semibold">{winnerGuess}</span>
                      {" "}by {winnerName}
                      {parseFloat(winnerGuess) === target && (
                        <span className="ml-1 text-emerald-400">(exact!)</span>
                      )}
                    </p>
                  );
                }
                return (
                  <p className="text-xs text-red-400 mt-0.5">
                    Everyone went over
                  </p>
                );
              })()}
            </div>
          ) : (
            <p className="text-sm text-emerald-400">
              Answer:{" "}
              {round.question.answerFormat === "multiple_choice"
                ? `${round.question.correctOption}. ${getOptionText(round.question.correctOption)}`
                : round.question.correctAnswer}
            </p>
          )}
        </div>

        {/* Question rating — left-aligned below answer */}
        {round.questionScore?.composite != null && (
          <div className="mt-2 flex items-center gap-2">
            <span className="text-[10px] text-[#666680] uppercase tracking-wider">Question Rating:</span>
            <StarRating value={round.questionScore.composite} size="sm" showLabel />
            {round.questionScore.successRate != null && (
              <span className="text-xs text-[#666680]">
                {Math.round(round.questionScore.successRate * 100)}% correct
              </span>
            )}
            <InfoTooltip text="Question rating combines player star ratings with difficulty balance (~50% correct is ideal)." />
          </div>
        )}
        {/* Retroactive rating fallback (for players who didn't rate during answer) */}
        {canRate && !existingRating && (
          <div className="mt-2 flex items-center gap-2">
            <span className="text-[10px] text-[#666680] uppercase tracking-wider">Rate Question:</span>
            <StarRating
              value={existingRating || 0}
              size="sm"
              onChange={handleRate}
            />
            {ratingSubmitting && (
              <span className="text-[10px] text-[#666680]">saving...</span>
            )}
          </div>
        )}

        {/* Row 3: Fun fact */}
        {round.funFact && (
          <div className="mt-4 pt-3 border-t border-purple-500/20">
            <p className="text-xs font-bold text-purple-400 uppercase tracking-wider mb-1">
              Did You Know?
            </p>
            <p className="text-sm text-[#e8e8e8]">{round.funFact}</p>
          </div>
        )}
      </div>
    </div>
  );
}

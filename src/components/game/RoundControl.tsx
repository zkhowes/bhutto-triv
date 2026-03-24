"use client";

import { useState } from "react";
import StarRating from "@/components/ui/StarRating";
import InfoTooltip from "@/components/ui/InfoTooltip";
import ThrowFlagButton from "@/components/game/ThrowFlagButton";

interface RoundControlProps {
  round: {
    id: string;
    number: number;
    status?: string;
    funFact?: string | null;
    atBatPlayerId?: string | null;
    questionScore?: {
      avgRating: number | null;
      successRate: number | null;
      composite: number | null;
    } | null;
    flagReview?: {
      id: string;
      status: string;
      flaggedById: string;
      objection: string;
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
      imageUrl?: string | null;
      imageAttribution?: string | null;
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
    game?: {
      playerStates?: Array<{
        leaguePlayerId: string;
        points: number;
      }>;
    };
  };
  myPlayerId: string | null;
  flagUsed?: boolean;
  flagWindowOpen?: boolean;
  activePlayerCount?: number;
  actAsPlayerId?: string | null;
  onRefresh?: () => void;
  isCommissioner?: boolean;
}

export default function RoundControl({
  round,
  myPlayerId,
  flagUsed = false,
  flagWindowOpen = false,
  activePlayerCount = 0,
  actAsPlayerId = null,
  onRefresh,
  isCommissioner = false,
}: RoundControlProps) {
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
            {round.question.imageUrl && (
              <div className="mt-3">
                <img
                  src={round.question.imageUrl}
                  alt="Question image"
                  className="rounded-xl w-full max-h-64 object-cover"
                  onError={(e) => {
                    (e.target as HTMLImageElement).parentElement!.style.display = "none";
                  }}
                />
                {round.question.imageAttribution && (() => {
                  try {
                    const attr = JSON.parse(round.question!.imageAttribution!);
                    return (
                      <p className="text-xs text-[#a0a0b8] mt-1">
                        Photo by{" "}
                        <a href={attr.profileUrl} target="_blank" rel="noopener noreferrer" className="underline">
                          {attr.name}
                        </a>
                      </p>
                    );
                  } catch { return null; }
                })()}
              </div>
            )}
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
            <span className="text-sm text-[#fbbf24] font-bold">{round.questionScore.composite.toFixed(1)}</span>
            <span className="text-xs text-[#666680]">/ 5</span>
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

        {/* Throw Flag button — between answer/rating and fun fact */}
        {myPlayerId && round.status === "graded" && onRefresh && (
          <ThrowFlagButton
            roundId={round.id}
            myPlayerId={myPlayerId}
            atBatPlayerId={round.atBatPlayerId || null}
            flagUsed={flagUsed}
            flagWindowOpen={flagWindowOpen}
            activePlayerCount={activePlayerCount}
            hasFlagReview={!!round.flagReview}
            myPoints={round.game?.playerStates?.find((ps) => ps.leaguePlayerId === myPlayerId)?.points ?? 0}
            actAsPlayerId={actAsPlayerId}
            onFlagThrown={onRefresh}
          />
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

        {/* Flag outcome badge */}
        {round.flagReview && round.flagReview.status !== "pending" && (
          <div className={`mt-4 pt-3 border-t ${round.flagReview.status === "agreed" ? "border-emerald-500/20" : "border-red-500/20"}`}>
            <p className={`text-xs font-bold uppercase tracking-wider ${round.flagReview.status === "agreed" ? "text-emerald-400" : "text-amber-400"}`}>
              {round.flagReview.status === "agreed" ? "Round was challenged and thrown out" : "Flag was denied"}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

"use client";

import { useState, useMemo } from "react";
import { determinePirWinners } from "@/lib/scoring";
import CheatSeekerEye from "./CheatSeekerEye";

interface Answer {
  id: string;
  leaguePlayerId: string;
  selectedOption: string | null;
  freeTextAnswer: string | null;
  isCorrect: boolean | null;
  gradedBy: string | null;
  answeredAt: string | null;
  betPlacedAt: string | null;
  isAbsent: boolean;
  powerUpType: string | null;
  powerUpCost: number;
  cheatSeekerData: string | null;
  leaguePlayer: {
    id: string;
    fakeNickname: string | null;
    user: { id: string; nickname: string };
  };
}

interface Question {
  questionText: string;
  answerFormat: string;
  category: string;
  correctOption: string | null;
  correctAnswer: string | null;
  optionA: string | null;
  optionB: string | null;
  optionC: string | null;
  optionD: string | null;
}

interface GradingInterfaceProps {
  roundId: string;
  answers: Answer[];
  question: Question;
  atBatPlayerId: string | null;
  categoryRevealAt: string | null;
  onGradingComplete: () => void;
}

export default function GradingInterface({
  roundId,
  answers,
  question,
  atBatPlayerId,
  categoryRevealAt,
  onGradingComplete,
}: GradingInterfaceProps) {
  const isPriceIsRight = question.answerFormat === "price_is_right";

  // Only show non-at-bat player answers
  // For Price is Right, isCorrect is null until closeRound, so show all non-absent answers
  const playerAnswers = answers.filter(
    (a) =>
      a.leaguePlayerId !== atBatPlayerId &&
      (isPriceIsRight ? !a.isAbsent : a.isCorrect !== null)
  );

  // Compute PiR preview grades client-side
  const pirPreview = useMemo<Record<string, boolean>>(() => {
    if (!isPriceIsRight) return {};
    const target = parseFloat(question.correctAnswer ?? "NaN");
    if (isNaN(target)) return {};
    const guesses = playerAnswers
      .map((a) => ({
        id: a.id,
        value: parseFloat(a.freeTextAnswer ?? "NaN"),
      }))
      .filter((g) => !isNaN(g.value));
    const winnerIds = determinePirWinners(target, guesses);
    const preview: Record<string, boolean> = {};
    for (const a of playerAnswers) {
      preview[a.id] = winnerIds.has(a.id);
    }
    return preview;
  }, [isPriceIsRight, question.correctAnswer, playerAnswers]);

  const [overrides, setOverrides] = useState<Record<string, boolean>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const getAnswerTime = (answer: Answer): string | null => {
    if (!categoryRevealAt || !answer.answeredAt) return null;
    const start = new Date(categoryRevealAt).getTime();
    const end = new Date(answer.answeredAt).getTime();
    const seconds = Math.round((end - start) / 1000);
    return `${seconds}s`;
  };

  const getAnswerTimeSeconds = (answer: Answer): number | null => {
    if (!categoryRevealAt || !answer.answeredAt) return null;
    const start = new Date(categoryRevealAt).getTime();
    const end = new Date(answer.answeredAt).getTime();
    return Math.round((end - start) / 1000);
  };

  const getOriginalGrade = (answer: Answer): boolean => {
    if (isPriceIsRight) return pirPreview[answer.id] ?? false;
    return answer.isCorrect ?? false;
  };

  const getEffectiveGrade = (answer: Answer): boolean => {
    if (answer.id in overrides) return overrides[answer.id];
    return getOriginalGrade(answer);
  };

  const toggleGrade = (answerId: string, currentGrade: boolean) => {
    setOverrides((prev) => {
      const original = getOriginalGrade(answers.find((a) => a.id === answerId)!);
      const newGrade = !currentGrade;
      // If toggling back to original, remove override
      if (newGrade === original) {
        const next = { ...prev };
        delete next[answerId];
        return next;
      }
      return { ...prev, [answerId]: newGrade };
    });
  };

  const getPowerUpBadge = (type: string | null, cost: number) => {
    if (!type) return null;
    const labels: Record<string, string> = {
      hint: "\uD83D\uDCA1 Hint",
      elimination: "\u2702\uFE0F Elim",
      highlow: "\u2195\uFE0F Hi/Lo",
    };
    return `${labels[type] ?? type} (${cost}pt)`;
  };

  const getOptionText = (key: string): string => {
    const map: Record<string, string | null> = {
      A: question.optionA,
      B: question.optionB,
      C: question.optionC,
      D: question.optionD,
    };
    return map[key] || key;
  };

  const handleConfirm = async () => {
    setSubmitting(true);
    setError("");

    try {
      // Submit any overrides
      for (const [answerId, isCorrect] of Object.entries(overrides)) {
        const res = await fetch(`/api/rounds/${roundId}/grade`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ answerId, isCorrect }),
        });
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || "Failed to save grade override");
        }
      }

      // Close the round (finalize scoring)
      const closeRes = await fetch(`/api/rounds/${roundId}/close`, {
        method: "POST",
      });
      if (!closeRes.ok) {
        const data = await closeRes.json();
        throw new Error(data.error || "Failed to close round");
      }

      onGradingComplete();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to confirm grades");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="card p-6">
      <h2 className="text-lg font-bold text-[#e94560] mb-1">Review Answers</h2>
      <p className="text-sm text-[#a0a0b8] mb-4">
        {isPriceIsRight
          ? "Closest guess without going over wins. Review the auto-grades below and override if needed."
          : "All players have answered. Review the grades below and override if needed."}
      </p>

      {/* Question & correct answer */}
      <div className="bg-[#0f0f23] rounded-lg p-4 mb-5 border border-[#1e3a5f]">
        <p className="text-xs text-[#a0a0b8] uppercase tracking-wider mb-1">
          {question.category}
        </p>
        <p className="text-white font-medium mb-2">{question.questionText}</p>
        <p className="text-sm text-emerald-400">
          {isPriceIsRight ? "Target: " : "Correct answer: "}
          {question.answerFormat === "multiple_choice"
            ? `${question.correctOption}. ${getOptionText(question.correctOption || "")}`
            : question.correctAnswer}
        </p>
      </div>

      {/* Player answers */}
      <div className="space-y-3 mb-5">
        {playerAnswers.map((answer) => {
          const playerName =
            answer.leaguePlayer.fakeNickname || answer.leaguePlayer.user.nickname;
          const answerText =
            question.answerFormat === "multiple_choice"
              ? `${answer.selectedOption}. ${getOptionText(answer.selectedOption || "")}`
              : answer.freeTextAnswer || "(no answer)";

          const grade = getEffectiveGrade(answer);
          const isOverridden = answer.id in overrides;

          // PiR-specific: show distance info
          const pirGuessValue = isPriceIsRight ? parseFloat(answer.freeTextAnswer ?? "NaN") : NaN;
          const pirTarget = isPriceIsRight ? parseFloat(question.correctAnswer ?? "NaN") : NaN;
          const pirIsOver = !isNaN(pirGuessValue) && !isNaN(pirTarget) && pirGuessValue > pirTarget;

          return (
            <div
              key={answer.id}
              className={`rounded-lg p-4 border transition-all ${
                grade
                  ? "border-emerald-500/30 bg-emerald-500/5"
                  : "border-red-500/30 bg-red-500/5"
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-white">{playerName}</p>
                    <CheatSeekerEye
                      cheatSeekerData={answer.cheatSeekerData}
                      answerTimeSeconds={getAnswerTimeSeconds(answer)}
                    />
                    {getPowerUpBadge(answer.powerUpType, answer.powerUpCost) && (
                      <span className="text-xs text-amber-400 font-medium">
                        {getPowerUpBadge(answer.powerUpType, answer.powerUpCost)}
                      </span>
                    )}
                    {getAnswerTime(answer) && (
                      <span className="text-xs text-purple-400 font-mono">
                        ⏱️ {getAnswerTime(answer)}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-[#a0a0b8] mt-1 truncate">
                    {isPriceIsRight ? "Guess: " : ""}{answerText}
                    {pirIsOver && (
                      <span className="ml-2 text-xs text-red-400">over</span>
                    )}
                  </p>
                  {answer.gradedBy === "ai" && !isPriceIsRight && (
                    <p className="text-xs text-[#666680] mt-1">
                      AI says: {answer.isCorrect ? "Correct" : "Incorrect"}
                    </p>
                  )}
                  {isOverridden && (
                    <p className="text-xs text-amber-400 mt-1">Override applied</p>
                  )}
                </div>
                <button
                  onClick={() => toggleGrade(answer.id, grade)}
                  className={`ml-4 flex-shrink-0 w-20 py-2 rounded-lg text-sm font-bold transition-all ${
                    grade
                      ? "bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30"
                      : "bg-red-500/20 text-red-400 hover:bg-red-500/30"
                  }`}
                >
                  {grade ? "✓ Right" : "✗ Wrong"}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {Object.keys(overrides).length > 0 && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 mb-4 text-sm text-amber-400">
          {Object.keys(overrides).length} grade{Object.keys(overrides).length > 1 ? "s" : ""} overridden
        </div>
      )}

      {error && (
        <div className="text-red-400 text-sm bg-red-500/10 rounded-lg p-3 mb-4">
          {error}
        </div>
      )}

      <button
        onClick={handleConfirm}
        disabled={submitting}
        className="btn-primary w-full text-lg"
      >
        {submitting ? "Confirming..." : "Confirm & Complete Round"}
      </button>
    </div>
  );
}

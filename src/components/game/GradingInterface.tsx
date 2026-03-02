"use client";

import { useState } from "react";

interface CheatSeekerData {
  tabSwitches: number;
  timeAway: number;
  pasteDetected: boolean;
  blurCount: number;
}

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

function getHeatLevel(data: CheatSeekerData): { score: number; label: string; color: string } {
  const score =
    data.tabSwitches * 2 +
    data.blurCount * 1 +
    (data.pasteDetected ? 3 : 0) +
    (data.timeAway > 10000 ? 1 : 0);
  if (score === 0) return { score, label: "Cold", color: "text-blue-400" };
  if (score <= 2) return { score, label: "Warm", color: "text-amber-400" };
  if (score <= 5) return { score, label: "Hot", color: "text-orange-400" };
  return { score, label: "On Fire", color: "text-red-400" };
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

  const getEffectiveGrade = (answer: Answer): boolean => {
    if (answer.id in overrides) return overrides[answer.id];
    return answer.isCorrect ?? false;
  };

  const toggleGrade = (answerId: string, currentGrade: boolean) => {
    setOverrides((prev) => {
      const original = answers.find((a) => a.id === answerId)?.isCorrect ?? false;
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
      hint: "💡 Hint",
      elimination: "✂️ Elim",
      highlow: "↕️ Hi/Lo",
    };
    return `${labels[type] ?? type} (${cost}pt)`;
  };

  const renderCheatSeeker = (raw: string | null) => {
    if (!raw) return null;
    try {
      const data: CheatSeekerData = JSON.parse(raw);
      const heat = getHeatLevel(data);
      if (heat.score === 0) return null;
      const signals: string[] = [];
      if (data.tabSwitches > 0) signals.push(`${data.tabSwitches} tab switch${data.tabSwitches > 1 ? "es" : ""}`);
      if (data.blurCount > 0) signals.push(`${data.blurCount} blur${data.blurCount > 1 ? "s" : ""}`);
      if (data.pasteDetected) signals.push("paste");
      if (data.timeAway > 10000) signals.push(`${Math.round(data.timeAway / 1000)}s away`);
      return (
        <p className={`text-xs mt-1 ${heat.color}`}>
          HEAT CHECK: {heat.label} {heat.label === "On Fire" ? "\uD83D\uDD25" : ""} — {signals.join(", ")}
        </p>
      );
    } catch {
      return null;
    }
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
          ? "All players have submitted their guesses. Close the round to determine the winner."
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

          if (isPriceIsRight) {
            // Price is Right: just show guesses, no override buttons
            const guessValue = parseFloat(answer.freeTextAnswer ?? "NaN");
            const target = parseFloat(question.correctAnswer ?? "NaN");
            const isOver = !isNaN(guessValue) && !isNaN(target) && guessValue > target;
            return (
              <div
                key={answer.id}
                className="rounded-lg p-4 border border-[#1e3a5f] bg-[#0f0f23]"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-white">{playerName}</p>
                      {getPowerUpBadge(answer.powerUpType, answer.powerUpCost) && (
                        <span className="text-xs text-amber-400 font-medium">
                          {getPowerUpBadge(answer.powerUpType, answer.powerUpCost)}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-[#a0a0b8] mt-1">
                      Guess: <span className="font-mono text-white">{answerText}</span>
                      {isOver && (
                        <span className="ml-2 text-xs text-red-400">over</span>
                      )}
                    </p>
                  </div>
                  {getAnswerTime(answer) && (
                    <span className="text-xs text-purple-400 font-mono">
                      ⏱️ {getAnswerTime(answer)}
                    </span>
                  )}
                </div>
                {renderCheatSeeker(answer.cheatSeekerData)}
              </div>
            );
          }

          const grade = getEffectiveGrade(answer);
          const isOverridden = answer.id in overrides;

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
                  <p className="text-sm text-[#a0a0b8] mt-1 truncate">{answerText}</p>
                  {answer.gradedBy === "ai" && (
                    <p className="text-xs text-[#666680] mt-1">
                      AI says: {answer.isCorrect ? "Correct" : "Incorrect"}
                    </p>
                  )}
                  {isOverridden && (
                    <p className="text-xs text-amber-400 mt-1">Override applied</p>
                  )}
                  {renderCheatSeeker(answer.cheatSeekerData)}
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

      {!isPriceIsRight && Object.keys(overrides).length > 0 && (
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

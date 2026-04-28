"use client";

import { useState } from "react";
import Avatar from "@/components/ui/Avatar";
import CheatSeekerEye, { parseCheatSeekerData, getHeatLevel } from "./CheatSeekerEye";

interface BoxScoreControlProps {
  answers: Array<{
    id: string;
    leaguePlayerId: string;
    selectedOption: string | null;
    freeTextAnswer: string | null;
    betAmount: number | null;
    isCorrect: boolean | null;
    gradedBy: string | null;
    pointsWon: number;
    placement: number | null;
    fastestLap: boolean;
    isAbsent: boolean;
    powerUpType: string | null;
    powerUpCost: number;
    cheatSeekerData: string | null;
    isBlindBet?: boolean;
    answeredAt?: string | null;
    leaguePlayer: {
      id: string;
      fakeNickname: string | null;
      user: { id: string; nickname: string; avatarUrl: string | null; image: string | null };
    };
  }>;
  eliminatedPlayerIds?: Set<string>;
  question: {
    answerFormat: string;
    correctAnswer: string | null;
    optionA: string | null;
    optionB: string | null;
    optionC: string | null;
    optionD: string | null;
    orderingItems?: string | null;
    orderingCorrectOrder?: string | null;
  };
  myPlayerId: string | null;
  defaultOpen?: boolean;
  categoryRevealAt?: string | null;
}

export default function BoxScoreControl({
  answers,
  eliminatedPlayerIds,
  question,
  myPlayerId,
  defaultOpen = false,
  categoryRevealAt,
}: BoxScoreControlProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  const sortedAnswers = [...answers].sort(
    (a, b) => (a.placement || 999) - (b.placement || 999)
  );

  const getOptionText = (key: string | null): string => {
    if (!key) return "";
    const map: Record<string, string | null> = {
      A: question.optionA,
      B: question.optionB,
      C: question.optionC,
      D: question.optionD,
    };
    return map[key] || key;
  };

  const isPlayerEliminated = (leaguePlayerId: string): boolean =>
    eliminatedPlayerIds?.has(leaguePlayerId) ?? false;

  const getAbsentLabel = (answer: typeof answers[0]): string =>
    isPlayerEliminated(answer.leaguePlayerId) ? "Busted" : "Absent";

  // Busted player who chose to answer for a +1-next-game bonus (vs. simply absent)
  const isBustedAndAnswered = (answer: typeof answers[0]): boolean =>
    isPlayerEliminated(answer.leaguePlayerId) && !answer.isAbsent;

  const getAnswerDisplay = (answer: typeof answers[0]): string => {
    if (answer.isAbsent) return getAbsentLabel(answer);
    if (question.answerFormat === "multiple_choice") {
      return answer.selectedOption
        ? `${answer.selectedOption}. ${getOptionText(answer.selectedOption)}`
        : "(no answer)";
    }
    if (question.answerFormat === "ordering" && answer.freeTextAnswer) {
      try {
        const playerPositions: number[] = JSON.parse(answer.freeTextAnswer);
        const items: string[] = JSON.parse(question.orderingItems ?? "[]");
        const orderedItems = playerPositions
          .map((pos, origIdx) => ({ pos, item: items[origIdx] }))
          .sort((a, b) => a.pos - b.pos)
          .map((e) => e.item);
        return orderedItems.join(" → ");
      } catch { /* fall through */ }
    }
    return answer.freeTextAnswer || "(no answer)";
  };

  const getAnswerTimeSeconds = (answer: typeof answers[0]): number | null => {
    if (!categoryRevealAt || !answer.answeredAt) return null;
    const start = new Date(categoryRevealAt).getTime();
    const end = new Date(answer.answeredAt).getTime();
    return Math.round((end - start) / 1000);
  };

  // Compute median answer time for relative comparison
  const answerTimes = sortedAnswers
    .map((a) => getAnswerTimeSeconds(a))
    .filter((t): t is number => t !== null && t > 0);
  const medianAnswerTime = answerTimes.length > 0
    ? answerTimes.sort((a, b) => a - b)[Math.floor(answerTimes.length / 2)]
    : null;

  // Count players with cheat seeker data flagged (score > 0)
  const hasCheatSeekerData = sortedAnswers.some((a) => !!a.cheatSeekerData);
  const cheatSeekerFlaggedCount = sortedAnswers.filter((a) => {
    const data = parseCheatSeekerData(a.cheatSeekerData);
    return data && getHeatLevel(data).score > 0;
  }).length;

  if (sortedAnswers.length === 0) return null;

  return (
    <div className="card overflow-hidden">
      {/* Collapsible header */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-4 hover:bg-[#0f0f23]/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-[#a0a0b8] uppercase tracking-wider">
            Box Scores
          </h3>
          {hasCheatSeekerData && (
            <span className="flex items-center gap-1">
              <svg className={`w-4 h-4 ${cheatSeekerFlaggedCount > 0 ? "text-amber-400" : "text-blue-400/60"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
              {cheatSeekerFlaggedCount > 0 && (
                <span className="text-xs font-bold text-amber-400 bg-amber-400/15 rounded-full px-1.5 py-0.5 min-w-[1.25rem] text-center">
                  {cheatSeekerFlaggedCount}
                </span>
              )}
            </span>
          )}
        </div>
        <span className="text-[#a0a0b8] text-sm">
          {isOpen ? "▲" : "▼"}
        </span>
      </button>

      {/* Collapsible content */}
      {isOpen && (
        <div className="px-4 pb-4 space-y-3">
          {sortedAnswers.map((answer) => {
            const name = answer.leaguePlayer.fakeNickname || answer.leaguePlayer.user.nickname;
            const isMe = answer.leaguePlayerId === myPlayerId;

            return (
              <div
                key={answer.id}
                className={`rounded-lg p-3 border transition-all ${
                  answer.isAbsent
                    ? "border-gray-500/30 bg-gray-500/5"
                    : isBustedAndAnswered(answer)
                      ? answer.isCorrect
                        ? "border-gray-500/30 bg-gray-500/5 ring-1 ring-emerald-500/30"
                        : "border-gray-500/30 bg-gray-500/5 ring-1 ring-red-500/30"
                      : answer.isCorrect
                        ? "border-emerald-500/30 bg-emerald-500/5"
                        : "border-red-500/30 bg-red-500/5"
                } ${isMe ? "ring-1 ring-[#e94560]/30" : ""}`}
              >
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2 min-w-0">
                    <Avatar
                      src={answer.leaguePlayer.user.avatarUrl || answer.leaguePlayer.user.image}
                      name={name}
                      size="sm"
                    />
                    <span className="text-sm sm:text-base font-semibold text-white truncate">
                      {name}
                      {isMe && <span className="text-xs text-[#e94560] ml-1">(you)</span>}
                    </span>
                    <CheatSeekerEye
                      cheatSeekerData={answer.cheatSeekerData}
                      answerTimeSeconds={getAnswerTimeSeconds(answer)}
                      medianAnswerTimeSeconds={medianAnswerTime}
                    />
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {/* Points (or bonus indicator for busted-correct answers) */}
                    {isBustedAndAnswered(answer) && answer.isCorrect ? (
                      <span className="text-xs font-bold text-amber-400">+1 next</span>
                    ) : (
                      <span
                        className={`text-sm font-bold ${
                          answer.pointsWon > 0
                            ? "text-emerald-400"
                            : answer.pointsWon < 0
                              ? "text-red-400"
                              : "text-[#666680]"
                        }`}
                      >
                        {answer.pointsWon > 0 ? "+" : ""}{answer.pointsWon}
                      </span>
                    )}
                    {/* Result badge */}
                    {answer.isAbsent ? (
                      <span className="badge-absent text-xs">{getAbsentLabel(answer)}</span>
                    ) : isBustedAndAnswered(answer) ? (
                      answer.isCorrect ? (
                        <span className="badge-busted-correct text-xs">Busted &#10003;</span>
                      ) : (
                        <span className="badge-busted-wrong text-xs">Busted &#10007;</span>
                      )
                    ) : answer.isCorrect ? (
                      <span className="badge-correct text-xs">&#10003; Right</span>
                    ) : (
                      <span className="badge-incorrect text-xs">&#10007; Wrong</span>
                    )}
                  </div>
                </div>

                {/* Answer text */}
                {!answer.isAbsent && (
                  <p className="text-xs text-[#a0a0b8] mt-1 truncate">
                    {getAnswerDisplay(answer)}
                  </p>
                )}

                {/* Indicators row */}
                <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                  {answer.isBlindBet && (
                    <span className="text-xs text-amber-400 font-bold bg-amber-400/15 rounded px-1.5 py-0.5">BLIND 2x</span>
                  )}
                  {answer.fastestLap && (
                    <span className="text-xs text-purple-400 font-semibold">⚡ Fastest</span>
                  )}
                  {answer.powerUpType && (
                    <span className="text-xs text-amber-400">
                      {answer.powerUpType === "hint" ? "💡" : answer.powerUpType === "elimination" ? "✂️" : answer.powerUpType === "first_place" ? "🥇" : "↕️"}
                      {" "}{answer.powerUpType} ({answer.powerUpCost}pt)
                    </span>
                  )}
                  {answer.gradedBy === "ai" && (
                    <span className="text-xs text-[#666680]">AI graded</span>
                  )}
                  {answer.gradedBy === "override" && (
                    <span className="text-xs text-amber-400">Grader overruled AI</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

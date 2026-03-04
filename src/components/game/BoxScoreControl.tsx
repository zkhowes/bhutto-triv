"use client";

import { useState } from "react";
import Avatar from "@/components/ui/Avatar";

interface CheatSeekerData {
  tabSwitches: number;
  timeAway: number;
  pasteDetected: boolean;
  blurCount: number;
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
    leaguePlayer: {
      id: string;
      fakeNickname: string | null;
      user: { id: string; nickname: string; avatarUrl: string | null; image: string | null };
    };
  }>;
  question: {
    answerFormat: string;
    correctAnswer: string | null;
    optionA: string | null;
    optionB: string | null;
    optionC: string | null;
    optionD: string | null;
  };
  myPlayerId: string | null;
  defaultOpen?: boolean;
}

export default function BoxScoreControl({
  answers,
  question,
  myPlayerId,
  defaultOpen = false,
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

  const getAnswerDisplay = (answer: typeof answers[0]): string => {
    if (answer.isAbsent) return "Absent";
    if (question.answerFormat === "multiple_choice") {
      return answer.selectedOption
        ? `${answer.selectedOption}. ${getOptionText(answer.selectedOption)}`
        : "(no answer)";
    }
    return answer.freeTextAnswer || "(no answer)";
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
        <span className={`text-xs ${heat.color}`}>
          {heat.label} {heat.label === "On Fire" ? "🔥" : ""} — {signals.join(", ")}
        </span>
      );
    } catch {
      return null;
    }
  };

  // Count cheat seekers with score > 0
  const cheatSeekerCount = sortedAnswers.filter((a) => {
    if (!a.cheatSeekerData) return false;
    try {
      const data: CheatSeekerData = JSON.parse(a.cheatSeekerData);
      return getHeatLevel(data).score > 0;
    } catch {
      return false;
    }
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
          {cheatSeekerCount > 0 && (
            <span className="flex items-center gap-1">
              <svg className="w-4 h-4 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
              <span className="text-xs font-bold text-amber-400 bg-amber-400/15 rounded-full px-1.5 py-0.5 min-w-[1.25rem] text-center">
                {cheatSeekerCount}
              </span>
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
                    <span className="text-sm font-semibold text-white truncate">
                      {name}
                      {isMe && <span className="text-xs text-[#e94560] ml-1">(you)</span>}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {/* Points */}
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
                    {/* Result badge */}
                    {answer.isAbsent ? (
                      <span className="badge-absent text-xs">Absent</span>
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
                  {answer.fastestLap && (
                    <span className="text-xs text-purple-400 font-semibold">⚡ Fastest</span>
                  )}
                  {answer.powerUpType && (
                    <span className="text-xs text-amber-400">
                      {answer.powerUpType === "hint" ? "💡" : answer.powerUpType === "elimination" ? "✂️" : "↕️"}
                      {" "}{answer.powerUpType} ({answer.powerUpCost}pt)
                    </span>
                  )}
                  {answer.gradedBy === "ai" && (
                    <span className="text-xs text-[#666680]">AI graded</span>
                  )}
                  {answer.gradedBy === "override" && (
                    <span className="text-xs text-amber-400">Grader overruled AI</span>
                  )}
                  {renderCheatSeeker(answer.cheatSeekerData)}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

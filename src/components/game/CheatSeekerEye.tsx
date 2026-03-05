"use client";

import { useState } from "react";

export interface CheatSeekerData {
  tabSwitches: number;
  timeAway: number;
  pasteDetected: boolean;
  blurCount: number;
}

export function getHeatLevel(data: CheatSeekerData): {
  score: number;
  label: string;
  color: string;
  iconColor: string;
} {
  const score =
    data.tabSwitches * 2 +
    data.blurCount * 1 +
    (data.pasteDetected ? 3 : 0) +
    (data.timeAway > 10000 ? 1 : 0);
  if (score === 0)
    return { score, label: "Clean", color: "text-blue-400", iconColor: "text-blue-400/60" };
  if (score <= 2)
    return { score, label: "Warm", color: "text-amber-400", iconColor: "text-amber-400" };
  if (score <= 5)
    return { score, label: "Hot", color: "text-orange-400", iconColor: "text-orange-400" };
  return { score, label: "On Fire", color: "text-red-400", iconColor: "text-red-400" };
}

export function parseCheatSeekerData(raw: string | null): CheatSeekerData | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as CheatSeekerData;
  } catch {
    return null;
  }
}

interface CheatSeekerEyeProps {
  cheatSeekerData: string | null;
  answerTimeSeconds?: number | null;
}

export default function CheatSeekerEye({
  cheatSeekerData,
  answerTimeSeconds,
}: CheatSeekerEyeProps) {
  const [showTooltip, setShowTooltip] = useState(false);

  const data = parseCheatSeekerData(cheatSeekerData);
  if (!data) return null;

  const heat = getHeatLevel(data);

  return (
    <div
      className="relative inline-flex"
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      <svg
        className={`w-3.5 h-3.5 ${heat.iconColor} cursor-pointer`}
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
        />
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
        />
      </svg>

      {showTooltip && (
        <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 z-50 w-48 p-3 rounded-lg bg-[#16162a] border border-[#1e3a5f] shadow-xl">
          {/* Heat label */}
          <div className="flex items-center justify-between mb-2">
            <span className={`text-xs font-bold ${heat.color}`}>
              {heat.label} {heat.label === "On Fire" ? "\uD83D\uDD25" : ""}
            </span>
            <span className="text-[10px] text-[#666680]">score: {heat.score}</span>
          </div>

          {/* Stats grid */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-[#a0a0b8]">Tab switches</span>
              <span
                className={`text-[10px] font-mono ${
                  data.tabSwitches > 0 ? "text-amber-400" : "text-[#666680]"
                }`}
              >
                {data.tabSwitches}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-[#a0a0b8]">Window blurs</span>
              <span
                className={`text-[10px] font-mono ${
                  data.blurCount > 0 ? "text-amber-400" : "text-[#666680]"
                }`}
              >
                {data.blurCount}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-[#a0a0b8]">Time away</span>
              <span
                className={`text-[10px] font-mono ${
                  data.timeAway > 10000 ? "text-amber-400" : "text-[#666680]"
                }`}
              >
                {data.timeAway > 0
                  ? `${(data.timeAway / 1000).toFixed(1)}s`
                  : "0s"}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-[#a0a0b8]">Paste detected</span>
              <span
                className={`text-[10px] font-mono ${
                  data.pasteDetected ? "text-red-400" : "text-[#666680]"
                }`}
              >
                {data.pasteDetected ? "Yes" : "No"}
              </span>
            </div>
            {answerTimeSeconds != null && (
              <div className="flex items-center justify-between pt-1 border-t border-[#1e3a5f]">
                <span className="text-[10px] text-[#a0a0b8]">Answer time</span>
                <span className="text-[10px] font-mono text-purple-400">
                  {answerTimeSeconds}s
                </span>
              </div>
            )}
          </div>

          {/* Arrow */}
          <div className="absolute left-1/2 -translate-x-1/2 top-full w-0 h-0 border-l-4 border-r-4 border-t-4 border-l-transparent border-r-transparent border-t-[#1e3a5f]" />
        </div>
      )}
    </div>
  );
}

"use client";

import { useState } from "react";
import CountdownTimer from "./CountdownTimer";
import StarRating from "@/components/ui/StarRating";

interface BettingInterfaceProps {
  roundId: string;
  leaguePlayerId: string;
  maxPoints: number;
  category: string;
  answerFormat?: string | null;
  answerDeadline?: string | null;
  atBatAvgRating?: number | null;
  onBetPlaced: () => void;
}

const FORMAT_LABELS: Record<string, string> = {
  multiple_choice: "Multiple Choice",
  free_text: "Free Text Answer",
  price_is_right: "Price is Right",
};

export default function BettingInterface({
  roundId,
  leaguePlayerId,
  maxPoints,
  category,
  answerFormat,
  answerDeadline,
  atBatAvgRating,
  onBetPlaced,
}: BettingInterfaceProps) {
  const [betAmount, setBetAmount] = useState(1);
  const [placing, setPlacing] = useState(false);
  const [error, setError] = useState("");

  const handlePlaceBet = async () => {
    if (betAmount < 1 || betAmount > maxPoints) return;
    setPlacing(true);
    setError("");

    try {
      const res = await fetch(`/api/rounds/${roundId}/bet`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ betAmount, leaguePlayerId }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to place bet");
      }

      onBetPlaced();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to place bet");
    } finally {
      setPlacing(false);
    }
  };

  return (
    <div className="card p-6">
      <div className="text-center mb-6">
        <p className="text-xs text-[#a0a0b8] uppercase tracking-wider">
          Category
        </p>
        <p className="text-2xl font-bold text-[#fbbf24] mt-1">{category}</p>
        {answerFormat && (
          <span className="inline-block mt-1 px-2 py-0.5 rounded-full text-xs font-medium bg-[#1e3a5f] text-[#a0a0b8]">
            {FORMAT_LABELS[answerFormat] ?? answerFormat}
          </span>
        )}
        {atBatAvgRating != null && (
          <div className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#fbbf24]/10 border border-[#fbbf24]/20">
            <span className="text-xs text-[#fbbf24] font-medium">Player Rating</span>
            <StarRating value={atBatAvgRating} size="sm" showLabel />
          </div>
        )}
        {answerDeadline && (
          <div className="mt-2">
            <CountdownTimer deadlineTime={answerDeadline} />
          </div>
        )}
        <p className="text-sm text-[#a0a0b8] mt-2">
          Place your bet to see the question
        </p>
      </div>

      {maxPoints > 1 && (
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm text-[#a0a0b8]">1</span>
            <span className="text-sm text-[#a0a0b8]">
              Available: <span className="text-white font-bold">{maxPoints}</span>
            </span>
          </div>

          <input
            type="range"
            min={1}
            max={maxPoints}
            value={betAmount}
            onChange={(e) => setBetAmount(Number(e.target.value))}
            className="bet-slider w-full"
            aria-label="Bet amount"
          />
        </div>
      )}

      {error && (
        <div className="text-red-400 text-sm bg-red-500/10 rounded-lg p-3 mb-4">
          {error}
        </div>
      )}

      <button
        onClick={handlePlaceBet}
        disabled={placing || betAmount < 1}
        className={`w-full text-lg font-bold py-3 rounded-lg transition-colors ${
          betAmount === maxPoints
            ? "btn-gold"
            : "btn-primary"
        }`}
      >
        {placing
          ? "Placing Bet..."
          : betAmount === maxPoints
            ? `Go All In! Bet ${betAmount} point${betAmount === 1 ? "" : "s"}`
            : `Bet ${betAmount} point${betAmount === 1 ? "" : "s"}`}
      </button>

      <p className="text-center text-xs text-[#666680] mt-3">
        Bet is locked once placed. Question revealed after betting.
      </p>
    </div>
  );
}

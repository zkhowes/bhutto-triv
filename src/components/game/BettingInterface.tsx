"use client";

import { useState } from "react";
import CountdownTimer from "./CountdownTimer";

interface BettingInterfaceProps {
  roundId: string;
  leaguePlayerId: string;
  maxPoints: number;
  category: string;
  answerFormat?: string | null;
  answerDeadline?: string | null;
  onBetPlaced: () => void;
}

const FORMAT_LABELS: Record<string, string> = {
  multiple_choice: "Multiple Choice",
  free_text: "Free Answer",
  price_is_right: "Price is Right",
};

export default function BettingInterface({
  roundId,
  leaguePlayerId,
  maxPoints,
  category,
  answerFormat,
  answerDeadline,
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
        {answerDeadline && (
          <div className="mt-2">
            <CountdownTimer deadlineTime={answerDeadline} />
          </div>
        )}
        <p className="text-sm text-[#a0a0b8] mt-2">
          Place your bet to see the question
        </p>
      </div>

      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-[#a0a0b8]">Your bet</span>
          <span className="text-sm text-[#a0a0b8]">
            Available: <span className="text-white font-bold">{maxPoints}</span>
          </span>
        </div>

        <div className="flex items-center gap-4 mb-4">
          <input
            type="range"
            min={1}
            max={maxPoints}
            value={betAmount}
            onChange={(e) => setBetAmount(Number(e.target.value))}
            className="flex-1"
          />
          <input
            type="number"
            min={1}
            max={maxPoints}
            value={betAmount}
            onChange={(e) =>
              setBetAmount(
                Math.min(Math.max(1, Number(e.target.value)), maxPoints)
              )
            }
            className="input-field w-20 text-center text-lg font-bold"
          />
        </div>

        {/* Quick bet buttons */}
        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setBetAmount(1)}
            className="btn-secondary text-xs flex-1"
          >
            Min (1)
          </button>
          <button
            onClick={() => setBetAmount(Math.floor(maxPoints / 4))}
            className="btn-secondary text-xs flex-1"
          >
            25%
          </button>
          <button
            onClick={() => setBetAmount(Math.floor(maxPoints / 2))}
            className="btn-secondary text-xs flex-1"
          >
            50%
          </button>
          <button
            onClick={() => setBetAmount(maxPoints)}
            className="btn-gold text-xs flex-1"
          >
            ALL IN!
          </button>
        </div>
      </div>

      {error && (
        <div className="text-red-400 text-sm bg-red-500/10 rounded-lg p-3 mb-4">
          {error}
        </div>
      )}

      <button
        onClick={handlePlaceBet}
        disabled={placing || betAmount < 1}
        className="btn-primary w-full text-lg"
      >
        {placing ? "Placing Bet..." : `Lock In ${betAmount} Points`}
      </button>

      <p className="text-center text-xs text-[#666680] mt-3">
        Bet is locked once placed. Question revealed after betting.
      </p>
    </div>
  );
}

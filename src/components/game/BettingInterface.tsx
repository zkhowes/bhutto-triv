"use client";

import { useState } from "react";
import CountdownTimer from "./CountdownTimer";
import InfoTooltip from "@/components/ui/InfoTooltip";
import Spinner from "@/components/ui/Spinner";

interface BettingInterfaceProps {
  roundId: string;
  leaguePlayerId: string;
  maxPoints: number;
  category: string;
  answerFormat?: string | null;
  answerDeadline?: string | null;
  atBatAvgRating?: number | null;
  atBatSuccessRate?: number | null;
  onBetPlaced: () => void;
  roundStatus?: string;
  blindBetUsed?: boolean;
  isAtBat?: boolean;
}

const FORMAT_LABELS: Record<string, string> = {
  multiple_choice: "Multiple Choice",
  free_text: "Free Text Answer",
  price_is_right: "Price is Right",
  ordering: "Ordering",
};

export default function BettingInterface({
  roundId,
  leaguePlayerId,
  maxPoints,
  category,
  answerFormat,
  answerDeadline,
  atBatAvgRating,
  atBatSuccessRate,
  onBetPlaced,
  roundStatus,
  blindBetUsed = false,
  isAtBat = false,
}: BettingInterfaceProps) {
  const [betAmount, setBetAmount] = useState(1);
  const [placing, setPlacing] = useState(false);
  const [betPlaced, setBetPlaced] = useState(false);
  const [error, setError] = useState("");
  const [blindBetActive, setBlindBetActive] = useState(false);
  const [showBlindConfirm, setShowBlindConfirm] = useState(false);
  const [categoryRevealed, setCategoryRevealed] = useState(false);

  const canBlindBet =
    roundStatus === "question_submitted" &&
    !blindBetUsed &&
    !isAtBat &&
    !blindBetActive;

  // Hide category when blind bet is still available (not used, not at-bat, pre-category-reveal status)
  const showCategory =
    blindBetUsed || isAtBat || categoryRevealed || roundStatus !== "question_submitted";

  const handlePlaceBet = async (useBlindBet = false) => {
    if (betAmount < 1 || betAmount > maxPoints) return;
    setPlacing(true);
    setError("");

    try {
      const res = await fetch(`/api/rounds/${roundId}/bet`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          betAmount,
          leaguePlayerId,
          isBlindBet: useBlindBet,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to place bet");
      }

      if (useBlindBet) {
        setBlindBetActive(true);
      }
      setBetPlaced(true);
      onBetPlaced();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to place bet");
      setPlacing(false);
      setShowBlindConfirm(false);
    }
  };

  const handleBlindBetClick = () => {
    if (betAmount < 1 || betAmount > maxPoints) return;
    setShowBlindConfirm(true);
  };

  const handleBlindBetConfirm = () => {
    handlePlaceBet(true);
  };

  return (
    <div className="card p-6">
      <div className="text-center mb-6">
        <p className="text-sm text-[#a0a0b8] uppercase tracking-wider">
          Category
        </p>
        {showCategory ? (
          <>
            <p className="text-2xl font-bold text-[#fbbf24] mt-1">{category}</p>
            {answerFormat && (
              <span className="inline-block mt-1 px-2 py-0.5 rounded-full text-xs font-medium bg-[#1e3a5f] text-[#a0a0b8]">
                {FORMAT_LABELS[answerFormat] ?? answerFormat}
              </span>
            )}
          </>
        ) : (
          <div className="mt-2 px-4 py-3 rounded-lg bg-[#1a1a2e] border border-amber-500/30">
            <p className="text-lg font-bold text-[#666680]">???</p>
            <p className="text-xs text-amber-400/70 mt-1">
              Category hidden — blind bet or reveal below
            </p>
          </div>
        )}
        {showCategory && (atBatAvgRating != null || atBatSuccessRate != null) && (
          <div className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#fbbf24]/10 border border-[#fbbf24]/20 flex-wrap">
            <span className="text-xs text-[#a0a0b8] font-medium">Question submitter stats:</span>
            {atBatAvgRating != null && (
              <>
                <span className="text-sm text-[#fbbf24] font-bold">{atBatAvgRating.toFixed(1)}</span>
                <span className="text-xs text-[#666680]">/ 5</span>
              </>
            )}
            {atBatAvgRating != null && atBatSuccessRate != null && (
              <span className="text-xs text-[#666680]">|</span>
            )}
            {atBatSuccessRate != null && (
              <span className="text-sm text-[#a0a0b8] font-bold">{Math.round(atBatSuccessRate * 100)}% correct</span>
            )}
            <InfoTooltip text="Star rating: average from players who rated this submitter's questions. Success %: how often players answer their questions correctly." />
          </div>
        )}
        {answerDeadline && (
          <div className="mt-2">
            <CountdownTimer deadlineTime={answerDeadline} />
          </div>
        )}
        <p className="text-base text-[#a0a0b8] mt-2">
          Place your bet to see the question
        </p>
      </div>

      {maxPoints > 1 && (
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <span className="text-base text-[#a0a0b8]">1</span>
            <span className="text-base text-[#a0a0b8]">
              Available: <span className="text-white font-bold">{maxPoints}</span>
            </span>
          </div>

          <div className="relative pt-8">
            {/* Floating value label above thumb */}
            <div
              className="absolute top-0 -translate-x-1/2 pointer-events-none"
              style={{ left: `${((betAmount - 1) / Math.max(maxPoints - 1, 1)) * 100}%` }}
            >
              <div className="bg-[#fbbf24] text-black text-sm font-bold px-2.5 py-0.5 rounded-full whitespace-nowrap">
                {betAmount}
              </div>
              <div className="w-0 h-0 mx-auto border-l-[5px] border-r-[5px] border-t-[5px] border-transparent border-t-[#fbbf24]" />
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
        </div>
      )}

      {error && (
        <div className="text-red-400 text-sm bg-red-500/10 rounded-lg p-3 mb-4">
          {error}
        </div>
      )}

      {/* Blind bet confirmation */}
      {showBlindConfirm && (
        <div className="mb-4 p-4 rounded-lg bg-amber-500/10 border border-amber-500/30">
          <p className="text-sm text-amber-400 font-bold mb-1">
            Go Blind?
          </p>
          <p className="text-xs text-[#a0a0b8] mb-3">
            Your bet of {betAmount} point{betAmount === 1 ? "" : "s"} will be doubled -- win or lose!
            This can only be used once per game.
          </p>
          <div className="flex gap-2">
            <button
              onClick={handleBlindBetConfirm}
              disabled={placing}
              className="btn-gold text-sm flex-1"
            >
              {placing ? <span className="inline-flex items-center justify-center gap-2"><Spinner /> Placing...</span> : `Confirm Blind Bet (${betAmount} x2)`}
            </button>
            <button
              onClick={() => setShowBlindConfirm(false)}
              disabled={placing}
              className="btn-secondary text-sm"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {canBlindBet && !categoryRevealed && !showBlindConfirm ? (
        <div className="flex gap-2">
          <button
            onClick={handleBlindBetClick}
            disabled={placing || betAmount < 1}
            className="flex-1 text-lg font-bold py-3 rounded-lg transition-colors bg-amber-500/20 border border-amber-500/40 text-amber-400 hover:bg-amber-500/30"
          >
            Blind Bet {betAmount} point{betAmount === 1 ? "" : "s"} (2x)
          </button>
          <button
            onClick={() => setCategoryRevealed(true)}
            disabled={placing}
            className="px-4 py-3 rounded-lg text-sm font-bold btn-secondary"
          >
            Reveal Category
          </button>
        </div>
      ) : (
        <div className="flex gap-2">
          <button
            onClick={() => handlePlaceBet(false)}
            disabled={placing || betPlaced || betAmount < 1 || showBlindConfirm}
            className={`flex-1 text-lg font-bold py-3 rounded-lg transition-colors ${
              betAmount === maxPoints
                ? "btn-gold"
                : "btn-primary"
            }`}
          >
            {betPlaced
              ? "Bet Placed!"
              : placing && !showBlindConfirm
              ? <span className="inline-flex items-center justify-center gap-2"><Spinner /> Placing Bet...</span>
              : betAmount === maxPoints
                ? `Go All In! Bet ${betAmount} point${betAmount === 1 ? "" : "s"}`
                : `Bet ${betAmount} point${betAmount === 1 ? "" : "s"}`}
          </button>
        </div>
      )}

      <p className="text-center text-xs text-[#666680] mt-3">
        Bet is locked once placed. Question revealed after betting.
      </p>
    </div>
  );
}

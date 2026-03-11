"use client";

import { useState } from "react";
import { MIN_PLAYERS_FOR_FLAG } from "@/lib/constants";
import InfoTooltip from "@/components/ui/InfoTooltip";

interface ThrowFlagButtonProps {
  roundId: string;
  myPlayerId: string;
  atBatPlayerId: string | null;
  flagUsed: boolean;
  flagWindowOpen: boolean;
  activePlayerCount: number;
  hasFlagReview: boolean;
  myPoints: number;
  actAsPlayerId: string | null;
  onFlagThrown: () => void;
}

export default function ThrowFlagButton({
  roundId,
  myPlayerId,
  atBatPlayerId,
  flagUsed,
  flagWindowOpen,
  activePlayerCount,
  hasFlagReview,
  myPoints,
  actAsPlayerId,
  onFlagThrown,
}: ThrowFlagButtonProps) {
  const [expanded, setExpanded] = useState(false);
  const [objection, setObjection] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Don't show if ineligible
  if (flagUsed) return null;
  if (!flagWindowOpen) return null;
  if (myPlayerId === atBatPlayerId) return null;
  if (activePlayerCount < MIN_PLAYERS_FOR_FLAG) return null;
  if (hasFlagReview) return null;

  const penaltyAmount = Math.floor(myPoints * 0.5);

  const handleSubmit = async () => {
    if (!objection.trim()) return;
    setSubmitting(true);
    setError(null);

    try {
      const actAsParam = actAsPlayerId ? `?actAs=${actAsPlayerId}` : "";
      const res = await fetch(`/api/rounds/${roundId}/flag${actAsParam}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leaguePlayerId: myPlayerId, objection: objection.trim() }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to throw flag");
      }

      setExpanded(false);
      setObjection("");
      onFlagThrown();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to throw flag");
    } finally {
      setSubmitting(false);
    }
  };

  if (!expanded) {
    return (
      <div className="mt-4 flex items-center gap-2">
        <button
          onClick={() => setExpanded(true)}
          className="py-2 px-4 rounded-lg border border-amber-500/30 bg-amber-500/10 text-amber-400 text-sm font-medium hover:bg-amber-500/20 transition-colors flex items-center gap-2"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 text-red-500">
            <path d="M4 2a1 1 0 0 1 1 1v1h11.586a1 1 0 0 1 .707 1.707L13.414 9.5l3.879 3.793A1 1 0 0 1 16.586 15H5v6a1 1 0 1 1-2 0V3a1 1 0 0 1 1-1z" />
          </svg>
          Throw a Flag
        </button>
        <InfoTooltip text="Challenge this round if you think the grading was wrong. Other players vote on your objection. If denied, you lose 50% of your points." />
      </div>
    );
  }

  return (
    <div className="mt-4 p-4 rounded-lg border border-amber-500/30 bg-amber-500/10">
      <p className="text-sm font-semibold text-amber-400 mb-2">
        Challenge this round
      </p>
      <p className="text-xs text-[#a0a0b8] mb-3">
        If your flag is denied, you lose 50% of your points ({penaltyAmount} pts).
        Other players will vote on your objection.
      </p>

      <textarea
        value={objection}
        onChange={(e) => setObjection(e.target.value.slice(0, 500))}
        placeholder="Describe your objection..."
        className="input-field w-full text-sm mb-2 resize-none"
        rows={3}
        disabled={submitting}
      />
      <p className="text-xs text-[#666680] mb-3 text-right">
        {objection.length}/500
      </p>

      {error && (
        <p className="text-xs text-red-400 mb-3">{error}</p>
      )}

      <div className="flex gap-2">
        <button
          onClick={handleSubmit}
          disabled={submitting || !objection.trim()}
          className="btn-primary text-sm flex-1"
        >
          {submitting ? "Throwing..." : "Throw Flag"}
        </button>
        <button
          onClick={() => { setExpanded(false); setObjection(""); setError(null); }}
          disabled={submitting}
          className="btn-secondary text-sm"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

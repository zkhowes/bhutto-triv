"use client";

import { useState, useEffect, useCallback } from "react";

interface FlagReviewData {
  id: string;
  roundId: string;
  objection: string;
  status: string;
  createdAt: string;
  resolvedAt: string | null;
  flaggedBy: {
    id: string;
    nickname: string;
    avatarUrl: string | null;
  };
  atBatPlayerId: string | null;
  votes: Array<{
    leaguePlayerId: string;
    vote: string;
    isProxyVote: boolean;
    nickname: string;
    avatarUrl: string | null;
  }>;
  tally: {
    agree: number;
    disagree: number;
    totalEligible: number;
    threshold: number;
  };
}

interface FlagReviewInterfaceProps {
  roundId: string;
  myPlayerId: string | null;
  isCommissioner: boolean;
  actAsPlayerId: string | null;
  onResolved: () => void;
}

export default function FlagReviewInterface({
  roundId,
  myPlayerId,
  isCommissioner,
  actAsPlayerId,
  onResolved,
}: FlagReviewInterfaceProps) {
  const [review, setReview] = useState<FlagReviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [voting, setVoting] = useState(false);
  const [forceClosing, setForceClosing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchReview = useCallback(async () => {
    try {
      const res = await fetch(`/api/rounds/${roundId}/flag`);
      if (!res.ok) return;
      const data = await res.json();
      setReview(data.flagReview);

      // If resolved, trigger parent refresh
      if (data.flagReview?.status !== "pending") {
        onResolved();
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [roundId, onResolved]);

  useEffect(() => {
    fetchReview();
  }, [fetchReview]);

  // Poll for vote updates
  useEffect(() => {
    if (!review || review.status !== "pending") return;

    let interval: ReturnType<typeof setInterval>;
    const startPolling = () => {
      interval = setInterval(fetchReview, 15000);
    };
    const handleVisibilityChange = () => {
      if (document.hidden) clearInterval(interval);
      else { fetchReview(); startPolling(); }
    };
    startPolling();
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [review, fetchReview]);

  const handleVote = async (vote: "agree" | "disagree") => {
    setVoting(true);
    setError(null);
    try {
      const res = await fetch(`/api/rounds/${roundId}/flag/vote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leaguePlayerId: myPlayerId, vote }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to vote");
      }
      await fetchReview();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to vote");
    } finally {
      setVoting(false);
    }
  };

  const handleProxyVote = async (targetPlayerId: string, vote: "agree" | "disagree") => {
    setVoting(true);
    setError(null);
    try {
      const res = await fetch(`/api/rounds/${roundId}/flag/vote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leaguePlayerId: targetPlayerId, vote, proxyPlayerId: targetPlayerId }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to cast proxy vote");
      }
      await fetchReview();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to cast proxy vote");
    } finally {
      setVoting(false);
    }
  };

  const handleForceClose = async (resolution: "agree" | "disagree") => {
    setForceClosing(true);
    setError(null);
    try {
      const res = await fetch(`/api/rounds/${roundId}/flag/force-close`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resolution }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to force close");
      }
      await fetchReview();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to force close");
    } finally {
      setForceClosing(false);
    }
  };

  if (loading) {
    return (
      <div className="card p-5 mb-6 text-center">
        <div className="animate-pulse text-amber-400">Loading flag review...</div>
      </div>
    );
  }

  if (!review) {
    return null;
  }

  const isFlagger = myPlayerId === review.flaggedBy.id;
  const isAtBat = myPlayerId === review.atBatPlayerId;
  const myVote = review.votes.find((v) => v.leaguePlayerId === myPlayerId);
  const canVote = !isFlagger && !isAtBat && !myVote && review.status === "pending";

  // Resolved state
  if (review.status !== "pending") {
    const isAgreed = review.status === "agreed";
    return (
      <div className={`card p-5 mb-6 border ${isAgreed ? "border-emerald-500/30" : "border-red-500/30"}`}>
        <div className="text-center mb-3">
          <span className={`text-sm font-bold ${isAgreed ? "text-emerald-400" : "text-red-400"}`}>
            {isAgreed ? "Flag Upheld — Round Thrown Out" : "Flag Denied"}
          </span>
        </div>
        <p className="text-xs text-[#a0a0b8] text-center">
          {review.flaggedBy.nickname}&apos;s objection: &ldquo;{review.objection}&rdquo;
        </p>
        <div className="flex justify-center gap-4 mt-3 text-xs text-[#a0a0b8]">
          <span>Agree: {review.tally.agree}</span>
          <span>Disagree: {review.tally.disagree}</span>
          <span>Needed: {review.tally.threshold}/{review.tally.totalEligible}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="card p-5 mb-6 border border-amber-500/30">
      {/* Header */}
      <div className="text-center mb-4">
        <p className="text-lg font-bold text-amber-400 mb-1">
          Flag Under Review
        </p>
        <p className="text-sm text-[#a0a0b8]">
          {review.flaggedBy.nickname} is contesting this round
        </p>
      </div>

      {/* Objection */}
      <div className="bg-[#0f0f23] rounded-lg p-3 mb-4">
        <p className="text-xs text-[#666680] uppercase tracking-wider mb-1">Objection</p>
        <p className="text-sm text-[#e8e8e8]">&ldquo;{review.objection}&rdquo;</p>
      </div>

      {/* Vote tally */}
      <div className="flex justify-between items-center mb-4 text-sm">
        <div className="flex gap-4">
          <span className="text-emerald-400">
            Agree: {review.tally.agree}
          </span>
          <span className="text-red-400">
            Disagree: {review.tally.disagree}
          </span>
        </div>
        <span className="text-xs text-[#a0a0b8]">
          {review.tally.threshold} of {review.tally.totalEligible} needed
        </span>
      </div>

      {/* Progress bar */}
      <div className="w-full h-2 bg-[#0f0f23] rounded-full mb-4 overflow-hidden">
        <div className="h-full flex">
          <div
            className="bg-emerald-500 transition-all"
            style={{ width: `${(review.tally.agree / review.tally.totalEligible) * 100}%` }}
          />
          <div
            className="bg-red-500 transition-all"
            style={{ width: `${(review.tally.disagree / review.tally.totalEligible) * 100}%` }}
          />
        </div>
      </div>

      {/* Voting buttons */}
      {canVote && (
        <div className="flex gap-3 mb-4">
          <button
            onClick={() => handleVote("agree")}
            disabled={voting}
            className="flex-1 py-2.5 rounded-lg bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 text-sm font-medium hover:bg-emerald-500/30 transition-colors disabled:opacity-50"
          >
            {voting ? "..." : "Agree — Throw Out"}
          </button>
          <button
            onClick={() => handleVote("disagree")}
            disabled={voting}
            className="flex-1 py-2.5 rounded-lg bg-red-500/20 border border-red-500/30 text-red-400 text-sm font-medium hover:bg-red-500/30 transition-colors disabled:opacity-50"
          >
            {voting ? "..." : "Disagree — Keep"}
          </button>
        </div>
      )}

      {/* Already voted */}
      {myVote && (
        <p className="text-xs text-[#a0a0b8] text-center mb-4">
          You voted: <span className={myVote.vote === "agree" ? "text-emerald-400" : "text-red-400"}>{myVote.vote}</span>
        </p>
      )}

      {/* Flagger view */}
      {isFlagger && (
        <p className="text-xs text-amber-400/80 text-center mb-4">
          Waiting for other players to vote on your objection...
        </p>
      )}

      {/* At-bat (excluded) view */}
      {isAtBat && (
        <p className="text-xs text-[#a0a0b8] text-center mb-4">
          Your question is being reviewed. You cannot vote on this flag.
        </p>
      )}

      {/* Votes cast */}
      {review.votes.length > 0 && (
        <div className="mb-4">
          <p className="text-xs text-[#666680] uppercase tracking-wider mb-2">Votes</p>
          <div className="space-y-1">
            {review.votes.map((v) => (
              <div key={v.leaguePlayerId} className="flex justify-between items-center text-xs">
                <span className="text-[#e8e8e8]">
                  {v.nickname}
                  {v.isProxyVote && <span className="text-[#666680] ml-1">(proxy)</span>}
                </span>
                <span className={v.vote === "agree" ? "text-emerald-400" : "text-red-400"}>
                  {v.vote}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Commissioner controls */}
      {isCommissioner && review.status === "pending" && (
        <div className="border-t border-[#1e3a5f] pt-3 mt-3">
          <p className="text-xs text-[#666680] uppercase tracking-wider mb-2">Commissioner</p>
          <div className="flex gap-2">
            <button
              onClick={() => handleForceClose("agree")}
              disabled={forceClosing}
              className="flex-1 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs hover:bg-emerald-500/20 transition-colors disabled:opacity-50"
            >
              Force: Throw Out
            </button>
            <button
              onClick={() => handleForceClose("disagree")}
              disabled={forceClosing}
              className="flex-1 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs hover:bg-red-500/20 transition-colors disabled:opacity-50"
            >
              Force: Keep
            </button>
          </div>
        </div>
      )}

      {error && (
        <p className="text-xs text-red-400 mt-3 text-center">{error}</p>
      )}
    </div>
  );
}

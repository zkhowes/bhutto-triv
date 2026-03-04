"use client";

import { useState } from "react";
import Link from "next/link";

interface LeagueHeaderProps {
  leagueId: string;
  leagueName: string;
  shareType?: "league" | "game";
  shareEntityId?: string;
}

export default function LeagueHeader({
  leagueId,
  leagueName,
  shareType = "league",
  shareEntityId,
}: LeagueHeaderProps) {
  const [copied, setCopied] = useState(false);

  const handleShare = async () => {
    try {
      const res = await fetch("/api/share", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leagueId,
          type: shareType,
          entityId: shareEntityId,
        }),
      });
      if (!res.ok) return;
      const { url } = await res.json();
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // silently fail
    }
  };

  return (
    <div className="flex items-center justify-between mb-6">
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-bold text-white">{leagueName}</h1>
        <Link
          href={`/leagues/${leagueId}/hall-of-fame`}
          className="px-3 py-1 rounded-md bg-[#fbbf24]/20 text-[#fbbf24] text-xs font-bold uppercase tracking-wider hover:bg-[#fbbf24]/30 transition-colors flex items-center gap-1.5"
        >
          <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M5 3h14l-1.5 5H6.5L5 3zm1.5 5v2a5.5 5.5 0 0 0 11 0V8h2v2a7.5 7.5 0 0 1-5.5 7.23V20H16v2H8v-2h2.5v-2.77A7.5 7.5 0 0 1 5 10V8h1.5z" />
          </svg>
          Hall of Fame
        </Link>
      </div>
      <button
        onClick={handleShare}
        className="text-[#a0a0b8] hover:text-white transition-colors p-2 rounded-lg hover:bg-[#1e3a5f]/50 relative"
        title="Share link"
      >
        {copied ? (
          <span className="text-xs text-emerald-400 font-medium">Copied!</span>
        ) : (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
          </svg>
        )}
      </button>
    </div>
  );
}

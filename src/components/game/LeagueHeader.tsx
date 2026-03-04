"use client";

import Link from "next/link";

interface LeagueHeaderProps {
  leagueId: string;
  leagueName: string;
  showCommissioner?: boolean;
}

export default function LeagueHeader({
  leagueId,
  leagueName,
  showCommissioner,
}: LeagueHeaderProps) {
  return (
    <div className="flex items-center justify-between mb-6">
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-bold text-white">{leagueName}</h1>
        <Link
          href={`/leagues/${leagueId}/hall-of-fame`}
          className="px-3 py-1 rounded-md bg-[#fbbf24]/20 text-[#fbbf24] text-xs font-bold uppercase tracking-wider hover:bg-[#fbbf24]/30 transition-colors"
        >
          HOF
        </Link>
      </div>
      {showCommissioner && (
        <Link
          href={`/leagues/${leagueId}/commissioner`}
          className="btn-secondary text-sm"
        >
          Commissioner Tools
        </Link>
      )}
    </div>
  );
}

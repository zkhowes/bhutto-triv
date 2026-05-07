"use client";

import { useSession } from "next-auth/react";
import { useRouter, useParams } from "next/navigation";
import { useState, useEffect } from "react";
import NavBar from "@/components/layout/NavBar";
import Link from "next/link";
import InfoTooltip from "@/components/ui/InfoTooltip";
import Avatar from "@/components/ui/Avatar";
import { useRequireProfile } from "@/hooks/useRequireProfile";

interface PlayerStats {
  playerId: string;
  nickname: string;
  avatarUrl: string | null;
  totalF1Points: number;
  totalGames: number;
  totalRoundsPlayed: number;
  correctAnswers: number;
  totalAnswers: number;
  correctPct: number;
  avgPlacement: number;
  bestPlacement: number | null;
  bestCategory: string;
  bestCategoryPct: number;
  mostUsedCategory: string;
  clutchFactor: number;
  consistency: number;
  maxStreak: number;
  ironManStreak: number;
  avgBet: number;
  perfectRounds: number;
  bestGamePoints: number;
  highestRoundScore: number;
  totalWon: number;
  riskProfile: number;
  avgAnswerTime: number | null;
}

interface SeasonAward {
  id: string;
  awardType: string;
  stat: string;
  value: number | null;
  playerId: string;
  nickname: string;
  avatarUrl: string | null;
}

interface SeasonAwards {
  seasonId: string;
  seasonNumber: number;
  awards: SeasonAward[];
}

const AWARD_LABELS: Record<string, { label: string; emoji: string }> = {
  mvp: { label: "MVP", emoji: "\uD83C\uDFC6" },
  iron_man: { label: "Iron Man Award", emoji: "\uD83D\uDCAA" },
  offensive: { label: "Offensive Player of the Year", emoji: "\u2694\uFE0F" },
  defensive: { label: "Defensive Player of the Year", emoji: "\uD83D\uDEE1\uFE0F" },
  comeback: { label: "Comeback Player of the Year", emoji: "\uD83D\uDD25" },
  rookie: { label: "Rookie of the Year", emoji: "\u2B50" },
  clutch: { label: "Clutch Player", emoji: "\uD83C\uDFAF" },
  strategist: { label: "The Strategist", emoji: "\uD83E\uDDE0" },
  most_improved: { label: "Most Improved", emoji: "\uD83D\uDCC8" },
};

export default function HallOfFamePage() {
  useRequireProfile();
  const { data: session, status } = useSession();
  const router = useRouter();
  const params = useParams();
  const leagueId = params.id as string;
  const [stats, setStats] = useState<PlayerStats[]>([]);
  const [awards, setAwards] = useState<SeasonAwards[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"awards" | "career" | "advanced" | "stats">("awards");

  useEffect(() => {
    if (status === "unauthenticated") router.push("/");
  }, [status, router]);

  useEffect(() => {
    if (session?.user) {
      Promise.all([
        fetch(`/api/leagues/${leagueId}/hall-of-fame`).then((r) => r.json()),
        fetch(`/api/leagues/${leagueId}/awards`).then((r) => r.json()),
      ])
        .then(([statsData, awardsData]) => {
          setStats(Array.isArray(statsData) ? statsData : []);
          setAwards(Array.isArray(awardsData) ? awardsData : []);
          setLoading(false);
        })
        .catch(() => setLoading(false));
    }
  }, [session, leagueId]);

  if (status === "loading" || loading) {
    return (
      <div className="min-h-screen">
        <NavBar />
        <div className="flex items-center justify-center py-20">
          <div className="animate-pulse text-[#e94560]">Loading...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <NavBar />
      <div className="max-w-4xl mx-auto px-4 py-6">
        <div className="mb-6">
          <Link
            href={`/leagues/${leagueId}`}
            className="text-sm text-[#a0a0b8] hover:text-white"
          >
            &larr; Back to League
          </Link>
          <h1 className="text-2xl font-bold text-[#fbbf24] mt-2">
            &#127942; Hall of Fame
          </h1>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          {(["awards", "stats"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t as "awards" | "career" | "advanced")}
              className={`px-4 py-2 rounded-lg text-sm font-medium capitalize ${
                tab === t || (t === "stats" && (tab === "career" || tab === "advanced"))
                  ? "bg-[#e94560] text-white"
                  : "bg-[#1e3a5f] text-[#a0a0b8]"
              }`}
            >
              {t === "stats" ? "Player Stats" : "Awards"}
            </button>
          ))}
        </div>

        {/* Awards Tab */}
        {tab === "awards" && (
          awards.length === 0 ? (
            <div className="card p-8 text-center text-[#666680]">
              No season awards yet. Complete a full season to generate awards!
            </div>
          ) : (
            <>
              {/* Champion Card */}
              {stats.length > 0 && (
                <div className="card p-6 mb-6 text-center bg-gradient-to-br from-[#fbbf24]/10 to-[#1a1a2e]">
                  <p className="text-3xl font-bold text-[#fbbf24] mb-2">👑 Champion</p>
                  <div className="flex items-center justify-center gap-3">
                    <Avatar
                      src={stats[0].avatarUrl}
                      name={stats[0].nickname}
                      size="lg"
                    />
                    <div className="text-left">
                      <p className="text-xl font-bold text-white">{stats[0].nickname}</p>
                      <p className="text-sm text-[#a0a0b8]">
                        {stats[0].totalF1Points} F1 Points · {stats[0].totalGames} Games
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <div className="space-y-8">
              {awards.map((season) => (
                <div key={season.seasonId}>
                  <h2 className="text-lg font-bold text-white mb-4">
                    Season {season.seasonNumber}
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {season.awards.map((award) => {
                      const info = AWARD_LABELS[award.awardType] || {
                        label: award.awardType,
                        emoji: "\uD83C\uDFC6",
                      };
                      return (
                        <div
                          key={award.id}
                          className="card p-4 border border-[#fbbf24]/20 bg-gradient-to-br from-[#1a1a2e] to-[#0f0f23]"
                        >
                          <div className="flex items-start gap-3">
                            <span className="text-2xl">{info.emoji}</span>
                            <div className="flex-1">
                              <p className="text-[#fbbf24] font-bold text-sm">
                                {info.label}
                              </p>
                              <div className="flex items-center gap-2 mt-1.5">
                                <Avatar
                                  src={award.avatarUrl}
                                  name={award.nickname}
                                  size="sm"
                                />
                                <span className="text-white text-sm font-medium">
                                  {award.nickname}
                                </span>
                              </div>
                              <p className="text-xs text-[#a0a0b8] mt-1">
                                {award.stat}
                              </p>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
              </div>
            </>
          )
        )}

        {/* Player Stats Tab (Merged Career + Advanced) */}
        {(tab === "career" || tab === "advanced" || tab === "stats") && (
          stats.length === 0 ? (
            <div className="card p-8 text-center text-[#666680]">
              No stats yet. Play some games to build the Hall of Fame!
            </div>
          ) : (
            <div className="card overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#1e3a5f]">
                    <th className="table-header p-2 text-left sticky left-0 bg-[#1a1a2e] z-10">#</th>
                    <th className="table-header p-2 text-left sticky left-8 bg-[#1a1a2e] z-10 min-w-[120px]">Player</th>
                    <th className="table-header p-2 text-right">F1 Pts</th>
                    <th className="table-header p-2 text-right">Games</th>
                    <th className="table-header p-2 text-right">Correct %</th>
                    <th className="table-header p-2 text-right">
                      <span className="inline-flex items-center gap-1">
                        Avg Place
                        <InfoTooltip text="Average placement across all games" />
                      </span>
                    </th>
                    <th className="table-header p-2 text-right">Best</th>
                    <th className="table-header p-2 text-right">
                      <span className="inline-flex items-center gap-1">
                        Clutch
                        <InfoTooltip text="Win % on high-stakes bets (10+ pts)" />
                      </span>
                    </th>
                    <th className="table-header p-2 text-right">
                      <span className="inline-flex items-center gap-1">
                        Avg Bet
                        <InfoTooltip text="Average bet amount per round" />
                      </span>
                    </th>
                    <th className="table-header p-2 text-right">Best Cat</th>
                    <th className="table-header p-2 text-right">
                      <span className="inline-flex items-center gap-1">
                        Streak
                        <InfoTooltip text="Max correct answer streak" />
                      </span>
                    </th>
                    <th className="table-header p-2 text-right">
                      <span className="inline-flex items-center gap-1">
                        Attendance
                        <InfoTooltip text="Iron Man streak (consecutive rounds)" />
                      </span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {stats.map((s, i) => (
                    <tr key={s.playerId} className="table-row">
                      <td className="p-2 sticky left-0 bg-[#1a1a2e]">
                        <span
                          className={`font-bold ${
                            i === 0
                              ? "text-[#fbbf24]"
                              : i === 1
                                ? "text-gray-300"
                                : i === 2
                                  ? "text-amber-700"
                                  : "text-[#666680]"
                          }`}
                        >
                          {i + 1}
                        </span>
                      </td>
                      <td className="p-2 sticky left-8 bg-[#1a1a2e]">
                        <div className="flex items-center gap-2">
                          <Avatar
                            src={s.avatarUrl}
                            name={s.nickname}
                            size="sm"
                          />
                          <span className="text-white text-xs font-medium whitespace-nowrap">
                            {s.nickname}
                          </span>
                        </div>
                      </td>
                      <td className="p-2 text-right font-mono text-[#fbbf24] font-bold">
                        {s.totalF1Points}
                      </td>
                      <td className="p-2 text-right text-[#a0a0b8]">
                        {s.totalGames}
                      </td>
                      <td className="p-2 text-right text-emerald-400">
                        {Math.round(s.correctPct * 100)}%
                      </td>
                      <td className="p-2 text-right text-[#a0a0b8]">
                        {s.avgPlacement.toFixed(1)}
                      </td>
                      <td className="p-2 text-right text-[#a0a0b8]">
                        {s.bestPlacement || "-"}
                      </td>
                      <td className="p-2 text-right text-white">
                        {Math.round(s.clutchFactor * 100)}%
                      </td>
                      <td className="p-2 text-right text-white">
                        {s.avgBet.toFixed(1)}
                      </td>
                      <td className="p-2 text-right text-white text-xs">
                        {s.bestCategory}
                      </td>
                      <td className="p-2 text-right text-purple-400">
                        {s.maxStreak}
                      </td>
                      <td className="p-2 text-right text-white">
                        {s.ironManStreak}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        )}
      </div>
    </div>
  );
}

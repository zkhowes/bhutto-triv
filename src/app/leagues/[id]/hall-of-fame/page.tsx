"use client";

import { useSession } from "next-auth/react";
import { useRouter, useParams } from "next/navigation";
import { useState, useEffect } from "react";
import NavBar from "@/components/layout/NavBar";
import Link from "next/link";

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
}

export default function HallOfFamePage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const params = useParams();
  const leagueId = params.id as string;
  const [stats, setStats] = useState<PlayerStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"career" | "advanced">("career");

  useEffect(() => {
    if (status === "unauthenticated") router.push("/");
  }, [status, router]);

  useEffect(() => {
    if (session?.user) {
      fetch(`/api/leagues/${leagueId}/hall-of-fame`)
        .then((r) => r.json())
        .then((data) => {
          setStats(Array.isArray(data) ? data : []);
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
          <button
            onClick={() => setTab("career")}
            className={`px-4 py-2 rounded-lg text-sm font-medium ${
              tab === "career"
                ? "bg-[#e94560] text-white"
                : "bg-[#1e3a5f] text-[#a0a0b8]"
            }`}
          >
            Career Stats
          </button>
          <button
            onClick={() => setTab("advanced")}
            className={`px-4 py-2 rounded-lg text-sm font-medium ${
              tab === "advanced"
                ? "bg-[#e94560] text-white"
                : "bg-[#1e3a5f] text-[#a0a0b8]"
            }`}
          >
            Advanced Stats
          </button>
        </div>

        {stats.length === 0 ? (
          <div className="card p-8 text-center text-[#666680]">
            No stats yet. Play some games to build the Hall of Fame!
          </div>
        ) : tab === "career" ? (
          <div className="card overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#1e3a5f]">
                  <th className="table-header p-3 text-left">#</th>
                  <th className="table-header p-3 text-left">Player</th>
                  <th className="table-header p-3 text-right">F1 Pts</th>
                  <th className="table-header p-3 text-right">Games</th>
                  <th className="table-header p-3 text-right">Correct %</th>
                  <th className="table-header p-3 text-right">Avg Place</th>
                  <th className="table-header p-3 text-right">Best</th>
                  <th className="table-header p-3 text-right">Streak</th>
                </tr>
              </thead>
              <tbody>
                {stats.map((s, i) => (
                  <tr key={s.playerId} className="table-row">
                    <td className="p-3">
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
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        <div className="avatar-sm">
                          {s.nickname?.[0]?.toUpperCase() || "?"}
                        </div>
                        <span className="text-white text-sm font-medium">
                          {s.nickname}
                        </span>
                      </div>
                    </td>
                    <td className="p-3 text-right font-mono text-[#fbbf24] font-bold">
                      {s.totalF1Points}
                    </td>
                    <td className="p-3 text-right text-sm text-[#a0a0b8]">
                      {s.totalGames}
                    </td>
                    <td className="p-3 text-right text-sm text-emerald-400">
                      {Math.round(s.correctPct * 100)}%
                    </td>
                    <td className="p-3 text-right text-sm text-[#a0a0b8]">
                      {s.avgPlacement.toFixed(1)}
                    </td>
                    <td className="p-3 text-right text-sm text-[#a0a0b8]">
                      {s.bestPlacement || "-"}
                    </td>
                    <td className="p-3 text-right text-sm text-purple-400">
                      {s.maxStreak}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {stats.map((s) => (
              <div key={s.playerId} className="card p-4">
                <div className="flex items-center gap-2 mb-3">
                  <div className="avatar-sm">
                    {s.nickname?.[0]?.toUpperCase() || "?"}
                  </div>
                  <span className="text-white font-semibold">{s.nickname}</span>
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-[#666680] text-xs">Clutch Factor</p>
                    <p className="text-white font-medium">
                      {Math.round(s.clutchFactor * 100)}%
                    </p>
                  </div>
                  <div>
                    <p className="text-[#666680] text-xs">Consistency</p>
                    <p className="text-white font-medium">
                      {s.consistency.toFixed(2)}
                    </p>
                  </div>
                  <div>
                    <p className="text-[#666680] text-xs">Best Category</p>
                    <p className="text-white font-medium">{s.bestCategory}</p>
                  </div>
                  <div>
                    <p className="text-[#666680] text-xs">Iron Man</p>
                    <p className="text-white font-medium">
                      {s.ironManStreak} rounds
                    </p>
                  </div>
                  <div>
                    <p className="text-[#666680] text-xs">Avg Bet</p>
                    <p className="text-white font-medium">
                      {s.avgBet.toFixed(1)}
                    </p>
                  </div>
                  <div>
                    <p className="text-[#666680] text-xs">Perfect Rounds</p>
                    <p className="text-white font-medium">{s.perfectRounds}</p>
                  </div>
                  <div>
                    <p className="text-[#666680] text-xs">Best Game Score</p>
                    <p className="text-[#fbbf24] font-bold">
                      {s.bestGamePoints}
                    </p>
                  </div>
                  <div>
                    <p className="text-[#666680] text-xs">Highest Round</p>
                    <p className="text-[#fbbf24] font-bold">
                      {s.highestRoundScore}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

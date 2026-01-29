"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import NavBar from "@/components/layout/NavBar";

interface AdminData {
  overview: {
    totalPlayers: number;
    totalLeagues: number;
    activeLeagues: number;
    totalGamesStarted: number;
    totalGamesCompleted: number;
    totalQuestions: number;
    totalRounds: number;
    activeUsers7d: number;
    activeUsers30d: number;
    avgLeagueSize: number;
    gameCompletionRate: number;
  };
  recentLeagues: Array<{
    id: string;
    name: string;
    type: string;
    commissioner: string;
    playerCount: number;
    currentSeason: number;
    currentGame: number;
    createdAt: string;
    isActive: boolean;
  }>;
  recentPlayers: Array<{
    id: string;
    nickname: string;
    email: string;
    leagueCount: number;
    createdAt: string;
    lastLogin: string | null;
  }>;
}

export default function AdminPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [data, setData] = useState<AdminData | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"overview" | "leagues" | "players">(
    "overview"
  );

  useEffect(() => {
    if (status === "unauthenticated") router.push("/");
  }, [status, router]);

  useEffect(() => {
    if (session?.user) {
      fetch("/api/admin")
        .then((r) => {
          if (!r.ok) throw new Error("Not authorized");
          return r.json();
        })
        .then(setData)
        .catch(() => router.push("/dashboard"))
        .finally(() => setLoading(false));
    }
  }, [session, router]);

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

  if (!data) return null;

  const { overview } = data;

  return (
    <div className="min-h-screen">
      <NavBar />
      <div className="max-w-6xl mx-auto px-4 py-6">
        <h1 className="text-2xl font-bold text-amber-400 mb-6">
          Super Admin Dashboard
        </h1>

        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          {(["overview", "leagues", "players"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 rounded-lg text-sm font-medium capitalize ${
                tab === t
                  ? "bg-amber-500 text-black"
                  : "bg-[#1e3a5f] text-[#a0a0b8]"
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {tab === "overview" && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {[
              { label: "Total Players", value: overview.totalPlayers },
              { label: "Active Leagues", value: overview.activeLeagues },
              { label: "Total Leagues", value: overview.totalLeagues },
              { label: "Games Started", value: overview.totalGamesStarted },
              { label: "Games Completed", value: overview.totalGamesCompleted },
              { label: "Questions", value: overview.totalQuestions },
              { label: "Rounds Played", value: overview.totalRounds },
              { label: "Active (7d)", value: overview.activeUsers7d },
              { label: "Active (30d)", value: overview.activeUsers30d },
              { label: "Avg League Size", value: overview.avgLeagueSize },
              {
                label: "Completion Rate",
                value: `${overview.gameCompletionRate}%`,
              },
            ].map((stat) => (
              <div key={stat.label} className="stat-card">
                <div className="stat-value">{stat.value}</div>
                <div className="stat-label">{stat.label}</div>
              </div>
            ))}
          </div>
        )}

        {tab === "leagues" && (
          <div className="card overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#1e3a5f]">
                  <th className="table-header p-3 text-left">League</th>
                  <th className="table-header p-3 text-left">Commissioner</th>
                  <th className="table-header p-3 text-center">Players</th>
                  <th className="table-header p-3 text-center">Type</th>
                  <th className="table-header p-3 text-center">Season</th>
                  <th className="table-header p-3 text-right">Created</th>
                </tr>
              </thead>
              <tbody>
                {data.recentLeagues.map((l) => (
                  <tr key={l.id} className="table-row">
                    <td className="p-3 text-white text-sm">{l.name}</td>
                    <td className="p-3 text-[#a0a0b8] text-sm">
                      {l.commissioner}
                    </td>
                    <td className="p-3 text-center text-sm text-[#a0a0b8]">
                      {l.playerCount}
                    </td>
                    <td className="p-3 text-center">
                      <span
                        className={`badge ${
                          l.type === "test"
                            ? "bg-purple-500/20 text-purple-400"
                            : "bg-blue-500/20 text-blue-400"
                        }`}
                      >
                        {l.type}
                      </span>
                    </td>
                    <td className="p-3 text-center text-sm text-[#a0a0b8]">
                      S{l.currentSeason} G{l.currentGame}
                    </td>
                    <td className="p-3 text-right text-sm text-[#666680]">
                      {new Date(l.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === "players" && (
          <div className="card overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#1e3a5f]">
                  <th className="table-header p-3 text-left">Player</th>
                  <th className="table-header p-3 text-left">Email</th>
                  <th className="table-header p-3 text-center">Leagues</th>
                  <th className="table-header p-3 text-right">Joined</th>
                  <th className="table-header p-3 text-right">Last Login</th>
                </tr>
              </thead>
              <tbody>
                {data.recentPlayers.map((p) => (
                  <tr key={p.id} className="table-row">
                    <td className="p-3 text-white text-sm">
                      {p.nickname || "—"}
                    </td>
                    <td className="p-3 text-[#a0a0b8] text-sm">{p.email}</td>
                    <td className="p-3 text-center text-sm text-[#a0a0b8]">
                      {p.leagueCount}
                    </td>
                    <td className="p-3 text-right text-sm text-[#666680]">
                      {new Date(p.createdAt).toLocaleDateString()}
                    </td>
                    <td className="p-3 text-right text-sm text-[#666680]">
                      {p.lastLogin
                        ? new Date(p.lastLogin).toLocaleDateString()
                        : "Never"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

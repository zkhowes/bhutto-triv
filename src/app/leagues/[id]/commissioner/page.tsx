"use client";

import { useSession } from "next-auth/react";
import { useRouter, useParams } from "next/navigation";
import { useState, useEffect, useCallback } from "react";
import NavBar from "@/components/layout/NavBar";
import Link from "next/link";

interface Player {
  id: string;
  role: string;
  isFake: boolean;
  fakeNickname: string | null;
  user: {
    id: string;
    nickname: string;
    name: string;
    avatarUrl: string | null;
    image: string | null;
  };
}

interface LeagueInfo {
  id: string;
  name: string;
  type: string;
  gamesPerSeason: number;
  roundsPerGame: number;
  dailyDeadline: string;
  deadlineTimezone: string;
  submissionWindowStart: string;
  submissionWindowEnd: string;
  categoryRevealTime: string;
  answerTimerSeconds: number;
  absenteePenaltyType: string;
  myRole: string | null;
  players: Player[];
  seasons: Array<{
    id: string;
    number: number;
    status: string;
    games: Array<{
      id: string;
      number: number;
      status: string;
      rounds: Array<{
        id: string;
        number: number;
        status: string;
        atBatPlayerId: string | null;
      }>;
    }>;
  }>;
}

export default function CommissionerPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const params = useParams();
  const leagueId = params.id as string;
  const [league, setLeague] = useState<LeagueInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"players" | "game" | "season" | "settings">(
    "players"
  );
  const [transferTo, setTransferTo] = useState("");

  const fetchLeague = useCallback(async () => {
    try {
      const res = await fetch(`/api/leagues/${leagueId}`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      if (data.myRole !== "commissioner") {
        router.push(`/leagues/${leagueId}`);
        return;
      }
      setLeague(data);
    } catch {
      router.push("/dashboard");
    } finally {
      setLoading(false);
    }
  }, [leagueId, router]);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/");
    if (session?.user) fetchLeague();
  }, [status, session, router, fetchLeague]);

  const removePlayer = async (playerId: string) => {
    if (!confirm("Remove this player from the league?")) return;
    await fetch(`/api/leagues/${leagueId}/players`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ playerId }),
    });
    await fetchLeague();
  };

  const transferCommissioner = async () => {
    if (!transferTo) return;
    if (!confirm("Transfer commissioner role? This cannot be undone easily."))
      return;
    await fetch(`/api/leagues/${leagueId}/commissioner`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ newCommissionerId: transferTo }),
    });
    router.push(`/leagues/${leagueId}`);
  };

  const skipPlayer = async (roundId: string) => {
    await fetch(`/api/rounds/${roundId}/skip`, { method: "POST" });
    await fetchLeague();
  };

  const revealCategory = async (roundId: string) => {
    await fetch(`/api/rounds/${roundId}/reveal`, { method: "POST" });
    await fetchLeague();
  };

  const closeRound = async (roundId: string) => {
    if (!confirm("Close this round and calculate scores?")) return;
    await fetch(`/api/rounds/${roundId}/close`, { method: "POST" });
    await fetchLeague();
  };

  const pauseSeason = async (seasonId: string) => {
    await fetch(`/api/leagues/${leagueId}/settings`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    // Update season status directly
    alert("Season paused (feature in progress)");
  };

  const startNewSeason = async () => {
    await fetch(`/api/leagues/${leagueId}/start`, { method: "POST" });
    await fetchLeague();
  };

  if (status === "loading" || loading || !league) {
    return (
      <div className="min-h-screen">
        <NavBar />
        <div className="flex items-center justify-center py-20">
          <div className="animate-pulse text-[#e94560]">Loading...</div>
        </div>
      </div>
    );
  }

  const currentSeason = league.seasons[0];
  const currentGame = currentSeason?.games[0];
  const activeRound = currentGame?.rounds?.find(
    (r) => r.status !== "pending" && r.status !== "graded"
  );
  const hasActiveSeason = currentSeason?.status === "active";

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
            Commissioner Tools
          </h1>
          <p className="text-sm text-[#a0a0b8]">{league.name}</p>
        </div>

        {/* Tabs */}
        <div className="flex flex-wrap gap-2 mb-6">
          {(["players", "game", "season", "settings"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 rounded-lg text-sm font-medium capitalize ${
                tab === t
                  ? "bg-[#e94560] text-white"
                  : "bg-[#1e3a5f] text-[#a0a0b8]"
              }`}
            >
              {t === "game" ? "Game Controls" : t}
            </button>
          ))}
        </div>

        {/* Players Tab */}
        {tab === "players" && (
          <div className="space-y-4">
            <div className="card p-5">
              <h2 className="text-sm font-semibold text-[#a0a0b8] uppercase tracking-wider mb-3">
                Current Roster
              </h2>
              <div className="space-y-2">
                {league.players.map((p) => {
                  const name = p.fakeNickname || p.user.nickname || p.user.name;
                  return (
                    <div
                      key={p.id}
                      className="flex items-center gap-3 py-2 px-3 rounded-lg hover:bg-[#0f0f23]/50"
                    >
                      <div className="avatar-sm">
                        {name?.[0]?.toUpperCase() || "?"}
                      </div>
                      <span className="flex-1 text-white text-sm">
                        {name}
                        {p.role === "commissioner" && (
                          <span className="ml-1.5 text-xs text-amber-400">
                            (you)
                          </span>
                        )}
                        {p.isFake && (
                          <span className="ml-1.5 text-xs text-purple-400">
                            (test)
                          </span>
                        )}
                      </span>
                      {p.role !== "commissioner" && (
                        <button
                          onClick={() => removePlayer(p.id)}
                          className="text-xs text-red-400 hover:text-red-300"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="card p-5">
              <h2 className="text-sm font-semibold text-[#a0a0b8] uppercase tracking-wider mb-3">
                Transfer Commissioner
              </h2>
              <div className="flex gap-2">
                <select
                  value={transferTo}
                  onChange={(e) => setTransferTo(e.target.value)}
                  className="input-field flex-1"
                >
                  <option value="">Select player...</option>
                  {league.players
                    .filter((p) => p.role !== "commissioner")
                    .map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.fakeNickname || p.user.nickname || p.user.name}
                      </option>
                    ))}
                </select>
                <button
                  onClick={transferCommissioner}
                  disabled={!transferTo}
                  className="btn-danger text-sm"
                >
                  Transfer
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Game Controls Tab */}
        {tab === "game" && (
          <div className="space-y-4">
            {activeRound ? (
              <div className="card p-5">
                <h2 className="text-sm font-semibold text-[#a0a0b8] uppercase tracking-wider mb-3">
                  Active Round Controls
                </h2>
                <p className="text-white mb-3">
                  Round {activeRound.number} - Status:{" "}
                  {activeRound.status.replace(/_/g, " ")}
                </p>
                <div className="flex flex-wrap gap-2">
                  {activeRound.status === "awaiting_question" && (
                    <button
                      onClick={() => skipPlayer(activeRound.id)}
                      className="btn-secondary text-sm"
                    >
                      Skip At-Bat Player
                    </button>
                  )}
                  {activeRound.status === "question_submitted" && (
                    <button
                      onClick={() => revealCategory(activeRound.id)}
                      className="btn-primary text-sm"
                    >
                      Reveal Category
                    </button>
                  )}
                  {activeRound.status !== "graded" &&
                    activeRound.status !== "pending" && (
                      <button
                        onClick={() => closeRound(activeRound.id)}
                        className="btn-danger text-sm"
                      >
                        Close Round & Score
                      </button>
                    )}
                </div>
              </div>
            ) : (
              <div className="card p-5 text-center text-[#666680]">
                No active round. Start a season or wait for the next round.
              </div>
            )}
          </div>
        )}

        {/* Season Tab */}
        {tab === "season" && (
          <div className="space-y-4">
            <div className="card p-5">
              <h2 className="text-sm font-semibold text-[#a0a0b8] uppercase tracking-wider mb-3">
                Season Management
              </h2>
              {hasActiveSeason ? (
                <div>
                  <p className="text-white mb-3">
                    Season {currentSeason.number} is active
                  </p>
                  <button
                    onClick={() => pauseSeason(currentSeason.id)}
                    className="btn-secondary text-sm"
                  >
                    Pause Season
                  </button>
                </div>
              ) : (
                <div>
                  <p className="text-[#a0a0b8] mb-3">No active season</p>
                  <button
                    onClick={startNewSeason}
                    className="btn-gold text-sm"
                  >
                    Start New Season
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Settings Tab */}
        {tab === "settings" && (
          <div className="card p-5">
            <h2 className="text-sm font-semibold text-[#a0a0b8] uppercase tracking-wider mb-3">
              League Settings
            </h2>
            {hasActiveSeason && (
              <p className="text-amber-400 text-sm mb-4">
                Settings can only be changed between seasons.
              </p>
            )}
            <div className="space-y-3 text-sm">
              <div className="flex justify-between py-2 border-b border-[#1e3a5f]">
                <span className="text-[#a0a0b8]">Games per Season</span>
                <span className="text-white">{league.gamesPerSeason}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-[#1e3a5f]">
                <span className="text-[#a0a0b8]">Rounds per Game</span>
                <span className="text-white">{league.roundsPerGame}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-[#1e3a5f]">
                <span className="text-[#a0a0b8]">Daily Deadline</span>
                <span className="text-white">
                  {league.dailyDeadline} {league.deadlineTimezone}
                </span>
              </div>
              <div className="flex justify-between py-2 border-b border-[#1e3a5f]">
                <span className="text-[#a0a0b8]">Submission Window</span>
                <span className="text-white">
                  {league.submissionWindowStart} - {league.submissionWindowEnd}
                </span>
              </div>
              <div className="flex justify-between py-2 border-b border-[#1e3a5f]">
                <span className="text-[#a0a0b8]">Category Reveal</span>
                <span className="text-white">{league.categoryRevealTime}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-[#1e3a5f]">
                <span className="text-[#a0a0b8]">Answer Timer</span>
                <span className="text-white">
                  {Math.floor(league.answerTimerSeconds / 60)}:{(league.answerTimerSeconds % 60).toString().padStart(2, "0")} min
                </span>
              </div>
              <div className="flex justify-between py-2">
                <span className="text-[#a0a0b8]">Absentee Penalty</span>
                <span className="text-white capitalize">
                  {league.absenteePenaltyType}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

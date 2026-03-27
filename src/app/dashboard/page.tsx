"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import NavBar from "@/components/layout/NavBar";
import Link from "next/link";

interface LeagueSummary {
  id: string;
  name: string;
  type: string;
  playerCount: number;
  maxPlayers: number;
  myRole: string;
  currentSeason: { number: number; status: string } | null;
  currentGame: { number: number; status: string } | null;
  currentRound: { number: number; status: string } | null;
  inviteCode: string;
}

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [leagues, setLeagues] = useState<LeagueSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [joinCode, setJoinCode] = useState("");
  const [joinError, setJoinError] = useState("");

  useEffect(() => {
    if (status === "unauthenticated") router.push("/");
    if (status === "authenticated" && session?.user && !session.user.profileComplete) {
      router.push("/profile");
    }
  }, [status, session, router]);

  useEffect(() => {
    if (session?.user) {
      fetch("/api/leagues")
        .then((r) => r.json())
        .then((leagueData) => {
          setLeagues(Array.isArray(leagueData) ? leagueData : []);
          setLoading(false);
        })
        .catch(() => setLoading(false));
    }
  }, [session]);

  const handleJoinLeague = async () => {
    if (!joinCode.trim()) return;
    setJoinError("");
    try {
      const res = await fetch("/api/leagues/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inviteCode: joinCode.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setJoinError(data.error || "Failed to join league");
        if (data.leagueId) router.push(`/leagues/${data.leagueId}`);
        return;
      }
      router.push(`/leagues/${data.leagueId}`);
    } catch {
      setJoinError("Failed to join league");
    }
  };

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

  const handleDeleteLeague = async (leagueId: string, leagueName: string) => {
    if (!confirm(`Delete test league "${leagueName}"? This cannot be undone.`)) return;
    try {
      const res = await fetch(`/api/leagues/${leagueId}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json();
        alert(data.error || "Failed to delete league");
        return;
      }
      setLeagues((prev) => prev.filter((l) => l.id !== leagueId));
    } catch {
      alert("Failed to delete league");
    }
  };

  return (
    <div className="min-h-screen">
      <NavBar />
      <div className="max-w-4xl mx-auto px-4 py-6">
        {/* Welcome */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-white">
            Welcome back, {session?.user?.nickname || session?.user?.name}
          </h1>
          <p className="text-[#a0a0b8] text-sm mt-1">
            {leagues.length > 0
              ? `You're in ${leagues.length} league${leagues.length === 1 ? "" : "s"}`
              : "Join a league or create one to get started!"}
          </p>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          <Link href="/leagues/create" className="btn-primary text-center">
            Create League
          </Link>
          <Link
            href="/questions/workshop"
            className="btn-secondary text-center"
          >
            Question Workshop
          </Link>
        </div>

        {/* Join League */}
        <div className="card p-4 mb-6">
          <h2 className="text-sm font-semibold text-[#a0a0b8] uppercase tracking-wider mb-3">
            Join a League
          </h2>
          <div className="flex gap-2">
            <input
              type="text"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value)}
              placeholder="Enter invite code"
              className="input-field flex-1"
            />
            <button onClick={handleJoinLeague} className="btn-primary">
              Join
            </button>
          </div>
          {joinError && (
            <p className="text-red-400 text-xs mt-2">{joinError}</p>
          )}
        </div>

        {/* Active Leagues */}
        <div className="mb-6">
          <h2 className="text-sm font-semibold text-[#a0a0b8] uppercase tracking-wider mb-3">
            Your Leagues
          </h2>
          {leagues.length === 0 ? (
            <div className="card p-8 text-center">
              <p className="text-[#666680] mb-4">
                You haven&apos;t joined any leagues yet.
              </p>
              <Link href="/leagues/create" className="btn-primary">
                Create Your First League
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {leagues.map((league) => (
                <Link
                  key={league.id}
                  href={`/leagues/${league.id}`}
                  className="card-hover block p-4"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold text-white">
                        {league.name}
                        {league.myRole === "commissioner" && (
                          <span className="ml-2 badge bg-amber-500/20 text-amber-400">
                            Commissioner
                          </span>
                        )}
                      </h3>
                      <p className="text-sm text-[#a0a0b8] mt-0.5">
                        {league.playerCount}/{league.maxPlayers} players
                        {league.currentSeason && (
                          <span>
                            {" "}
                            &middot; Season {league.currentSeason.number}
                          </span>
                        )}
                        {league.currentGame && (
                          <span>
                            {" "}
                            &middot; Game {league.currentGame.number}
                          </span>
                        )}
                        {league.currentRound && (
                          <span>
                            {" "}
                            &middot; Round {league.currentRound.number}
                          </span>
                        )}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {league.currentSeason?.status === "active" && (
                        <span className="badge bg-emerald-500/20 text-emerald-400">
                          Active
                        </span>
                      )}
                      {league.type === "test" && (
                        <span className="badge bg-purple-500/20 text-purple-400">
                          Test
                        </span>
                      )}
                      {league.type === "test" && league.myRole === "commissioner" && (
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            handleDeleteLeague(league.id, league.name);
                          }}
                          className="text-red-400 hover:text-red-300 p-1"
                          title="Delete test league"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      )}
                      <svg
                        className="w-4 h-4 text-[#666680]"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 5l7 7-7 7"
                        />
                      </svg>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

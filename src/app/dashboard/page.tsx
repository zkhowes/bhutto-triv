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

interface NotificationItem {
  id: string;
  type: string;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
  data: string | null;
}

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [leagues, setLeagues] = useState<LeagueSummary[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [joinCode, setJoinCode] = useState("");
  const [joinError, setJoinError] = useState("");

  useEffect(() => {
    if (status === "unauthenticated") router.push("/");
  }, [status, router]);

  useEffect(() => {
    if (session?.user) {
      Promise.all([
        fetch("/api/leagues").then((r) => r.json()),
        fetch("/api/notifications").then((r) => r.json()),
      ])
        .then(([leagueData, notifData]) => {
          setLeagues(Array.isArray(leagueData) ? leagueData : []);
          setNotifications(notifData.notifications || []);
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

  const unreadNotifs = notifications.filter((n) => !n.isRead);

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

        {/* Notifications */}
        {unreadNotifs.length > 0 && (
          <div className="mb-6 space-y-2">
            {unreadNotifs.slice(0, 3).map((n) => (
              <div
                key={n.id}
                className="card p-3 flex items-center gap-3 border-l-4 border-l-[#e94560]"
              >
                <div className="flex-1">
                  <p className="text-sm font-medium text-white">{n.title}</p>
                  <p className="text-xs text-[#a0a0b8]">{n.message}</p>
                </div>
                <span className="text-xs text-[#666680]">
                  {new Date(n.createdAt).toLocaleDateString()}
                </span>
              </div>
            ))}
          </div>
        )}

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

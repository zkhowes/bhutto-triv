"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import NavBar from "@/components/layout/NavBar";
import Link from "next/link";
import DashboardSkipCountdown from "@/components/game/DashboardSkipCountdown";
import { useRequireProfile } from "@/hooks/useRequireProfile";

interface LeagueSummary {
  id: string;
  name: string;
  type: string;
  playerCount: number;
  maxPlayers: number;
  myRole: string;
  myLeaguePlayerId: string | null;
  gameId: string | null;
  autoSkipEnabled: boolean;
  quietHours: { enabled: boolean; start: number; end: number; timezone: string };
  currentSeason: { number: number; status: string } | null;
  currentGame: { number: number; status: string; totalRounds: number } | null;
  currentRound: { number: number; status: string } | null;
  activeRound: {
    status: string;
    atBatPlayerId: string | null;
    hasBet: boolean;
    hasAnswered: boolean;
    updatedAt: string;
  } | null;
  myStanding: { isBusted: boolean; place: number | null; total: number } | null;
  inviteCode: string;
}

function ordinal(n: number): string {
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${n}th`;
  const suffixes = ["th", "st", "nd", "rd"];
  return `${n}${suffixes[n % 10] ?? "th"}`;
}

const SKIPPABLE_STATUSES = new Set([
  "awaiting_question",
  "question_submitted",
  "category_revealed",
]);

function getLeagueAction(league: LeagueSummary): { text: string; urgent: boolean } | null {
  if (!league.activeRound) return null;
  const { status, atBatPlayerId, hasBet, hasAnswered } = league.activeRound;
  const isAtBat = atBatPlayerId === league.myLeaguePlayerId;

  if (status === "awaiting_question" && isAtBat)
    return { text: "Your turn -- submit a question", urgent: true };
  if (status === "awaiting_question")
    return { text: "Waiting for question submission", urgent: false };
  if (status === "question_submitted" && isAtBat)
    return { text: "Waiting for all answers", urgent: false };
  if (status === "question_submitted" && !hasBet)
    return { text: "New question -- place your bet", urgent: true };
  if (status === "question_submitted")
    return { text: "Bet placed -- waiting for category reveal", urgent: false };
  if (status === "category_revealed" && isAtBat)
    return { text: "Waiting for all answers", urgent: false };
  if (status === "category_revealed" && !hasAnswered)
    return { text: "Answer the question!", urgent: true };
  if (status === "category_revealed")
    return { text: "Waiting for all answers", urgent: false };
  return null;
}

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [leagues, setLeagues] = useState<LeagueSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [joinCode, setJoinCode] = useState("");
  const [joinError, setJoinError] = useState("");

  useRequireProfile();

  useEffect(() => {
    if (status === "unauthenticated") router.push("/");
  }, [status, router]);

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

        {/* Get Started — Create or Join */}
        <div className="card p-5 mb-8">
          <h2 className="text-sm font-semibold text-[#a0a0b8] uppercase tracking-wider mb-4">
            Get Started
          </h2>
          <div className="flex flex-col sm:flex-row gap-3">
            <Link href="/leagues/create" className="btn-primary text-center sm:flex-shrink-0">
              Create League
            </Link>
            <div className="flex gap-2 flex-1">
              <input
                type="text"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value)}
                placeholder="Enter invite code"
                className="input-field flex-1"
              />
              <button onClick={handleJoinLeague} className="btn-secondary">
                Join
              </button>
            </div>
          </div>
          {joinError && (
            <p className="text-red-400 text-xs mt-2">{joinError}</p>
          )}
        </div>

        {/* Your Leagues */}
        <div className="border-t border-[#1e3a5f] pt-6 mb-6">
          <div className="mb-4">
            <h2 className="text-lg font-bold text-white">
              Your Leagues
            </h2>
            {leagues.length > 0 && (
              <p className="text-sm text-[#a0a0b8] mt-0.5">
                {leagues.length} league{leagues.length !== 1 ? "s" : ""}
              </p>
            )}
          </div>
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
              {leagues.map((league) => {
                const action = getLeagueAction(league);
                const tileHref = league.gameId && league.currentGame?.status === "active"
                  ? `/games/${league.gameId}`
                  : `/leagues/${league.id}`;
                const seasonActive = league.currentSeason?.status === "active";
                const gameActive = league.currentGame?.status === "active";
                const dotClass = !seasonActive
                  ? "bg-red-400"
                  : gameActive
                    ? "bg-emerald-400"
                    : "bg-amber-400";
                const dotTitle = !seasonActive
                  ? "Not started"
                  : gameActive
                    ? "Active"
                    : "Between games";
                const showCountdown =
                  action !== null &&
                  league.autoSkipEnabled &&
                  league.activeRound !== null &&
                  SKIPPABLE_STATUSES.has(league.activeRound.status);
                return (
                  <Link
                    key={league.id}
                    href={tileHref}
                    className="card-hover block p-5"
                  >
                    <div className="flex items-center justify-between">
                      <div className="min-w-0 flex-1">
                        <h3 className="font-semibold text-white">
                          {league.name}
                          {league.myRole === "commissioner" && (
                            <span
                              className="ml-2 inline-flex items-center justify-center w-5 h-5 rounded-full bg-amber-500/20 text-amber-400 font-bold text-xs align-middle"
                              title="Commissioner"
                            >
                              C
                            </span>
                          )}
                        </h3>
                        {(league.currentSeason || league.currentGame || league.currentRound) && (
                          <p className="text-sm text-[#a0a0b8] mt-0.5">
                            {league.currentSeason && (
                              <span>S:{league.currentSeason.number}</span>
                            )}
                            {league.currentGame && (
                              <span>
                                {league.currentSeason ? " \u00b7 " : ""}G:{league.currentGame.number}
                              </span>
                            )}
                            {league.currentRound && league.currentGame && (
                              <span>
                                {" \u00b7 "}Round {league.currentRound.number} of {league.currentGame.totalRounds}
                              </span>
                            )}
                          </p>
                        )}
                        {action && (
                          <p className={`text-sm mt-1 ${action.urgent ? "text-[#fbbf24] font-medium" : "text-[#666680]"}`}>
                            {action.urgent && "\u2192 "}{action.text}
                          </p>
                        )}
                        {showCountdown && (
                          <DashboardSkipCountdown
                            roundUpdatedAt={league.activeRound!.updatedAt}
                            quietHours={league.quietHours}
                          />
                        )}
                        {league.myStanding?.isBusted ? (
                          <p className="text-xs mt-1 text-red-400">Busted</p>
                        ) : league.myStanding && league.myStanding.place !== null ? (
                          <p className="text-xs mt-1 text-[#a0a0b8]">
                            {ordinal(league.myStanding.place)} of {league.myStanding.total}
                          </p>
                        ) : null}
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span
                          className={`inline-block w-2.5 h-2.5 rounded-full ${dotClass}`}
                          title={dotTitle}
                        />
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
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

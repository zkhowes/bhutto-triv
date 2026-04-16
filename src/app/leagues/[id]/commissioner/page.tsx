"use client";

import { useSession } from "next-auth/react";
import { useRouter, useParams } from "next/navigation";
import { useState, useEffect, useCallback } from "react";
import NavBar from "@/components/layout/NavBar";
import Link from "next/link";
import Avatar from "@/components/ui/Avatar";

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
  maxPlayers: number;
  gamesPerSeason: number;
  dailyDeadline: string;
  deadlineTimezone: string;
  submissionWindowStart: string;
  submissionWindowEnd: string;
  categoryRevealTime: string;
  answerTimerSeconds: number;
  absenteePenaltyType: string;
  autoSkipEnabled: boolean;
  notificationMode: string;
  inviteCode: string;
  myRole: string | null;
  players: Player[];
  pausedPlayers: Player[];
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
  const [inviteCopied, setInviteCopied] = useState(false);
  const [addingTestPlayers, setAddingTestPlayers] = useState(false);
  const [testPlayerCount, setTestPlayerCount] = useState(1);
  const [shutdownStep, setShutdownStep] = useState(0);
  const [shutdownConfirmName, setShutdownConfirmName] = useState("");
  const [shutdownDeleting, setShutdownDeleting] = useState(false);

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

  const pausePlayer = async (playerId: string) => {
    if (!confirm("Pause this player? They'll be removed from active play but keep all their history and can rejoin later.")) return;
    await fetch(`/api/leagues/${leagueId}/players`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ playerId, action: "pause" }),
    });
    await fetchLeague();
  };

  const unpausePlayer = async (playerId: string) => {
    await fetch(`/api/leagues/${leagueId}/players`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ playerId, action: "unpause" }),
    });
    await fetchLeague();
  };

  const addTestPlayers = async () => {
    setAddingTestPlayers(true);
    try {
      const res = await fetch(`/api/leagues/${leagueId}/test-players`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ count: testPlayerCount }),
      });
      if (!res.ok) {
        const data = await res.json();
        alert(data.error || "Failed to add test players");
        return;
      }
      await fetchLeague();
    } finally {
      setAddingTestPlayers(false);
    }
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

  const forceCloseRound = async (roundId: string) => {
    if (!confirm("Force close this round? Players who haven't answered will be marked absent. You'll review grades before scoring.")) return;
    const res = await fetch(`/api/rounds/${roundId}/force-close`, { method: "POST" });
    if (res.ok) {
      const data = await res.json();
      router.push(`/rounds/${data.roundId}`);
    } else {
      await fetchLeague();
    }
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

  const continueSeason = async (newGamesPerSeason?: number) => {
    const body = newGamesPerSeason ? { gamesPerSeason: newGamesPerSeason } : {};
    const res = await fetch(`/api/leagues/${leagueId}/continue-season`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) {
      alert(data.error || "Failed to continue season");
      return;
    }
    await fetchLeague();
  };

  const startNextGame = async () => {
    if (!confirm("Start the next game? All current league members will be included.")) return;
    const res = await fetch(`/api/leagues/${leagueId}/next-game`, { method: "POST" });
    const data = await res.json();
    if (!res.ok) {
      alert(data.error || "Failed to start next game");
      return;
    }
    await fetchLeague();
  };

  const handleShutdownLeague = async () => {
    if (!league || shutdownConfirmName !== league.name) return;
    setShutdownDeleting(true);
    try {
      const res = await fetch(`/api/leagues/${leagueId}`, { method: "DELETE" });
      if (!res.ok) {
        const d = await res.json();
        alert(d.error || "Failed to delete league");
        setShutdownDeleting(false);
        return;
      }
      router.push("/dashboard");
    } catch {
      alert("Request failed");
      setShutdownDeleting(false);
    }
  };

  const saveNotificationMode = async (mode: string) => {
    await fetch(`/api/leagues/${leagueId}/notification-settings`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notificationMode: mode }),
    });
    await fetchLeague();
  };

  const toggleAutoSkip = async () => {
    const newValue = !league?.autoSkipEnabled;
    await fetch(`/api/leagues/${leagueId}/settings`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ autoSkipEnabled: newValue }),
    });
    await fetchLeague();
  };

  const saveMaxPlayers = async (value: number) => {
    await fetch(`/api/leagues/${leagueId}/settings`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ maxPlayers: value }),
    });
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
    (r) => r.status !== "pending" && r.status !== "graded" && r.status !== "cancelled"
  );
  const hasActiveSeason = currentSeason?.status === "active";
  // Season completed early = completed but fewer games than gamesPerSeason
  // currentGame.number is the total games played (games are numbered sequentially)
  const completedSeasonGameCount = currentGame?.number ?? 0;
  const seasonCompletedEarly = currentSeason?.status === "completed" && completedSeasonGameCount < league.gamesPerSeason;
  // Game is effectively done if it's "completed", or if it's "active" but has no remaining active rounds
  const latestGameComplete =
    currentGame?.status === "completed" ||
    (!!currentGame && currentGame.status === "active" && !activeRound);
  const seasonComplete = (currentGame?.number ?? 0) >= league.gamesPerSeason;
  const canStartNextGame = hasActiveSeason && latestGameComplete && !seasonComplete;

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
            {/* Invite Code */}
            <div className="card p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-[#a0a0b8] uppercase tracking-wider">
                    Invite Code
                  </p>
                  <p className="text-lg font-mono font-bold text-white mt-0.5">
                    {league.inviteCode}
                  </p>
                </div>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(league.inviteCode);
                    setInviteCopied(true);
                    setTimeout(() => setInviteCopied(false), 2000);
                  }}
                  className="btn-secondary text-sm"
                >
                  {inviteCopied ? "Copied!" : "Copy"}
                </button>
              </div>
            </div>

            {league.type === "test" && league.players.length < 10 && (
              <div className="card p-4">
                <h2 className="text-sm font-semibold text-purple-400 uppercase tracking-wider mb-3">
                  Add Test Players
                </h2>
                <div className="flex items-center gap-3">
                  <label className="text-sm text-[#a0a0b8]">Count:</label>
                  <input
                    type="number"
                    min={1}
                    max={10 - league.players.length}
                    value={testPlayerCount}
                    onChange={(e) => setTestPlayerCount(Math.max(1, Math.min(10 - league.players.length, Number(e.target.value))))}
                    className="input-field w-20"
                  />
                  <button
                    onClick={addTestPlayers}
                    disabled={addingTestPlayers}
                    className="btn-secondary text-sm"
                  >
                    {addingTestPlayers ? "Adding..." : "Add Fake Players"}
                  </button>
                </div>
              </div>
            )}

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
                      <Avatar
                        src={p.user.avatarUrl || p.user.image}
                        name={name}
                        size="sm"
                      />
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
                        <div className="flex gap-2">
                          <button
                            onClick={() => pausePlayer(p.id)}
                            className="text-xs text-amber-400 hover:text-amber-300"
                          >
                            Pause
                          </button>
                          <button
                            onClick={() => removePlayer(p.id)}
                            className="text-xs text-red-400 hover:text-red-300"
                          >
                            Remove
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {league.pausedPlayers.length > 0 && (
              <div className="card p-5">
                <h2 className="text-sm font-semibold text-[#a0a0b8] uppercase tracking-wider mb-3">
                  Paused Players
                </h2>
                <p className="text-xs text-[#666680] mb-3">
                  Paused players keep all history and stats but are excluded from new games.
                </p>
                <div className="space-y-2">
                  {league.pausedPlayers.map((p) => {
                    const name = p.fakeNickname || p.user.nickname || p.user.name;
                    return (
                      <div
                        key={p.id}
                        className="flex items-center gap-3 py-2 px-3 rounded-lg hover:bg-[#0f0f23]/50"
                      >
                        <Avatar
                          src={p.user.avatarUrl || p.user.image}
                          name={name}
                          size="sm"
                        />
                        <span className="flex-1 text-[#a0a0b8] text-sm">
                          {name}
                          <span className="ml-1.5 text-xs text-amber-400">(paused)</span>
                        </span>
                        <div className="flex gap-2">
                          <button
                            onClick={() => unpausePlayer(p.id)}
                            className="text-xs text-emerald-400 hover:text-emerald-300"
                          >
                            Resume
                          </button>
                          <button
                            onClick={() => removePlayer(p.id)}
                            className="text-xs text-red-400 hover:text-red-300"
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

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
                  {(activeRound.status === "question_submitted" ||
                    activeRound.status === "category_revealed") && (
                      <button
                        onClick={() => forceCloseRound(activeRound.id)}
                        className="btn-danger text-sm"
                      >
                        Force Close Round
                      </button>
                    )}
                </div>
              </div>
            ) : (
              <div className="card p-5 text-center text-[#666680]">
                {canStartNextGame ? (
                  <div>
                    <p className="mb-3">All rounds complete — ready for the next game.</p>
                    <div className="mb-4 text-left">
                      <p className="text-xs font-semibold text-[#a0a0b8] uppercase tracking-wider mb-2">
                        Active Players ({league.players.length})
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {league.players.map((p) => (
                          <div key={p.id} className="flex items-center gap-1.5 bg-[#0d1b2a] rounded-full px-2.5 py-1">
                            <Avatar src={p.user.avatarUrl || p.user.image} name={p.fakeNickname || p.user.nickname} size="sm" />
                            <span className="text-xs text-white">{p.fakeNickname || p.user.nickname || p.user.name}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    <button onClick={startNextGame} className="btn-gold text-sm">
                      Start Game {(currentGame?.number ?? 0) + 1}
                    </button>
                  </div>
                ) : (
                  "No active round. Start a season or wait for the next round."
                )}
              </div>
            )}

            {/* All Rounds - Edit Grades */}
            {currentGame && currentGame.rounds.length > 0 && (
              <div className="card p-5">
                <h2 className="text-sm font-semibold text-[#a0a0b8] uppercase tracking-wider mb-3">
                  All Rounds (Edit Grades)
                </h2>
                <p className="text-xs text-[#666680] mb-3">
                  Click any round to view details and edit grades if needed.
                </p>
                <div className="space-y-2">
                  {currentGame.rounds
                    .slice()
                    .sort((a, b) => a.number - b.number)
                    .map((round) => {
                      const statusColor =
                        round.status === "graded"
                          ? "text-emerald-400"
                          : round.status === "category_revealed"
                              ? "text-blue-400"
                              : "text-[#a0a0b8]";
                      const atBatPlayer = league.players.find(
                        (p) => p.id === round.atBatPlayerId
                      );
                      const atBatName = atBatPlayer
                        ? atBatPlayer.fakeNickname || atBatPlayer.user.nickname
                        : "Unknown";

                      return (
                        <div
                          key={round.id}
                          className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-[#0f0f23]/50"
                        >
                          <div className="flex-1">
                            <span className="text-white text-sm font-medium">
                              Round {round.number}
                            </span>
                            <span className={`ml-2 text-xs ${statusColor}`}>
                              {round.status.replace(/_/g, " ")}
                            </span>
                            {round.atBatPlayerId && (
                              <span className="ml-2 text-xs text-[#666680]">
                                @ {atBatName}
                              </span>
                            )}
                          </div>
                          <Link
                            href={`/rounds/${round.id}`}
                            className="text-xs text-[#e94560] hover:text-[#ff6b6b]"
                          >
                            {round.status === "graded" ? "Edit Grades" : "View"}
                          </Link>
                        </div>
                      );
                    })}
                </div>
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
                  <p className="text-white mb-1">
                    Season {currentSeason.number} is active
                  </p>
                  <p className="text-sm text-[#a0a0b8] mb-4">
                    Game {currentGame?.number ?? 0} of {league.gamesPerSeason}{latestGameComplete ? " complete" : " in progress"}
                  </p>
                  {canStartNextGame && (
                    <div className="mb-4">
                      <p className="text-xs font-semibold text-[#a0a0b8] uppercase tracking-wider mb-2">
                        Active Players ({league.players.length})
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {league.players.map((p) => (
                          <div key={p.id} className="flex items-center gap-1.5 bg-[#0d1b2a] rounded-full px-2.5 py-1">
                            <Avatar src={p.user.avatarUrl || p.user.image} name={p.fakeNickname || p.user.nickname} size="sm" />
                            <span className="text-xs text-white">{p.fakeNickname || p.user.nickname || p.user.name}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  <div className="flex flex-wrap gap-2">
                    {canStartNextGame && (
                      <button
                        onClick={startNextGame}
                        className="btn-gold text-sm"
                      >
                        Start Game {(currentGame?.number ?? 0) + 1}
                      </button>
                    )}
                    <button
                      onClick={() => pauseSeason(currentSeason.id)}
                      className="btn-secondary text-sm"
                    >
                      Pause Season
                    </button>
                  </div>
                </div>
              ) : seasonCompletedEarly ? (
                <div>
                  <p className="text-white mb-1">
                    Season {currentSeason!.number} ended early
                  </p>
                  <p className="text-sm text-amber-400 mb-1">
                    {completedSeasonGameCount} of {league.gamesPerSeason} games played — season was auto-completed before all games finished.
                  </p>
                  <p className="text-xs text-[#666680] mb-4">
                    This usually happens when <strong>Games per Season</strong> was set to {completedSeasonGameCount} at the time. You can resume the season and play the remaining games.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => continueSeason()}
                      className="btn-gold text-sm"
                    >
                      Resume Season &amp; Start Game {completedSeasonGameCount + 1}
                    </button>
                    <button
                      onClick={startNewSeason}
                      className="btn-secondary text-sm"
                    >
                      Start New Season Instead
                    </button>
                  </div>
                </div>
              ) : (
                <div>
                  <p className="text-[#a0a0b8] mb-3">No active season</p>
                  <div className="mb-4 text-left">
                    <p className="text-xs font-semibold text-[#a0a0b8] uppercase tracking-wider mb-2">
                      Active Players ({league.players.length})
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {league.players.map((p) => (
                        <div key={p.id} className="flex items-center gap-1.5 bg-[#0d1b2a] rounded-full px-2.5 py-1">
                          <Avatar src={p.user.avatarUrl || p.user.image} name={p.fakeNickname || p.user.nickname} size="sm" />
                          <span className="text-xs text-white">{p.fakeNickname || p.user.nickname || p.user.name}</span>
                        </div>
                      ))}
                    </div>
                  </div>
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
          <div className="space-y-4">
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
              <div className="flex justify-between items-center py-2 border-b border-[#1e3a5f]">
                <div>
                  <span className="text-[#a0a0b8]">Max Players</span>
                  <span className="text-xs text-[#666680] block mt-0.5">
                    {league.players.length} of {league.maxPlayers} slots filled
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => saveMaxPlayers(Math.max(2, league.maxPlayers - 1))}
                    disabled={league.maxPlayers <= league.players.length}
                    className="w-7 h-7 rounded bg-[#0d1b2a] border border-[#2a4a6f] text-white text-sm font-medium disabled:opacity-30 disabled:cursor-not-allowed hover:border-[#4fc3f7]"
                  >
                    -
                  </button>
                  <span className="text-white w-6 text-center font-medium">{league.maxPlayers}</span>
                  <button
                    onClick={() => saveMaxPlayers(Math.min(10, league.maxPlayers + 1))}
                    disabled={league.maxPlayers >= 10}
                    className="w-7 h-7 rounded bg-[#0d1b2a] border border-[#2a4a6f] text-white text-sm font-medium disabled:opacity-30 disabled:cursor-not-allowed hover:border-[#4fc3f7]"
                  >
                    +
                  </button>
                </div>
              </div>
              <div className="flex justify-between py-2 border-b border-[#1e3a5f]">
                <span className="text-[#a0a0b8]">Games per Season</span>
                <span className="text-white">{league.gamesPerSeason}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-[#1e3a5f]">
                <span className="text-[#a0a0b8]">Rounds per Game</span>
                <span className="text-white">= number of players</span>
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
              <div className="flex justify-between py-2 border-b border-[#1e3a5f]">
                <span className="text-[#a0a0b8]">Absentee Penalty</span>
                <span className="text-white capitalize">
                  {league.absenteePenaltyType}
                </span>
              </div>

              {/* Auto-Skip */}
              <div className="flex justify-between items-center py-3 border-b border-[#1e3a5f]">
                <div>
                  <span className="text-[#a0a0b8] block">Auto-Skip</span>
                  <span className="text-xs text-[#666680] block mt-1">
                    Warn at-bat players after 24h, auto-skip after 27h
                  </span>
                </div>
                <button
                  onClick={toggleAutoSkip}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    league.autoSkipEnabled ? "bg-[#e94560]" : "bg-[#1e3a5f]"
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      league.autoSkipEnabled ? "translate-x-6" : "translate-x-1"
                    }`}
                  />
                </button>
              </div>

              {/* Notification Mode */}
              <div className="py-3">
                <span className="text-[#a0a0b8] block mb-1">Notification Mode</span>
                <span className="text-xs text-[#666680] block mb-3">
                  Controls how players are notified via SMS. In-app notifications always show in the bell.
                </span>
                <div className="flex flex-col gap-2">
                  {[
                    { value: "none", label: "None", desc: "In-app only – no SMS messages" },
                    { value: "low", label: "Low", desc: "Minimum SMS to keep the game moving (you're up, new question, time to grade)" },
                    { value: "high", label: "High", desc: "Verbose – includes round results, deadline warnings, and all Low alerts" },
                  ].map((opt) => (
                    <label
                      key={opt.value}
                      className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                        league.notificationMode === opt.value
                          ? "border-[#e94560] bg-[#e94560]/10"
                          : "border-[#1e3a5f] hover:border-[#4fc3f7]/50"
                      }`}
                    >
                      <input
                        type="radio"
                        name="notificationMode"
                        value={opt.value}
                        checked={league.notificationMode === opt.value}
                        onChange={() => saveNotificationMode(opt.value)}
                        className="mt-0.5 accent-[#e94560]"
                      />
                      <div>
                        <span className="text-white text-sm font-medium">{opt.label}</span>
                        <span className="text-xs text-[#a0a0b8] block mt-0.5">{opt.desc}</span>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Danger Zone - Shutdown League */}
          <div className="card p-5 border-red-500/30 border">
            <h2 className="text-sm font-semibold text-red-400 uppercase tracking-wider mb-3">
              Danger Zone
            </h2>

            {shutdownStep === 0 && (
              <div>
                <p className="text-sm text-[#a0a0b8] mb-3">
                  Permanently shut down this league. This deletes all seasons, games, rounds, questions, answers, and player data. This action cannot be undone.
                </p>
                <button
                  onClick={() => setShutdownStep(1)}
                  className="px-4 py-2 bg-red-500/10 border border-red-500/30 text-red-400 rounded-lg text-sm hover:bg-red-500/20 transition"
                >
                  Shutdown League...
                </button>
              </div>
            )}

            {shutdownStep === 1 && (
              <div>
                <p className="text-sm text-red-400 font-medium mb-2">
                  Are you sure? This will permanently delete:
                </p>
                <ul className="text-sm text-[#a0a0b8] mb-4 space-y-1 ml-4 list-disc">
                  <li>All {league.seasons.length} season(s) and their games</li>
                  <li>All rounds, questions, and answers</li>
                  <li>All player stats and history</li>
                  <li>The league itself and its invite code</li>
                </ul>
                <div className="flex gap-2">
                  <button
                    onClick={() => setShutdownStep(2)}
                    className="px-4 py-2 bg-red-500/20 border border-red-500/40 text-red-400 rounded-lg text-sm hover:bg-red-500/30 transition"
                  >
                    I understand, continue
                  </button>
                  <button
                    onClick={() => setShutdownStep(0)}
                    className="px-4 py-2 bg-[#1e3a5f] text-[#a0a0b8] rounded-lg text-sm hover:bg-[#2a4a6f] transition"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {shutdownStep === 2 && (
              <div>
                <p className="text-sm text-red-400 font-medium mb-2">
                  Final confirmation: type the league name to confirm deletion.
                </p>
                <p className="text-xs text-[#666680] mb-3">
                  Type <span className="text-white font-mono">{league.name}</span> below:
                </p>
                <input
                  type="text"
                  value={shutdownConfirmName}
                  onChange={(e) => setShutdownConfirmName(e.target.value)}
                  placeholder={league.name}
                  className="w-full px-3 py-2 bg-[#0f0f23] border border-red-500/30 rounded-lg text-white text-sm focus:outline-none focus:border-red-500 mb-3"
                />
                <div className="flex gap-2">
                  <button
                    onClick={handleShutdownLeague}
                    disabled={shutdownConfirmName !== league.name || shutdownDeleting}
                    className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 transition disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {shutdownDeleting ? "Deleting..." : "Permanently Delete League"}
                  </button>
                  <button
                    onClick={() => {
                      setShutdownStep(0);
                      setShutdownConfirmName("");
                    }}
                    className="px-4 py-2 bg-[#1e3a5f] text-[#a0a0b8] rounded-lg text-sm hover:bg-[#2a4a6f] transition"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
          </div>
        )}
      </div>
    </div>
  );
}

"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import NavBar from "@/components/layout/NavBar";
import ChartCard from "@/components/admin/ChartCard";

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
  commissioners: Array<{
    id: string;
    nickname: string;
    email: string;
    leagueCount: number;
    totalPlayers: number;
    createdAt: string;
  }>;
  recentGames: Array<{
    id: string;
    number: number;
    status: string;
    league: { id: string; name: string };
    season: { id: string; number: number };
    totalRounds: number;
    completedRounds: number;
    startedAt: string | null;
    completedAt: string | null;
  }>;
  recentRounds: Array<{
    id: string;
    number: number;
    status: string;
    game: {
      id: string;
      number: number;
      league: { id: string; name: string };
    };
    atBatPlayer: { nickname: string } | null;
    category: string | null;
    deadlineAt: string;
  }>;
}

interface SearchResult {
  id: string;
  type: "player" | "league" | "question" | "game";
  title: string;
  subtitle: string;
  metadata?: Record<string, any>;
}

interface QuestionData {
  id: string;
  questionText: string;
  category: string;
  answerFormat: string;
  correctAnswer: string;
  creator: { nickname: string; email: string } | null;
  league: { id: string; name: string } | null;
  createdAt: string;
  stats: {
    timesAsked: number;
    totalAnswers: number;
    correctAnswers: number;
    accuracy: number;
    avgBet: number;
    highestBet: number;
  };
}

interface QuestionAnswer {
  id: string;
  player: { nickname: string; email: string };
  freeTextAnswer: string | null;
  selectedOption: string | null;
  betAmount: number;
  isCorrect: boolean;
  pointsWon: number;
  answeredAt: string | null;
}

export default function AdminPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [data, setData] = useState<AdminData | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<
    | "monitoring"
    | "leagues"
    | "players"
    | "commissioners"
    | "games"
    | "rounds"
    | "questions"
    | "notifications"
    | "test"
  >("monitoring");

  // Test tab state
  const [testPhone, setTestPhone] = useState("");
  const [testAppend, setTestAppend] = useState("");
  const [testStatus, setTestStatus] = useState<Record<string, "idle" | "sending" | "sent" | "failed">>({});
  const [testTabPassword, setTestTabPassword] = useState("");

  // Password authentication state
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [passwordInput, setPasswordInput] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const adminPasswordRef = useRef<string>("");

  // Search state
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [showSearchResults, setShowSearchResults] = useState(false);

  // Questions tab state
  const [questions, setQuestions] = useState<QuestionData[]>([]);
  const [questionsPage, setQuestionsPage] = useState(1);
  const [questionsTotalPages, setQuestionsTotalPages] = useState(1);
  const [questionsLoading, setQuestionsLoading] = useState(false);
  const [filterLeague, setFilterLeague] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");

  // Question details modal state
  const [selectedQuestion, setSelectedQuestion] = useState<QuestionData | null>(
    null
  );
  const [questionAnswers, setQuestionAnswers] = useState<QuestionAnswer[]>([]);
  const [questionDetailsLoading, setQuestionDetailsLoading] = useState(false);

  // Notifications tab state
  interface NotifStats {
    totalSent: number;
    totalSms: number;
    totalClicks: number;
    clickRate: number;
    byType: Array<{ type: string; count: number; smsCount: number; clickCount: number }>;
    dailyTrend: Array<{ date: string; count: number; smsCount: number }>;
    globalOverride: string;
    recentNotifications: Array<{
      id: string;
      type: string;
      title: string;
      userId: string;
      userNickname: string;
      smsStatus: string | null;
      clickedAt: string | null;
      createdAt: string;
    }>;
  }
  const [notifStats, setNotifStats] = useState<NotifStats | null>(null);
  const [notifLoading, setNotifLoading] = useState(false);
  const [savingOverride, setSavingOverride] = useState(false);

  // Redirect if not logged in at all
  useEffect(() => {
    if (status === "unauthenticated") router.push("/");
  }, [status, router]);

  // Check if already authenticated as super admin
  useEffect(() => {
    if (session?.user) {
      // Restore saved password so test-sms works after page reload
      const saved = sessionStorage.getItem("adminPw");
      if (saved) {
        adminPasswordRef.current = saved;
        setTestTabPassword(saved);
      }

      fetch("/api/admin/auth")
        .then((r) => r.json())
        .then((data) => {
          setIsAuthenticated(data.authenticated);
        })
        .catch(() => setIsAuthenticated(false));
    }
  }, [session]);

  // Fetch admin data once authenticated
  useEffect(() => {
    if (isAuthenticated && session?.user) {
      fetch("/api/admin")
        .then((r) => {
          if (!r.ok) throw new Error("Not authorized");
          return r.json();
        })
        .then(setData)
        .catch(() => {
          setIsAuthenticated(false);
          setPasswordError("Session expired. Please re-authenticate.");
        })
        .finally(() => setLoading(false));
    }
  }, [isAuthenticated, session]);

  // Load questions when tab changes to questions
  useEffect(() => {
    if (tab === "questions" && isAuthenticated) {
      loadQuestions();
    }
  }, [tab, questionsPage, filterLeague, filterCategory, filterDateFrom, filterDateTo, isAuthenticated]);

  // Load notification stats when tab changes to notifications
  useEffect(() => {
    if (tab === "notifications" && isAuthenticated) {
      setNotifLoading(true);
      fetch("/api/admin/notification-stats")
        .then((r) => r.json())
        .then((d) => setNotifStats(d))
        .catch(() => {})
        .finally(() => setNotifLoading(false));
    }
  }, [tab, isAuthenticated]);

  const loadQuestions = async () => {
    setQuestionsLoading(true);
    try {
      const params = new URLSearchParams({
        page: questionsPage.toString(),
        limit: "50",
      });
      if (filterLeague) params.append("league", filterLeague);
      if (filterCategory) params.append("category", filterCategory);
      if (filterDateFrom) params.append("dateFrom", filterDateFrom);
      if (filterDateTo) params.append("dateTo", filterDateTo);

      const res = await fetch(`/api/admin/questions?${params}`);
      const result = await res.json();
      setQuestions(result.questions || []);
      setQuestionsTotalPages(result.totalPages || 1);
    } catch (error) {
      console.error("Failed to load questions:", error);
    } finally {
      setQuestionsLoading(false);
    }
  };

  // Debounced search handler
  const handleSearch = useCallback(
    async (query: string) => {
      if (query.length < 2) {
        setSearchResults([]);
        setShowSearchResults(false);
        return;
      }

      try {
        const res = await fetch(
          `/api/admin/search?q=${encodeURIComponent(query)}&limit=20`
        );
        const data = await res.json();
        setSearchResults(data.results || []);
        setShowSearchResults(true);
      } catch (error) {
        console.error("Search error:", error);
      }
    },
    []
  );

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      handleSearch(searchQuery);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery, handleSearch]);

  const handleResultClick = (result: SearchResult) => {
    switch (result.type) {
      case "player":
        setTab("players");
        break;
      case "league":
        setTab("leagues");
        break;
      case "question":
        setTab("questions");
        // Could also open modal directly
        break;
      case "game":
        setTab("games");
        break;
    }
    setShowSearchResults(false);
    setSearchQuery("");
  };

  const showQuestionDetails = async (question: QuestionData) => {
    setSelectedQuestion(question);
    setQuestionDetailsLoading(true);
    try {
      const res = await fetch(`/api/admin/questions/${question.id}/answers`);
      const data = await res.json();
      setQuestionAnswers(data.answers || []);
    } catch (error) {
      console.error("Failed to load question answers:", error);
    } finally {
      setQuestionDetailsLoading(false);
    }
  };

  const closeQuestionDetails = () => {
    setSelectedQuestion(null);
    setQuestionAnswers([]);
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setPasswordError("");

    try {
      const res = await fetch("/api/admin/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: passwordInput }),
      });

      const data = await res.json();

      if (res.ok && data.authenticated) {
        setIsAuthenticated(true);
        adminPasswordRef.current = passwordInput;
        sessionStorage.setItem("adminPw", passwordInput);
        setTestTabPassword(passwordInput);
        setPasswordInput("");
      } else {
        setPasswordError(data.error || "Incorrect password");
      }
    } catch (error) {
      setPasswordError("An error occurred. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (status === "loading" || isAuthenticated === null) {
    return (
      <div className="min-h-screen">
        <NavBar />
        <div className="flex items-center justify-center py-20">
          <div className="animate-pulse text-[#e94560]">Loading...</div>
        </div>
      </div>
    );
  }

  // Show password form if not authenticated
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen">
        <NavBar />
        <div className="flex items-center justify-center py-20">
          <div className="w-full max-w-md px-4">
            <div className="bg-[#1e3a5f] rounded-lg p-8 border border-[#2a4a6f]">
              <h1 className="text-2xl font-bold text-amber-400 mb-2">
                Super Admin Access
              </h1>
              <p className="text-[#a0a0b8] text-sm mb-6">
                Enter the super admin password to access the dashboard.
              </p>

              <form onSubmit={handlePasswordSubmit}>
                <div className="mb-4">
                  <label
                    htmlFor="password"
                    className="block text-sm font-medium text-[#a0a0b8] mb-2"
                  >
                    Password
                  </label>
                  <input
                    id="password"
                    type="password"
                    value={passwordInput}
                    onChange={(e) => setPasswordInput(e.target.value)}
                    className="w-full px-4 py-2 bg-[#0d1b2a] border border-[#2a4a6f] rounded-lg text-white placeholder-[#666680] focus:outline-none focus:border-amber-500"
                    placeholder="Enter password"
                    required
                    disabled={isSubmitting}
                  />
                </div>

                {passwordError && (
                  <div className="mb-4 p-3 bg-red-500/10 border border-red-500/50 rounded-lg text-red-400 text-sm">
                    {passwordError}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full bg-amber-500 hover:bg-amber-600 text-black font-semibold py-2 px-4 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? "Verifying..." : "Access Dashboard"}
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (loading || !data) {
    return (
      <div className="min-h-screen">
        <NavBar />
        <div className="flex items-center justify-center py-20">
          <div className="animate-pulse text-[#e94560]">Loading...</div>
        </div>
      </div>
    );
  }

  const { overview } = data;

  return (
    <div className="min-h-screen">
      <NavBar />
      <div className="max-w-7xl mx-auto px-4 py-6">
        <h1 className="text-2xl font-bold text-amber-400 mb-6">
          Super Admin Dashboard
        </h1>

        {/* Search Bar */}
        <div className="mb-6 relative">
          <input
            type="text"
            placeholder="Search players, leagues, games, questions..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => searchResults.length > 0 && setShowSearchResults(true)}
            className="w-full px-4 py-3 bg-[#1e3a5f] border border-[#2a4a6f] rounded-lg text-white placeholder-[#666680] focus:outline-none focus:border-amber-500"
          />
          {showSearchResults && searchResults.length > 0 && (
            <div className="absolute top-full mt-2 w-full bg-[#1e3a5f] border border-[#2a4a6f] rounded-lg shadow-lg max-h-96 overflow-y-auto z-50">
              {searchResults.map((result) => (
                <button
                  key={`${result.type}-${result.id}`}
                  onClick={() => handleResultClick(result)}
                  className="w-full px-4 py-3 text-left hover:bg-[#2a4a6f] transition flex items-center gap-3 border-b border-[#2a4a6f] last:border-b-0"
                >
                  <span
                    className={`px-2 py-1 rounded text-xs font-medium ${
                      result.type === "player"
                        ? "bg-blue-500/20 text-blue-400"
                        : result.type === "league"
                        ? "bg-purple-500/20 text-purple-400"
                        : result.type === "question"
                        ? "bg-green-500/20 text-green-400"
                        : "bg-orange-500/20 text-orange-400"
                    }`}
                  >
                    {result.type}
                  </span>
                  <div className="flex-1">
                    <div className="text-white font-medium">{result.title}</div>
                    <div className="text-sm text-[#a0a0b8]">
                      {result.subtitle}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 overflow-x-auto">
          {(
            [
              "monitoring",
              "leagues",
              "players",
              "commissioners",
              "games",
              "rounds",
              "questions",
              "notifications",
              "test",
            ] as const
          ).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 rounded-lg text-sm font-medium capitalize whitespace-nowrap ${
                tab === t
                  ? t === "test" ? "bg-[#e94560] text-white" : "bg-amber-500 text-black"
                  : "bg-[#1e3a5f] text-[#a0a0b8]"
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {tab === "monitoring" && (
          <>
            {/* Stat Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 mb-8">
              {[
                { label: "Total Players", value: overview.totalPlayers },
                { label: "Active Leagues", value: overview.activeLeagues },
                { label: "Total Leagues", value: overview.totalLeagues },
                { label: "Games Started", value: overview.totalGamesStarted },
                {
                  label: "Games Completed",
                  value: overview.totalGamesCompleted,
                },
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

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <ChartCard title="New Players" metric="players" />
              <ChartCard title="Active Leagues" metric="leagues" />
              <ChartCard title="Games Started" metric="games_started" />
              <ChartCard title="Questions Submitted" metric="questions" />
            </div>
          </>
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

        {tab === "commissioners" && (
          <div className="card overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#1e3a5f]">
                  <th className="table-header p-3 text-left">Name</th>
                  <th className="table-header p-3 text-left">Email</th>
                  <th className="table-header p-3 text-center">
                    Leagues Managed
                  </th>
                  <th className="table-header p-3 text-center">
                    Total Players
                  </th>
                  <th className="table-header p-3 text-right">Joined</th>
                </tr>
              </thead>
              <tbody>
                {data.commissioners.map((c) => (
                  <tr key={c.id} className="table-row">
                    <td className="p-3 text-white text-sm">
                      {c.nickname || "—"}
                    </td>
                    <td className="p-3 text-[#a0a0b8] text-sm">{c.email}</td>
                    <td className="p-3 text-center text-sm text-[#a0a0b8]">
                      {c.leagueCount}
                    </td>
                    <td className="p-3 text-center text-sm text-[#a0a0b8]">
                      {c.totalPlayers}
                    </td>
                    <td className="p-3 text-right text-sm text-[#666680]">
                      {new Date(c.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === "games" && (
          <div className="card overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#1e3a5f]">
                  <th className="table-header p-3 text-left">Game</th>
                  <th className="table-header p-3 text-left">League</th>
                  <th className="table-header p-3 text-center">Season</th>
                  <th className="table-header p-3 text-center">Status</th>
                  <th className="table-header p-3 text-center">Rounds</th>
                  <th className="table-header p-3 text-right">Started</th>
                  <th className="table-header p-3 text-right">Completed</th>
                </tr>
              </thead>
              <tbody>
                {data.recentGames.map((g) => (
                  <tr key={g.id} className="table-row">
                    <td className="p-3 text-white text-sm">Game {g.number}</td>
                    <td className="p-3 text-[#a0a0b8] text-sm">
                      {g.league.name}
                    </td>
                    <td className="p-3 text-center text-sm text-[#a0a0b8]">
                      {g.season.number}
                    </td>
                    <td className="p-3 text-center">
                      <span
                        className={`badge ${
                          g.status === "completed"
                            ? "bg-green-500/20 text-green-400"
                            : g.status === "active"
                            ? "bg-blue-500/20 text-blue-400"
                            : "bg-gray-500/20 text-gray-400"
                        }`}
                      >
                        {g.status}
                      </span>
                    </td>
                    <td className="p-3 text-center text-sm text-[#a0a0b8]">
                      {g.completedRounds} / {g.totalRounds}
                    </td>
                    <td className="p-3 text-right text-sm text-[#666680]">
                      {g.startedAt
                        ? new Date(g.startedAt).toLocaleDateString()
                        : "—"}
                    </td>
                    <td className="p-3 text-right text-sm text-[#666680]">
                      {g.completedAt
                        ? new Date(g.completedAt).toLocaleDateString()
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === "rounds" && (
          <div className="card overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#1e3a5f]">
                  <th className="table-header p-3 text-left">Round</th>
                  <th className="table-header p-3 text-left">Game / League</th>
                  <th className="table-header p-3 text-left">At Bat</th>
                  <th className="table-header p-3 text-center">Status</th>
                  <th className="table-header p-3 text-left">Category</th>
                  <th className="table-header p-3 text-right">Deadline</th>
                </tr>
              </thead>
              <tbody>
                {data.recentRounds.map((r) => (
                  <tr key={r.id} className="table-row">
                    <td className="p-3 text-white text-sm">R{r.number}</td>
                    <td className="p-3 text-[#a0a0b8] text-sm">
                      {r.game.league.name} (G{r.game.number})
                    </td>
                    <td className="p-3 text-[#a0a0b8] text-sm">
                      {r.atBatPlayer?.nickname || "—"}
                    </td>
                    <td className="p-3 text-center">
                      <span
                        className={`badge ${
                          r.status === "graded"
                            ? "bg-green-500/20 text-green-400"
                            : r.status === "closed"
                            ? "bg-yellow-500/20 text-yellow-400"
                            : r.status === "category_revealed"
                            ? "bg-blue-500/20 text-blue-400"
                            : "bg-gray-500/20 text-gray-400"
                        }`}
                      >
                        {r.status}
                      </span>
                    </td>
                    <td className="p-3 text-[#a0a0b8] text-sm">
                      {r.category || "—"}
                    </td>
                    <td className="p-3 text-right text-sm text-[#666680]">
                      {new Date(r.deadlineAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === "questions" && (
          <>
            {/* Filter controls */}
            <div className="mb-4 flex flex-wrap gap-3">
              <select
                value={filterLeague}
                onChange={(e) => {
                  setFilterLeague(e.target.value);
                  setQuestionsPage(1);
                }}
                className="px-3 py-2 bg-[#1e3a5f] border border-[#2a4a6f] rounded-lg text-white text-sm focus:outline-none focus:border-amber-500"
              >
                <option value="">All Leagues</option>
                {data.recentLeagues.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </select>

              <input
                type="text"
                placeholder="Category"
                value={filterCategory}
                onChange={(e) => {
                  setFilterCategory(e.target.value);
                  setQuestionsPage(1);
                }}
                className="px-3 py-2 bg-[#1e3a5f] border border-[#2a4a6f] rounded-lg text-white text-sm placeholder-[#666680] focus:outline-none focus:border-amber-500"
              />

              <input
                type="date"
                value={filterDateFrom}
                onChange={(e) => {
                  setFilterDateFrom(e.target.value);
                  setQuestionsPage(1);
                }}
                className="px-3 py-2 bg-[#1e3a5f] border border-[#2a4a6f] rounded-lg text-white text-sm focus:outline-none focus:border-amber-500"
              />

              <input
                type="date"
                value={filterDateTo}
                onChange={(e) => {
                  setFilterDateTo(e.target.value);
                  setQuestionsPage(1);
                }}
                className="px-3 py-2 bg-[#1e3a5f] border border-[#2a4a6f] rounded-lg text-white text-sm focus:outline-none focus:border-amber-500"
              />

              {(filterLeague ||
                filterCategory ||
                filterDateFrom ||
                filterDateTo) && (
                <button
                  onClick={() => {
                    setFilterLeague("");
                    setFilterCategory("");
                    setFilterDateFrom("");
                    setFilterDateTo("");
                    setQuestionsPage(1);
                  }}
                  className="px-3 py-2 bg-red-500/20 text-red-400 rounded-lg text-sm hover:bg-red-500/30 transition"
                >
                  Clear Filters
                </button>
              )}
            </div>

            {questionsLoading ? (
              <div className="card p-8 text-center">
                <div className="animate-pulse text-[#a0a0b8]">
                  Loading questions...
                </div>
              </div>
            ) : questions.length === 0 ? (
              <div className="card p-8 text-center text-[#666680]">
                No questions found
              </div>
            ) : (
              <>
                <div className="card overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-[#1e3a5f]">
                        <th className="table-header p-3 text-left">Question</th>
                        <th className="table-header p-3 text-left">Category</th>
                        <th className="table-header p-3 text-left">Creator</th>
                        <th className="table-header p-3 text-left">League</th>
                        <th className="table-header p-3 text-center">
                          Accuracy
                        </th>
                        <th className="table-header p-3 text-center">
                          Avg Bet
                        </th>
                        <th className="table-header p-3 text-center">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {questions.map((q) => (
                        <tr key={q.id} className="table-row">
                          <td className="p-3 text-white text-sm max-w-md truncate">
                            {q.questionText}
                          </td>
                          <td className="p-3 text-sm">
                            <span className="px-2 py-1 rounded text-xs font-medium bg-purple-500/20 text-purple-400">
                              {q.category}
                            </span>
                          </td>
                          <td className="p-3 text-[#a0a0b8] text-sm">
                            {q.creator?.nickname || "—"}
                          </td>
                          <td className="p-3 text-[#a0a0b8] text-sm">
                            {q.league?.name || "—"}
                          </td>
                          <td className="p-3 text-center text-sm text-[#a0a0b8]">
                            {q.stats.accuracy}%
                          </td>
                          <td className="p-3 text-center text-sm text-[#a0a0b8]">
                            {q.stats.avgBet}
                          </td>
                          <td className="p-3 text-center">
                            <button
                              onClick={() => showQuestionDetails(q)}
                              className="px-3 py-1 bg-amber-500/20 text-amber-400 rounded text-xs hover:bg-amber-500/30 transition"
                            >
                              View Details
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                {questionsTotalPages > 1 && (
                  <div className="mt-4 flex justify-center items-center gap-2">
                    <button
                      onClick={() =>
                        setQuestionsPage((p) => Math.max(1, p - 1))
                      }
                      disabled={questionsPage === 1}
                      className="px-3 py-1 bg-[#1e3a5f] text-white rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[#2a4a6f] transition"
                    >
                      Previous
                    </button>
                    <span className="text-sm text-[#a0a0b8]">
                      Page {questionsPage} of {questionsTotalPages}
                    </span>
                    <button
                      onClick={() =>
                        setQuestionsPage((p) =>
                          Math.min(questionsTotalPages, p + 1)
                        )
                      }
                      disabled={questionsPage === questionsTotalPages}
                      className="px-3 py-1 bg-[#1e3a5f] text-white rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[#2a4a6f] transition"
                    >
                      Next
                    </button>
                  </div>
                )}
              </>
            )}
          </>
        )}

        {/* Question Details Modal */}
        {selectedQuestion && (
          <div
            className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
            onClick={closeQuestionDetails}
          >
            <div
              className="bg-[#1e3a5f] rounded-lg p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto border border-[#2a4a6f]"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex justify-between items-start mb-4">
                <h2 className="text-xl font-bold text-amber-400">
                  Question Details
                </h2>
                <button
                  onClick={closeQuestionDetails}
                  className="text-[#a0a0b8] hover:text-white transition"
                >
                  ✕
                </button>
              </div>

              <div className="mb-6">
                <p className="text-white mb-2">{selectedQuestion.questionText}</p>
                <p className="text-sm text-[#a0a0b8]">
                  <strong>Correct Answer:</strong>{" "}
                  {selectedQuestion.correctAnswer}
                </p>
                <p className="text-sm text-[#a0a0b8]">
                  <strong>Category:</strong> {selectedQuestion.category}
                </p>
                <p className="text-sm text-[#a0a0b8]">
                  <strong>Format:</strong> {selectedQuestion.answerFormat}
                </p>
              </div>

              <h3 className="text-lg font-semibold text-amber-400 mb-3">
                All Player Answers ({selectedQuestion.stats.totalAnswers})
              </h3>

              {questionDetailsLoading ? (
                <div className="text-center py-8">
                  <div className="animate-pulse text-[#a0a0b8]">Loading...</div>
                </div>
              ) : questionAnswers.length === 0 ? (
                <div className="text-center py-8 text-[#666680]">
                  No answers yet
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-[#2a4a6f]">
                        <th className="p-2 text-left text-sm text-[#a0a0b8]">
                          Player
                        </th>
                        <th className="p-2 text-left text-sm text-[#a0a0b8]">
                          Answer
                        </th>
                        <th className="p-2 text-center text-sm text-[#a0a0b8]">
                          Bet
                        </th>
                        <th className="p-2 text-center text-sm text-[#a0a0b8]">
                          Correct?
                        </th>
                        <th className="p-2 text-right text-sm text-[#a0a0b8]">
                          Points
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {questionAnswers.map((a) => (
                        <tr key={a.id} className="border-b border-[#2a4a6f]">
                          <td className="p-2 text-sm text-white">
                            {a.player.nickname}
                          </td>
                          <td className="p-2 text-sm text-[#a0a0b8]">
                            {a.freeTextAnswer || a.selectedOption || "—"}
                          </td>
                          <td className="p-2 text-center text-sm text-[#a0a0b8]">
                            {a.betAmount}
                          </td>
                          <td className="p-2 text-center">
                            <span
                              className={`text-lg ${
                                a.isCorrect
                                  ? "text-green-400"
                                  : "text-red-400"
                              }`}
                            >
                              {a.isCorrect ? "✓" : "✗"}
                            </span>
                          </td>
                          <td
                            className={`p-2 text-right text-sm font-medium ${
                              a.pointsWon >= 0
                                ? "text-green-400"
                                : "text-red-400"
                            }`}
                          >
                            {a.pointsWon > 0 ? "+" : ""}
                            {a.pointsWon}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Test Tab */}
        {tab === "test" && (
          <div className="space-y-6 max-w-2xl">
            <div className="bg-[#1e3a5f] rounded-lg p-5 border border-[#2a4a6f]">
              <h2 className="text-base font-semibold text-white mb-1">SMS Test Console</h2>
              <p className="text-xs text-[#666680] mb-5">
                Sends a real SMS via Mosio. Notifications are not recorded in the database.
              </p>

              {/* Admin password */}
              <div className="mb-4">
                <label className="block text-xs font-medium text-[#a0a0b8] uppercase tracking-wider mb-1.5">
                  Admin password
                </label>
                <input
                  type="password"
                  value={testTabPassword}
                  onChange={(e) => {
                    setTestTabPassword(e.target.value);
                    sessionStorage.setItem("adminPw", e.target.value);
                  }}
                  placeholder="Enter admin password"
                  className="w-full px-3 py-2 bg-[#0f0f23] border border-[#2a4a6f] rounded-lg text-white placeholder-[#666680] text-sm focus:outline-none focus:border-[#e94560]"
                />
              </div>

              {/* Phone number */}
              <div className="mb-4">
                <label className="block text-xs font-medium text-[#a0a0b8] uppercase tracking-wider mb-1.5">
                  Destination phone number
                </label>
                <input
                  type="tel"
                  value={testPhone}
                  onChange={(e) => setTestPhone(e.target.value)}
                  placeholder="+1 (555) 123-4567"
                  className="w-full px-3 py-2 bg-[#0f0f23] border border-[#2a4a6f] rounded-lg text-white placeholder-[#666680] text-sm focus:outline-none focus:border-[#e94560]"
                />
              </div>

              {/* Append text */}
              <div className="mb-6">
                <label className="block text-xs font-medium text-[#a0a0b8] uppercase tracking-wider mb-1.5">
                  Additional text to append (optional)
                </label>
                <textarea
                  value={testAppend}
                  onChange={(e) => setTestAppend(e.target.value)}
                  placeholder="Paste anything extra here to include at the end of the message…"
                  rows={3}
                  className="w-full px-3 py-2 bg-[#0f0f23] border border-[#2a4a6f] rounded-lg text-white placeholder-[#666680] text-sm focus:outline-none focus:border-[#e94560] resize-none"
                />
              </div>

              {/* Notification type buttons */}
              <div className="text-xs font-medium text-[#a0a0b8] uppercase tracking-wider mb-3">
                Send test notification
              </div>
              <div className="space-y-2">
                {[
                  { type: "at_bat",               icon: "⚾", label: "You're Up",           desc: "at_bat player – time to submit question" },
                  { type: "new_question",          icon: "❓", label: "New Question",        desc: "all other players – bets are open" },
                  { type: "all_answers_in",        icon: "✅", label: "All Answers In",      desc: "at_bat player – time to grade" },
                  { type: "on_deck",               icon: "🎯", label: "On Deck",             desc: "on_deck player – low level only" },
                  { type: "round_results",         icon: "🏆", label: "Round Results",       desc: "all players – high level only" },
                  { type: "about_to_be_skipped",   icon: "⚠️", label: "About to Be Skipped", desc: "last holdout – high level only" },
                ].map(({ type, icon, label, desc }) => {
                  const s = testStatus[type] ?? "idle";
                  return (
                    <div
                      key={type}
                      className="flex items-center justify-between gap-3 px-4 py-3 bg-[#0f0f23] rounded-lg border border-[#2a4a6f]"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="text-xl shrink-0">{icon}</span>
                        <div className="min-w-0">
                          <div className="text-sm font-medium text-white">{label}</div>
                          <div className="text-xs text-[#666680] truncate">{desc}</div>
                        </div>
                      </div>
                      <button
                        disabled={s === "sending" || !testPhone.trim() || !testTabPassword.trim()}
                        onClick={async () => {
                          setTestStatus((prev) => ({ ...prev, [type]: "sending" }));
                          try {
                            const res = await fetch("/api/admin/test-sms", {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ to: testPhone, type, appendText: testAppend, adminPassword: testTabPassword }),
                            });
                            const data = await res.json();
                            setTestStatus((prev) => ({ ...prev, [type]: data.error ? "failed" : "sent" }));
                            if (data.error) {
                              alert(`Failed: ${data.error}`);
                            }
                          } catch {
                            setTestStatus((prev) => ({ ...prev, [type]: "failed" }));
                            alert("Request failed");
                          }
                          // Reset to idle after 4 seconds
                          setTimeout(() => setTestStatus((prev) => ({ ...prev, [type]: "idle" })), 4000);
                        }}
                        className={`shrink-0 px-4 py-1.5 rounded-lg text-xs font-semibold transition-all border ${
                          s === "sent"
                            ? "bg-green-500/20 border-green-500/50 text-green-400"
                            : s === "failed"
                            ? "bg-red-500/20 border-red-500/50 text-red-400"
                            : s === "sending"
                            ? "bg-[#1e3a5f] border-[#2a4a6f] text-[#666680] cursor-wait"
                            : (!testPhone.trim() || !testTabPassword.trim())
                            ? "bg-[#1e3a5f] border-[#2a4a6f] text-[#666680] cursor-not-allowed"
                            : "bg-[#e94560]/10 border-[#e94560]/40 text-[#e94560] hover:bg-[#e94560]/20"
                        }`}
                      >
                        {s === "sending" ? "Sending…" : s === "sent" ? "✓ Sent" : s === "failed" ? "✗ Failed" : "Send"}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Notifications Tab */}
        {tab === "notifications" && (
          <div className="space-y-6">
            {notifLoading ? (
              <div className="py-12 text-center text-[#a0a0b8]">Loading...</div>
            ) : !notifStats ? (
              <div className="py-12 text-center text-[#a0a0b8]">No data</div>
            ) : (
              <>
                {/* Global Override Control */}
                <div className="bg-[#1e3a5f] rounded-lg p-5 border border-[#2a4a6f]">
                  <h2 className="text-sm font-semibold text-[#a0a0b8] uppercase tracking-wider mb-2">
                    Global Notification Override
                  </h2>
                  <p className="text-xs text-[#666680] mb-3">
                    Overrides all league commissioner settings. Use &quot;Force None&quot; if SMS is going haywire.
                  </p>
                  <div className="flex gap-3 flex-wrap">
                    {[
                      { value: "commissioner", label: "Commissioner Specified" },
                      { value: "none", label: "Force All to None" },
                    ].map((opt) => (
                      <button
                        key={opt.value}
                        disabled={savingOverride || notifStats.globalOverride === opt.value}
                        onClick={async () => {
                          setSavingOverride(true);
                          await fetch("/api/admin/global-settings", {
                            method: "PUT",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ notificationOverride: opt.value }),
                          });
                          setNotifStats((prev) => prev ? { ...prev, globalOverride: opt.value } : prev);
                          setSavingOverride(false);
                        }}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors border ${
                          notifStats.globalOverride === opt.value
                            ? "border-amber-500 bg-amber-500/10 text-amber-400"
                            : "border-[#2a4a6f] text-[#a0a0b8] hover:border-amber-500/50"
                        }`}
                      >
                        {opt.label}
                        {notifStats.globalOverride === opt.value && " ✓"}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Stats Cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {[
                    { label: "Total Sent", value: notifStats.totalSent.toLocaleString() },
                    { label: "SMS Sent", value: notifStats.totalSms.toLocaleString() },
                    { label: "Link Clicks", value: notifStats.totalClicks.toLocaleString() },
                    { label: "Click Rate", value: `${notifStats.clickRate.toFixed(1)}%` },
                  ].map((stat) => (
                    <div key={stat.label} className="bg-[#1e3a5f] rounded-lg p-4 border border-[#2a4a6f] text-center">
                      <div className="text-2xl font-bold text-amber-400">{stat.value}</div>
                      <div className="text-xs text-[#a0a0b8] mt-1">{stat.label}</div>
                    </div>
                  ))}
                </div>

                {/* By Type Breakdown */}
                <div className="bg-[#1e3a5f] rounded-lg p-5 border border-[#2a4a6f]">
                  <h2 className="text-sm font-semibold text-[#a0a0b8] uppercase tracking-wider mb-3">
                    Notifications by Type
                  </h2>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-[#2a4a6f]">
                          <th className="p-2 text-left text-[#a0a0b8]">Type</th>
                          <th className="p-2 text-right text-[#a0a0b8]">Total</th>
                          <th className="p-2 text-right text-[#a0a0b8]">SMS</th>
                          <th className="p-2 text-right text-[#a0a0b8]">Clicks</th>
                        </tr>
                      </thead>
                      <tbody>
                        {notifStats.byType.map((row) => (
                          <tr key={row.type} className="border-b border-[#2a4a6f]/50">
                            <td className="p-2 text-white capitalize">{row.type.replace(/_/g, " ")}</td>
                            <td className="p-2 text-right text-[#a0a0b8]">{row.count}</td>
                            <td className="p-2 text-right text-[#a0a0b8]">{row.smsCount}</td>
                            <td className="p-2 text-right text-[#a0a0b8]">{row.clickCount}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Recent Notifications */}
                <div className="bg-[#1e3a5f] rounded-lg p-5 border border-[#2a4a6f]">
                  <h2 className="text-sm font-semibold text-[#a0a0b8] uppercase tracking-wider mb-3">
                    Recent Notifications (last 50)
                  </h2>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-[#2a4a6f]">
                          <th className="p-2 text-left text-[#a0a0b8]">Type</th>
                          <th className="p-2 text-left text-[#a0a0b8]">Title</th>
                          <th className="p-2 text-left text-[#a0a0b8]">Player</th>
                          <th className="p-2 text-center text-[#a0a0b8]">SMS</th>
                          <th className="p-2 text-center text-[#a0a0b8]">Clicked</th>
                          <th className="p-2 text-right text-[#a0a0b8]">Sent</th>
                        </tr>
                      </thead>
                      <tbody>
                        {notifStats.recentNotifications.map((n) => (
                          <tr key={n.id} className="border-b border-[#2a4a6f]/50">
                            <td className="p-2 text-[#a0a0b8] capitalize text-xs">{n.type.replace(/_/g, " ")}</td>
                            <td className="p-2 text-white text-xs max-w-[180px] truncate">{n.title}</td>
                            <td className="p-2 text-[#a0a0b8] text-xs">{n.userNickname}</td>
                            <td className="p-2 text-center">
                              <span className={`text-xs ${n.smsStatus === "sent" ? "text-green-400" : n.smsStatus === "failed" ? "text-red-400" : "text-[#666680]"}`}>
                                {n.smsStatus ?? "—"}
                              </span>
                            </td>
                            <td className="p-2 text-center text-xs">
                              {n.clickedAt ? <span className="text-green-400">✓</span> : <span className="text-[#666680]">—</span>}
                            </td>
                            <td className="p-2 text-right text-xs text-[#666680]">
                              {new Date(n.createdAt).toLocaleDateString()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

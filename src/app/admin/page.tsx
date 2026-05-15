"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Fragment, useState, useEffect, useMemo, useCallback } from "react";
import NavBar from "@/components/layout/NavBar";
import ChartCard from "@/components/admin/ChartCard";

type TabName =
  | "monitoring"
  | "leagues"
  | "players"
  | "commissioners"
  | "games"
  | "rounds"
  | "questions"
  | "reviewer"
  | "notifications"
  | "test";

interface TabFilter {
  leagueId?: string;
  leagueName?: string;
  gameId?: string;
  gameNumber?: number;
  playerUserId?: string;
  playerName?: string;
  commissionerUserId?: string;
  questionId?: string;
  questionExcerpt?: string;
}

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
  leagues: Array<{
    id: string;
    name: string;
    type: string;
    commissioner: string;
    commissionerUserId: string | null;
    playerCount: number;
    currentSeason: number;
    currentSeasonId: string | null;
    currentGame: number;
    currentGameId: string | null;
    createdAt: string;
    isActive: boolean;
    notificationMode: string;
  }>;
  commissioners: Array<{
    id: string;
    nickname: string;
    email: string;
    leagueCount: number;
    leagues: Array<{ id: string; name: string }>;
    totalPlayers: number;
    createdAt: string;
  }>;
}

interface PlayerMembership {
  leaguePlayerId: string;
  leagueId: string;
  leagueName: string;
  leagueIsActive: boolean;
  leagueNotificationMode: string;
  role: string;
  isActive: boolean;
  isPaused: boolean;
  isFake: boolean;
  effectiveLevel: string;
}

interface PlayerRow {
  id: string;
  nickname: string | null;
  email: string | null;
  phoneNumber: string | null;
  hasPhone: boolean;
  notificationPreference: string | null;
  profileComplete: boolean;
  createdAt: string;
  lastLogin: string | null;
  leagueCount: number;
  memberships: PlayerMembership[];
  recentNotifications: Array<{
    id: string;
    type: string;
    smsStatus: string | null;
    smsSentAt: string | null;
    createdAt: string;
  }>;
  questionSuccessRate: number | null;
  questionAnswerCount: number;
}

interface PlayersResponse {
  players: PlayerRow[];
  total: number;
  page: number;
  totalPages: number;
  globalOverride: string;
}

interface GameRow {
  id: string;
  number: number;
  status: string;
  league: { id: string; name: string };
  season: { id: string; number: number };
  totalRounds: number;
  completedRounds: number;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
}

interface RoundRow {
  id: string;
  number: number;
  status: string;
  game: { id: string; number: number; league: { id: string; name: string } };
  atBatPlayer: {
    userId: string;
    leaguePlayerId: string;
    nickname: string;
  } | null;
  category: string | null;
  deadlineAt: string;
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
  imageUrl?: string | null;
  imageSource?: string | null;
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

function formatPhone(p: string | null): string {
  if (!p) return "";
  const digits = p.replace(/\D/g, "");
  if (digits.length === 10)
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  if (digits.length === 11 && digits.startsWith("1"))
    return `(${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  return p;
}

export default function AdminPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [data, setData] = useState<AdminData | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<TabName>("monitoring");
  const [tabFilter, setTabFilter] = useState<TabFilter>({});

  // Cross-tab navigation helper
  const goTo = useCallback((nextTab: TabName, nextFilter: TabFilter = {}) => {
    setTabFilter(nextFilter);
    setTab(nextTab);
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, []);

  const clearFilter = useCallback(() => setTabFilter({}), []);

  // Test tab state
  const [testPhone, setTestPhone] = useState("");
  const [testAppend, setTestAppend] = useState("");
  const [testStatus, setTestStatus] = useState<
    Record<string, "idle" | "sending" | "sent" | "failed">
  >({});

  // Admin authentication derived from session
  const isAuthenticated = session?.user?.isSuperAdmin ?? null;

  // Search state
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [showSearchResults, setShowSearchResults] = useState(false);

  // Per-tab text filters (client-side)
  const [leaguesFilter, setLeaguesFilter] = useState("");
  const [commissionersFilter, setCommissionersFilter] = useState("");

  // Players tab state (server-side paginated/searched)
  const [players, setPlayers] = useState<PlayerRow[]>([]);
  const [playersTotal, setPlayersTotal] = useState(0);
  const [playersTotalPages, setPlayersTotalPages] = useState(1);
  const [playersPage, setPlayersPage] = useState(1);
  const [playersQuery, setPlayersQuery] = useState("");
  const [playersLoading, setPlayersLoading] = useState(false);
  const [globalOverride, setGlobalOverride] = useState("commissioner");
  const [expandedPlayerId, setExpandedPlayerId] = useState<string | null>(null);

  // Games tab state
  const [games, setGames] = useState<GameRow[]>([]);
  const [gamesTotalPages, setGamesTotalPages] = useState(1);
  const [gamesPage, setGamesPage] = useState(1);
  const [gamesLoading, setGamesLoading] = useState(false);
  const [gamesFilter, setGamesFilter] = useState("");

  // Rounds tab state
  const [rounds, setRounds] = useState<RoundRow[]>([]);
  const [roundsTotalPages, setRoundsTotalPages] = useState(1);
  const [roundsPage, setRoundsPage] = useState(1);
  const [roundsLoading, setRoundsLoading] = useState(false);
  const [roundsFilter, setRoundsFilter] = useState("");

  // Questions tab state
  const [questions, setQuestions] = useState<QuestionData[]>([]);
  const [questionsPage, setQuestionsPage] = useState(1);
  const [questionsTotalPages, setQuestionsTotalPages] = useState(1);
  const [questionsLoading, setQuestionsLoading] = useState(false);
  const [filterLeague, setFilterLeague] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");
  const [filterImage, setFilterImage] = useState<"all" | "with" | "without">(
    "all"
  );
  const [questionsTextFilter, setQuestionsTextFilter] = useState("");

  // Question details modal state
  const [selectedQuestion, setSelectedQuestion] = useState<QuestionData | null>(
    null
  );
  const [questionAnswers, setQuestionAnswers] = useState<QuestionAnswer[]>([]);
  const [questionDetailsLoading, setQuestionDetailsLoading] = useState(false);
  const [selectedQuestionReviews, setSelectedQuestionReviews] = useState<
    ReviewLog[]
  >([]);

  // Reviewer tab state
  interface ReviewLog {
    id: string;
    questionId: string;
    format: string;
    category: string;
    questionText: string;
    beforeJson: string;
    afterJson: string;
    changed: boolean;
    notes: string | null;
    modelUsed: string;
    status: string;
    latencyMs: number;
    createdAt: string;
    league: { id: string; name: string } | null;
    seasonNumber: number | null;
    gameNumber: number | null;
    roundNumber: number | null;
    roundId: string | null;
    gameId: string | null;
  }
  interface ReviewSummary {
    totalReviewed: number;
    changed: number;
    errors: number;
    unavailable: number;
    avgLatencyMs: number;
  }
  const [reviewLogs, setReviewLogs] = useState<ReviewLog[]>([]);
  const [reviewLogsPage, setReviewLogsPage] = useState(1);
  const [reviewLogsTotalPages, setReviewLogsTotalPages] = useState(1);
  const [reviewLogsLoading, setReviewLogsLoading] = useState(false);
  const [reviewSummary, setReviewSummary] = useState<ReviewSummary | null>(null);
  const [reviewStatusFilter, setReviewStatusFilter] = useState<
    "" | "ok" | "review_error" | "review_unavailable"
  >("");
  const [reviewChangedOnly, setReviewChangedOnly] = useState(false);
  const [reviewQuery, setReviewQuery] = useState("");
  const [selectedReview, setSelectedReview] = useState<ReviewLog | null>(null);
  // Map questionId -> latest review log (for badges on Questions tab)
  const [reviewIndex, setReviewIndex] = useState<Map<string, ReviewLog>>(
    new Map()
  );

  // Notifications tab state
  interface NotifStats {
    totalSent: number;
    totalSms: number;
    totalClicks: number;
    clickRate: number;
    byType: Array<{
      type: string;
      count: number;
      smsCount: number;
      clickCount: number;
    }>;
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

  // Fetch admin overview data once authenticated
  useEffect(() => {
    if (isAuthenticated && session?.user) {
      fetch("/api/admin")
        .then((r) => {
          if (!r.ok) throw new Error("Not authorized");
          return r.json();
        })
        .then(setData)
        .catch(() => {})
        .finally(() => setLoading(false));
    }
  }, [isAuthenticated, session]);

  // Players loader
  const loadPlayers = useCallback(async () => {
    setPlayersLoading(true);
    try {
      const params = new URLSearchParams({
        page: playersPage.toString(),
        limit: "50",
      });
      if (playersQuery.trim()) params.append("q", playersQuery.trim());
      if (tabFilter.leagueId) params.append("leagueId", tabFilter.leagueId);
      const res = await fetch(`/api/admin/players?${params}`);
      const json: PlayersResponse = await res.json();
      setPlayers(json.players || []);
      setPlayersTotal(json.total || 0);
      setPlayersTotalPages(json.totalPages || 1);
      setGlobalOverride(json.globalOverride || "commissioner");
    } catch (e) {
      console.error("loadPlayers failed", e);
    } finally {
      setPlayersLoading(false);
    }
  }, [playersPage, playersQuery, tabFilter.leagueId]);

  useEffect(() => {
    if (tab === "players" && isAuthenticated) {
      loadPlayers();
    }
  }, [tab, isAuthenticated, loadPlayers]);

  // Reset page when filter changes
  useEffect(() => {
    setPlayersPage(1);
  }, [playersQuery, tabFilter.leagueId]);

  // Games loader
  const loadGames = useCallback(async () => {
    setGamesLoading(true);
    try {
      const params = new URLSearchParams({
        page: gamesPage.toString(),
        limit: "50",
      });
      if (tabFilter.leagueId) params.append("leagueId", tabFilter.leagueId);
      const res = await fetch(`/api/admin/games?${params}`);
      const json = await res.json();
      setGames(json.games || []);
      setGamesTotalPages(json.totalPages || 1);
    } catch (e) {
      console.error("loadGames failed", e);
    } finally {
      setGamesLoading(false);
    }
  }, [gamesPage, tabFilter.leagueId]);

  useEffect(() => {
    if (tab === "games" && isAuthenticated) loadGames();
  }, [tab, isAuthenticated, loadGames]);

  useEffect(() => {
    setGamesPage(1);
  }, [tabFilter.leagueId]);

  // Rounds loader
  const loadRounds = useCallback(async () => {
    setRoundsLoading(true);
    try {
      const params = new URLSearchParams({
        page: roundsPage.toString(),
        limit: "50",
      });
      if (tabFilter.gameId) params.append("gameId", tabFilter.gameId);
      else if (tabFilter.leagueId)
        params.append("leagueId", tabFilter.leagueId);
      if (tabFilter.playerUserId)
        params.append("playerId", tabFilter.playerUserId);
      const res = await fetch(`/api/admin/rounds?${params}`);
      const json = await res.json();
      setRounds(json.rounds || []);
      setRoundsTotalPages(json.totalPages || 1);
    } catch (e) {
      console.error("loadRounds failed", e);
    } finally {
      setRoundsLoading(false);
    }
  }, [roundsPage, tabFilter.gameId, tabFilter.leagueId, tabFilter.playerUserId]);

  useEffect(() => {
    if (tab === "rounds" && isAuthenticated) loadRounds();
  }, [tab, isAuthenticated, loadRounds]);

  useEffect(() => {
    setRoundsPage(1);
  }, [tabFilter.gameId, tabFilter.leagueId, tabFilter.playerUserId]);

  // Questions loader
  const loadQuestions = useCallback(async () => {
    setQuestionsLoading(true);
    try {
      const params = new URLSearchParams({
        page: questionsPage.toString(),
        limit: "50",
      });
      const effectiveLeague = filterLeague || tabFilter.leagueId || "";
      if (effectiveLeague) params.append("league", effectiveLeague);
      if (tabFilter.playerUserId)
        params.append("creatorUserId", tabFilter.playerUserId);
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
  }, [
    questionsPage,
    filterLeague,
    filterCategory,
    filterDateFrom,
    filterDateTo,
    tabFilter.leagueId,
    tabFilter.playerUserId,
  ]);

  useEffect(() => {
    if (tab === "questions" && isAuthenticated) loadQuestions();
  }, [tab, isAuthenticated, loadQuestions]);

  useEffect(() => {
    setQuestionsPage(1);
  }, [tabFilter.leagueId, tabFilter.playerUserId]);

  // Reviewer loader
  const loadReviewLogs = useCallback(async () => {
    setReviewLogsLoading(true);
    try {
      const params = new URLSearchParams({
        page: reviewLogsPage.toString(),
        limit: "50",
      });
      if (reviewStatusFilter) params.append("status", reviewStatusFilter);
      if (reviewChangedOnly) params.append("changedOnly", "true");
      if (tabFilter.questionId) params.append("questionId", tabFilter.questionId);
      if (reviewQuery.trim()) params.append("q", reviewQuery.trim());

      const res = await fetch(`/api/admin/question-reviews?${params}`);
      const result = await res.json();
      setReviewLogs(result.logs || []);
      setReviewLogsTotalPages(result.totalPages || 1);
      setReviewSummary(result.summary || null);
    } catch (err) {
      console.error("Failed to load review logs:", err);
    } finally {
      setReviewLogsLoading(false);
    }
  }, [
    reviewLogsPage,
    reviewStatusFilter,
    reviewChangedOnly,
    reviewQuery,
    tabFilter.questionId,
  ]);

  useEffect(() => {
    if (tab === "reviewer" && isAuthenticated) loadReviewLogs();
  }, [tab, isAuthenticated, loadReviewLogs]);

  useEffect(() => {
    setReviewLogsPage(1);
  }, [reviewStatusFilter, reviewChangedOnly, reviewQuery, tabFilter.questionId]);

  // Build reviewIndex (questionId -> latest log) whenever Questions tab loads,
  // so we can show per-row review badges. We fetch only the logs for the
  // currently-visible questions to keep it bounded.
  useEffect(() => {
    if (tab !== "questions" || !isAuthenticated || questions.length === 0) return;
    let cancelled = false;
    (async () => {
      try {
        // Fetch up to 200 most-recent logs and index by questionId. The Questions
        // tab pages 50 at a time, so 200 covers the visible page plus headroom.
        const res = await fetch(`/api/admin/question-reviews?page=1&limit=200`);
        const result = await res.json();
        if (cancelled) return;
        const idx = new Map<string, ReviewLog>();
        for (const log of (result.logs || []) as ReviewLog[]) {
          // Logs come back ordered newest-first; keep the first one we see per question.
          if (!idx.has(log.questionId)) idx.set(log.questionId, log);
        }
        setReviewIndex(idx);
      } catch (err) {
        console.error("Failed to load review index:", err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tab, isAuthenticated, questions]);

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

  // Debounced search
  const handleSearch = useCallback(async (query: string) => {
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
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      handleSearch(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, handleSearch]);

  // Filtered questions by image filter and text
  const filteredQuestions = useMemo(() => {
    let q = questions;
    if (filterImage === "with") q = q.filter((x) => x.imageUrl);
    if (filterImage === "without") q = q.filter((x) => !x.imageUrl);
    if (questionsTextFilter.trim()) {
      const f = questionsTextFilter.trim().toLowerCase();
      q = q.filter(
        (x) =>
          x.questionText.toLowerCase().includes(f) ||
          (x.creator?.nickname?.toLowerCase().includes(f) ?? false) ||
          (x.league?.name?.toLowerCase().includes(f) ?? false)
      );
    }
    return q;
  }, [questions, filterImage, questionsTextFilter]);

  const imageStats = useMemo(() => {
    const total = questions.length;
    const withImage = questions.filter((q) => q.imageUrl).length;
    const sources: Record<string, number> = {};
    for (const q of questions) {
      if (q.imageSource) {
        sources[q.imageSource] = (sources[q.imageSource] || 0) + 1;
      }
    }
    return { total, withImage, sources };
  }, [questions]);

  // Filtered leagues / commissioners / games / rounds (client-side text filter)
  const filteredLeagues = useMemo(() => {
    if (!data) return [];
    const f = leaguesFilter.trim().toLowerCase();
    if (!f) return data.leagues;
    return data.leagues.filter(
      (l) =>
        l.name.toLowerCase().includes(f) ||
        l.commissioner.toLowerCase().includes(f) ||
        l.type.toLowerCase().includes(f)
    );
  }, [data, leaguesFilter]);

  const filteredCommissioners = useMemo(() => {
    if (!data) return [];
    const f = commissionersFilter.trim().toLowerCase();
    if (!f) return data.commissioners;
    return data.commissioners.filter(
      (c) =>
        (c.nickname?.toLowerCase().includes(f) ?? false) ||
        (c.email?.toLowerCase().includes(f) ?? false)
    );
  }, [data, commissionersFilter]);

  const filteredGames = useMemo(() => {
    const f = gamesFilter.trim().toLowerCase();
    if (!f) return games;
    return games.filter(
      (g) =>
        g.league.name.toLowerCase().includes(f) ||
        g.status.toLowerCase().includes(f) ||
        `game ${g.number}`.toLowerCase().includes(f)
    );
  }, [games, gamesFilter]);

  const filteredRounds = useMemo(() => {
    const f = roundsFilter.trim().toLowerCase();
    if (!f) return rounds;
    return rounds.filter(
      (r) =>
        r.game.league.name.toLowerCase().includes(f) ||
        r.status.toLowerCase().includes(f) ||
        (r.atBatPlayer?.nickname.toLowerCase().includes(f) ?? false) ||
        (r.category?.toLowerCase().includes(f) ?? false) ||
        `r${r.number}`.includes(f)
    );
  }, [rounds, roundsFilter]);

  const handleResultClick = (result: SearchResult) => {
    switch (result.type) {
      case "player":
        goTo("players", { playerUserId: result.id, playerName: result.title });
        setPlayersQuery(result.title.split(" ")[0] || "");
        break;
      case "league":
        goTo("leagues");
        setLeaguesFilter(result.title);
        break;
      case "question":
        goTo("questions");
        setQuestionsTextFilter(result.title.slice(0, 30));
        break;
      case "game":
        goTo("games");
        break;
    }
    setShowSearchResults(false);
    setSearchQuery("");
  };

  const showQuestionDetails = async (question: QuestionData) => {
    setSelectedQuestion(question);
    setQuestionDetailsLoading(true);
    setSelectedQuestionReviews([]);
    try {
      const [answersRes, reviewsRes] = await Promise.all([
        fetch(`/api/admin/questions/${question.id}/answers`),
        fetch(
          `/api/admin/question-reviews?questionId=${question.id}&limit=20`
        ),
      ]);
      const answersData = await answersRes.json();
      setQuestionAnswers(answersData.answers || []);
      const reviewsData = await reviewsRes.json();
      setSelectedQuestionReviews(reviewsData.logs || []);
    } catch (error) {
      console.error("Failed to load question details:", error);
    } finally {
      setQuestionDetailsLoading(false);
    }
  };

  const closeQuestionDetails = () => {
    setSelectedQuestion(null);
    setQuestionAnswers([]);
    setSelectedQuestionReviews([]);
  };

  // League edit/delete state
  const [editingLeagueId, setEditingLeagueId] = useState<string | null>(null);
  const [editingLeagueName, setEditingLeagueName] = useState("");
  const [deletingLeagueId, setDeletingLeagueId] = useState<string | null>(null);

  const [expandedImageUrl, setExpandedImageUrl] = useState<string | null>(null);
  const [removingImage, setRemovingImage] = useState(false);

  const handleRemoveImage = async (questionId: string) => {
    if (!confirm("Remove image from this question? This cannot be undone."))
      return;
    setRemovingImage(true);
    try {
      const res = await fetch(`/api/admin/questions/${questionId}/image`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json();
        alert(`Failed: ${data.error || "Unknown error"}`);
        return;
      }
      setQuestions((prev) =>
        prev.map((q) =>
          q.id === questionId
            ? { ...q, imageUrl: null, imageSource: null }
            : q
        )
      );
      if (selectedQuestion?.id === questionId) {
        setSelectedQuestion((prev) =>
          prev ? { ...prev, imageUrl: null, imageSource: null } : prev
        );
      }
    } catch {
      alert("Request failed");
    } finally {
      setRemovingImage(false);
    }
  };

  const handleRenameLeague = async (leagueId: string) => {
    if (!editingLeagueName.trim()) return;
    try {
      const res = await fetch(`/api/admin/leagues/${leagueId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editingLeagueName.trim() }),
      });
      if (!res.ok) {
        const d = await res.json();
        alert(d.error || "Failed to rename league");
        return;
      }
      setData((prev) =>
        prev
          ? {
              ...prev,
              leagues: prev.leagues.map((l) =>
                l.id === leagueId
                  ? { ...l, name: editingLeagueName.trim() }
                  : l
              ),
            }
          : prev
      );
      setEditingLeagueId(null);
    } catch {
      alert("Request failed");
    }
  };

  const handleDeleteLeague = async (leagueId: string) => {
    try {
      const res = await fetch(`/api/admin/leagues/${leagueId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const d = await res.json();
        alert(d.error || "Failed to delete league");
        return;
      }
      setData((prev) =>
        prev
          ? { ...prev, leagues: prev.leagues.filter((l) => l.id !== leagueId) }
          : prev
      );
      setDeletingLeagueId(null);
    } catch {
      alert("Request failed");
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

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen">
        <NavBar />
        <div className="flex items-center justify-center py-20">
          <div className="w-full max-w-md px-4">
            <div className="bg-[#1e3a5f] rounded-lg p-8 border border-[#2a4a6f] text-center">
              <h1 className="text-2xl font-bold text-amber-400 mb-2">
                Access Denied
              </h1>
              <p className="text-[#a0a0b8] text-sm">
                You don&apos;t have permission to view this page.
              </p>
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
  const filterChip = (() => {
    if (tabFilter.leagueName)
      return { label: `League: ${tabFilter.leagueName}` };
    if (tabFilter.gameNumber !== undefined && tabFilter.gameId)
      return {
        label: `Game ${tabFilter.gameNumber}`,
      };
    if (tabFilter.playerName)
      return { label: `Player: ${tabFilter.playerName}` };
    if (tabFilter.questionId)
      return {
        label: `Question: ${
          tabFilter.questionExcerpt
            ? tabFilter.questionExcerpt.slice(0, 60) +
              (tabFilter.questionExcerpt.length > 60 ? "…" : "")
            : tabFilter.questionId.slice(0, 8)
        }`,
      };
    return null;
  })();

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
            onFocus={() =>
              searchResults.length > 0 && setShowSearchResults(true)
            }
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
        <div className="flex gap-2 mb-4 overflow-x-auto">
          {(
            [
              "monitoring",
              "leagues",
              "players",
              "commissioners",
              "games",
              "rounds",
              "questions",
              "reviewer",
              "notifications",
              "test",
            ] as const
          ).map((t) => (
            <button
              key={t}
              onClick={() => goTo(t)}
              className={`px-4 py-2 rounded-lg text-sm font-medium capitalize whitespace-nowrap ${
                tab === t
                  ? t === "test"
                    ? "bg-[#e94560] text-white"
                    : "bg-amber-500 text-black"
                  : "bg-[#1e3a5f] text-[#a0a0b8]"
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {/* Active filter chip */}
        {filterChip && (
          <div className="mb-4 flex items-center gap-2">
            <span className="px-3 py-1 bg-amber-500/20 text-amber-400 rounded-full text-xs flex items-center gap-2">
              {filterChip.label}
              <button
                onClick={clearFilter}
                className="text-amber-400 hover:text-amber-300"
                aria-label="Clear filter"
              >
                ✕
              </button>
            </span>
          </div>
        )}

        {tab === "monitoring" && (
          <>
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

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <ChartCard title="New Players" metric="players" />
              <ChartCard title="Active Leagues" metric="leagues" />
              <ChartCard title="Games Started" metric="games_started" />
              <ChartCard title="Questions Submitted" metric="questions" />
            </div>
          </>
        )}

        {tab === "leagues" && (
          <>
            <div className="mb-3 flex flex-wrap gap-2 items-center">
              <input
                type="text"
                placeholder="Filter leagues by name, commissioner, type…"
                value={leaguesFilter}
                onChange={(e) => setLeaguesFilter(e.target.value)}
                className="px-3 py-2 bg-[#1e3a5f] border border-[#2a4a6f] rounded-lg text-white text-sm placeholder-[#666680] focus:outline-none focus:border-amber-500 flex-1 min-w-[260px]"
              />
              <span className="text-xs text-[#666680]">
                {filteredLeagues.length} of {data.leagues.length}
              </span>
            </div>
            <div className="card overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[#1e3a5f]">
                    <th className="table-header p-3 text-left">League</th>
                    <th className="table-header p-3 text-left">Commissioner</th>
                    <th className="table-header p-3 text-center">Players</th>
                    <th className="table-header p-3 text-center">Type</th>
                    <th className="table-header p-3 text-center">Notif Mode</th>
                    <th className="table-header p-3 text-center">Season / Game</th>
                    <th className="table-header p-3 text-right">Created</th>
                    <th className="table-header p-3 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLeagues.map((l) => (
                    <tr key={l.id} className="table-row">
                      <td className="p-3 text-white text-sm">
                        {editingLeagueId === l.id ? (
                          <div className="flex items-center gap-2">
                            <input
                              type="text"
                              value={editingLeagueName}
                              onChange={(e) =>
                                setEditingLeagueName(e.target.value)
                              }
                              onKeyDown={(e) => {
                                if (e.key === "Enter") handleRenameLeague(l.id);
                                if (e.key === "Escape")
                                  setEditingLeagueId(null);
                              }}
                              className="px-2 py-1 bg-[#0f0f23] border border-[#2a4a6f] rounded text-white text-sm focus:outline-none focus:border-amber-500 w-40"
                              autoFocus
                            />
                            <button
                              onClick={() => handleRenameLeague(l.id)}
                              className="text-xs text-emerald-400 hover:text-emerald-300"
                            >
                              Save
                            </button>
                            <button
                              onClick={() => setEditingLeagueId(null)}
                              className="text-xs text-[#666680] hover:text-[#a0a0b8]"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          l.name
                        )}
                      </td>
                      <td className="p-3 text-[#a0a0b8] text-sm">
                        {l.commissionerUserId ? (
                          <button
                            onClick={() =>
                              goTo("players", {
                                playerUserId: l.commissionerUserId!,
                                playerName: l.commissioner,
                              })
                            }
                            className="hover:text-amber-400 transition underline-offset-2 hover:underline text-left"
                          >
                            {l.commissioner}
                          </button>
                        ) : (
                          l.commissioner
                        )}
                      </td>
                      <td className="p-3 text-center text-sm">
                        <button
                          onClick={() =>
                            goTo("players", {
                              leagueId: l.id,
                              leagueName: l.name,
                            })
                          }
                          className="px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 transition text-xs"
                          title={`Players in ${l.name}`}
                        >
                          {l.playerCount}
                        </button>
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
                      <td className="p-3 text-center">
                        <span
                          className={`badge ${
                            l.notificationMode === "none"
                              ? "bg-red-500/20 text-red-400"
                              : l.notificationMode === "high"
                              ? "bg-amber-500/20 text-amber-400"
                              : "bg-emerald-500/20 text-emerald-400"
                          }`}
                        >
                          {l.notificationMode}
                        </span>
                      </td>
                      <td className="p-3 text-center text-sm text-[#a0a0b8]">
                        {l.currentGameId ? (
                          <button
                            onClick={() =>
                              goTo("rounds", {
                                gameId: l.currentGameId!,
                                gameNumber: l.currentGame,
                              })
                            }
                            className="hover:text-amber-400 transition underline-offset-2 hover:underline"
                          >
                            S{l.currentSeason} G{l.currentGame}
                          </button>
                        ) : (
                          <button
                            onClick={() =>
                              goTo("games", {
                                leagueId: l.id,
                                leagueName: l.name,
                              })
                            }
                            className="hover:text-amber-400 transition underline-offset-2 hover:underline"
                          >
                            S{l.currentSeason} G{l.currentGame}
                          </button>
                        )}
                      </td>
                      <td className="p-3 text-right text-sm text-[#666680]">
                        {new Date(l.createdAt).toLocaleDateString()}
                      </td>
                      <td className="p-3 text-center">
                        {deletingLeagueId === l.id ? (
                          <div className="flex items-center justify-center gap-2">
                            <span className="text-xs text-red-400">
                              Delete?
                            </span>
                            <button
                              onClick={() => handleDeleteLeague(l.id)}
                              className="px-2 py-1 bg-red-500/20 text-red-400 rounded text-xs hover:bg-red-500/30"
                            >
                              Yes
                            </button>
                            <button
                              onClick={() => setDeletingLeagueId(null)}
                              className="px-2 py-1 bg-[#1e3a5f] text-[#a0a0b8] rounded text-xs hover:bg-[#2a4a6f]"
                            >
                              No
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() => {
                                setEditingLeagueId(l.id);
                                setEditingLeagueName(l.name);
                              }}
                              className="px-2 py-1 bg-amber-500/20 text-amber-400 rounded text-xs hover:bg-amber-500/30"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => setDeletingLeagueId(l.id)}
                              className="px-2 py-1 bg-red-500/20 text-red-400 rounded text-xs hover:bg-red-500/30"
                            >
                              Delete
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {tab === "players" && (
          <>
            <div className="mb-3 flex flex-wrap gap-2 items-center">
              <input
                type="text"
                placeholder="Search players by name, email, phone…"
                value={playersQuery}
                onChange={(e) => setPlayersQuery(e.target.value)}
                className="px-3 py-2 bg-[#1e3a5f] border border-[#2a4a6f] rounded-lg text-white text-sm placeholder-[#666680] focus:outline-none focus:border-amber-500 flex-1 min-w-[260px]"
              />
              <span className="text-xs text-[#666680]">
                {playersTotal} player{playersTotal === 1 ? "" : "s"}
                {globalOverride === "none" && (
                  <span className="ml-2 text-red-400">
                    Global override: NONE (all SMS suppressed)
                  </span>
                )}
              </span>
            </div>

            {playersLoading ? (
              <div className="card p-8 text-center">
                <div className="animate-pulse text-[#a0a0b8]">Loading…</div>
              </div>
            ) : players.length === 0 ? (
              <div className="card p-8 text-center text-[#666680]">
                No players found
              </div>
            ) : (
              <>
                <div className="card overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-[#1e3a5f]">
                        <th className="table-header p-3 text-left">Player</th>
                        <th className="table-header p-3 text-left">Email</th>
                        <th className="table-header p-3 text-left">Phone</th>
                        <th
                          className="table-header p-3 text-center"
                          title="User-level notification preference (overrides league)"
                        >
                          Notif Pref
                        </th>
                        <th className="table-header p-3 text-center">
                          Leagues
                        </th>
                        <th className="table-header p-3 text-center">
                          Q Success %
                        </th>
                        <th className="table-header p-3 text-right">
                          Last Login
                        </th>
                        <th className="table-header p-3 text-center"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {players.map((p) => {
                        const expanded = expandedPlayerId === p.id;
                        const anyMembershipInactive = p.memberships.some(
                          (m) => !m.isActive
                        );
                        const lastSms = p.recentNotifications.find(
                          (n) => n.smsStatus
                        );
                        return (
                          <Fragment key={p.id}>
                            <tr
                              className="table-row cursor-pointer"
                              onClick={() =>
                                setExpandedPlayerId(expanded ? null : p.id)
                              }
                            >
                              <td className="p-3 text-white text-sm">
                                <div className="flex items-center gap-2">
                                  <span>{p.nickname || "—"}</span>
                                  {!p.profileComplete && (
                                    <span
                                      title="Profile incomplete"
                                      className="text-xs text-amber-400"
                                    >
                                      ⚠
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="p-3 text-[#a0a0b8] text-sm">
                                {p.email}
                              </td>
                              <td className="p-3 text-sm">
                                {p.hasPhone ? (
                                  <span className="text-[#a0a0b8]">
                                    {formatPhone(p.phoneNumber)}
                                  </span>
                                ) : (
                                  <span className="text-red-400 text-xs">
                                    no phone
                                  </span>
                                )}
                                {lastSms && (
                                  <span
                                    className={`ml-2 text-xs ${
                                      lastSms.smsStatus === "sent"
                                        ? "text-emerald-400"
                                        : "text-red-400"
                                    }`}
                                    title={`Last SMS: ${lastSms.smsStatus}`}
                                  >
                                    {lastSms.smsStatus === "sent"
                                      ? "✓"
                                      : "✗"}
                                  </span>
                                )}
                              </td>
                              <td className="p-3 text-center text-xs">
                                {p.notificationPreference ? (
                                  <span
                                    className={`badge ${
                                      p.notificationPreference === "none"
                                        ? "bg-red-500/20 text-red-400"
                                        : p.notificationPreference === "high"
                                        ? "bg-amber-500/20 text-amber-400"
                                        : "bg-emerald-500/20 text-emerald-400"
                                    }`}
                                  >
                                    {p.notificationPreference}
                                  </span>
                                ) : (
                                  <span className="text-[#666680]">—</span>
                                )}
                              </td>
                              <td className="p-3 text-center text-sm">
                                <span
                                  className={
                                    anyMembershipInactive
                                      ? "text-amber-400"
                                      : "text-[#a0a0b8]"
                                  }
                                  title={
                                    anyMembershipInactive
                                      ? "Has inactive league memberships"
                                      : ""
                                  }
                                >
                                  {p.leagueCount}
                                  {anyMembershipInactive && " ⚠"}
                                </span>
                              </td>
                              <td className="p-3 text-center text-sm">
                                {p.questionSuccessRate != null ? (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      goTo("questions", {
                                        playerUserId: p.id,
                                        playerName:
                                          p.nickname || p.email || "Player",
                                      });
                                    }}
                                    className="text-[#a0a0b8] hover:text-amber-400 transition underline-offset-2 hover:underline"
                                    title={`${p.questionAnswerCount} answers to their questions — view all`}
                                  >
                                    {p.questionSuccessRate}%
                                  </button>
                                ) : (
                                  <span className="text-[#666680]">—</span>
                                )}
                              </td>
                              <td className="p-3 text-right text-sm text-[#666680]">
                                {p.lastLogin
                                  ? new Date(p.lastLogin).toLocaleDateString()
                                  : "Never"}
                              </td>
                              <td className="p-3 text-center text-xs text-[#666680]">
                                {expanded ? "▾" : "▸"}
                              </td>
                            </tr>
                            {expanded && (
                              <tr className="bg-[#0f1d31]">
                                <td colSpan={8} className="p-4">
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {/* Memberships */}
                                    <div>
                                      <h4 className="text-xs uppercase tracking-wider text-[#a0a0b8] mb-2">
                                        League Memberships
                                      </h4>
                                      {p.memberships.length === 0 ? (
                                        <div className="text-xs text-[#666680]">
                                          Not in any league
                                        </div>
                                      ) : (
                                        <div className="space-y-1">
                                          {p.memberships.map((m) => (
                                            <div
                                              key={m.leaguePlayerId}
                                              className="flex items-center justify-between gap-2 px-3 py-2 bg-[#1e3a5f] rounded text-xs"
                                            >
                                              <button
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  goTo("leagues");
                                                  setLeaguesFilter(
                                                    m.leagueName
                                                  );
                                                }}
                                                className="text-white hover:text-amber-400 transition text-left flex-1 truncate"
                                              >
                                                {m.leagueName}
                                                {m.role === "commissioner" && (
                                                  <span className="ml-1 text-amber-400">
                                                    (C)
                                                  </span>
                                                )}
                                              </button>
                                              <div className="flex items-center gap-1">
                                                {!m.isActive && (
                                                  <span className="px-1.5 py-0.5 bg-red-500/20 text-red-400 rounded text-[10px]">
                                                    inactive
                                                  </span>
                                                )}
                                                {m.isPaused && (
                                                  <span className="px-1.5 py-0.5 bg-amber-500/20 text-amber-400 rounded text-[10px]">
                                                    paused
                                                  </span>
                                                )}
                                                {m.isFake && (
                                                  <span className="px-1.5 py-0.5 bg-purple-500/20 text-purple-400 rounded text-[10px]">
                                                    fake
                                                  </span>
                                                )}
                                                <span
                                                  className={`px-1.5 py-0.5 rounded text-[10px] ${
                                                    m.effectiveLevel === "none"
                                                      ? "bg-red-500/20 text-red-400"
                                                      : m.effectiveLevel ===
                                                        "high"
                                                      ? "bg-amber-500/20 text-amber-400"
                                                      : "bg-emerald-500/20 text-emerald-400"
                                                  }`}
                                                  title={`Effective notification level (league mode: ${m.leagueNotificationMode})`}
                                                >
                                                  {m.effectiveLevel}
                                                </span>
                                              </div>
                                            </div>
                                          ))}
                                        </div>
                                      )}
                                    </div>

                                    {/* Recent notifications */}
                                    <div>
                                      <h4 className="text-xs uppercase tracking-wider text-[#a0a0b8] mb-2">
                                        Recent Notifications (last 5)
                                      </h4>
                                      {p.recentNotifications.length === 0 ? (
                                        <div className="text-xs text-[#666680]">
                                          No notifications recorded
                                        </div>
                                      ) : (
                                        <div className="space-y-1">
                                          {p.recentNotifications.map((n) => (
                                            <div
                                              key={n.id}
                                              className="flex items-center justify-between gap-2 px-3 py-2 bg-[#1e3a5f] rounded text-xs"
                                            >
                                              <span className="text-[#a0a0b8] capitalize">
                                                {n.type.replace(/_/g, " ")}
                                              </span>
                                              <div className="flex items-center gap-2">
                                                <span
                                                  className={`text-[10px] ${
                                                    n.smsStatus === "sent"
                                                      ? "text-emerald-400"
                                                      : n.smsStatus === "failed"
                                                      ? "text-red-400"
                                                      : "text-[#666680]"
                                                  }`}
                                                >
                                                  SMS {n.smsStatus ?? "—"}
                                                </span>
                                                <span className="text-[#666680] text-[10px]">
                                                  {new Date(
                                                    n.createdAt
                                                  ).toLocaleDateString()}
                                                </span>
                                              </div>
                                            </div>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                  </div>

                                  {/* Diagnostic banner */}
                                  {(!p.hasPhone ||
                                    anyMembershipInactive ||
                                    p.notificationPreference === "none") && (
                                    <div className="mt-3 p-3 bg-amber-500/10 border border-amber-500/30 rounded text-xs text-amber-300">
                                      <strong>Diagnosis:</strong>{" "}
                                      {!p.hasPhone &&
                                        "No phone number on file — SMS will never send. "}
                                      {p.notificationPreference === "none" &&
                                        "User has notifications disabled at profile level. "}
                                      {anyMembershipInactive &&
                                        "Has at least one inactive LeaguePlayer record — recipient filters will skip them in those leagues."}
                                    </div>
                                  )}
                                </td>
                              </tr>
                            )}
                          </Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {playersTotalPages > 1 && (
                  <div className="mt-4 flex justify-center items-center gap-2">
                    <button
                      onClick={() =>
                        setPlayersPage((p) => Math.max(1, p - 1))
                      }
                      disabled={playersPage === 1}
                      className="px-3 py-1 bg-[#1e3a5f] text-white rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[#2a4a6f] transition"
                    >
                      Previous
                    </button>
                    <span className="text-sm text-[#a0a0b8]">
                      Page {playersPage} of {playersTotalPages}
                    </span>
                    <button
                      onClick={() =>
                        setPlayersPage((p) =>
                          Math.min(playersTotalPages, p + 1)
                        )
                      }
                      disabled={playersPage === playersTotalPages}
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

        {tab === "commissioners" && (
          <>
            <div className="mb-3 flex flex-wrap gap-2 items-center">
              <input
                type="text"
                placeholder="Filter commissioners…"
                value={commissionersFilter}
                onChange={(e) => setCommissionersFilter(e.target.value)}
                className="px-3 py-2 bg-[#1e3a5f] border border-[#2a4a6f] rounded-lg text-white text-sm placeholder-[#666680] focus:outline-none focus:border-amber-500 flex-1 min-w-[260px]"
              />
              <span className="text-xs text-[#666680]">
                {filteredCommissioners.length} of {data.commissioners.length}
              </span>
            </div>
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
                  {filteredCommissioners.map((c) => (
                    <tr key={c.id} className="table-row">
                      <td className="p-3 text-white text-sm">
                        <button
                          onClick={() =>
                            goTo("players", {
                              playerUserId: c.id,
                              playerName: c.nickname || c.email || "Player",
                            })
                          }
                          className="hover:text-amber-400 transition underline-offset-2 hover:underline text-left"
                        >
                          {c.nickname || "—"}
                        </button>
                      </td>
                      <td className="p-3 text-[#a0a0b8] text-sm">{c.email}</td>
                      <td className="p-3 text-center text-sm text-[#a0a0b8]">
                        <div className="flex flex-wrap justify-center gap-1">
                          {c.leagues.map((l) => (
                            <button
                              key={l.id}
                              onClick={() => {
                                goTo("leagues");
                                setLeaguesFilter(l.name);
                              }}
                              className="px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 text-xs"
                            >
                              {l.name}
                            </button>
                          ))}
                        </div>
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
          </>
        )}

        {tab === "games" && (
          <>
            <div className="mb-3 flex flex-wrap gap-2 items-center">
              <input
                type="text"
                placeholder="Filter games by league, status…"
                value={gamesFilter}
                onChange={(e) => setGamesFilter(e.target.value)}
                className="px-3 py-2 bg-[#1e3a5f] border border-[#2a4a6f] rounded-lg text-white text-sm placeholder-[#666680] focus:outline-none focus:border-amber-500 flex-1 min-w-[260px]"
              />
            </div>
            {gamesLoading ? (
              <div className="card p-8 text-center">
                <div className="animate-pulse text-[#a0a0b8]">Loading…</div>
              </div>
            ) : (
              <>
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
                        <th className="table-header p-3 text-right">
                          Completed
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredGames.map((g) => (
                        <tr key={g.id} className="table-row">
                          <td className="p-3 text-white text-sm">
                            <button
                              onClick={() =>
                                goTo("rounds", {
                                  gameId: g.id,
                                  gameNumber: g.number,
                                })
                              }
                              className="hover:text-amber-400 transition underline-offset-2 hover:underline"
                            >
                              Game {g.number}
                            </button>
                          </td>
                          <td className="p-3 text-[#a0a0b8] text-sm">
                            <button
                              onClick={() => {
                                goTo("leagues");
                                setLeaguesFilter(g.league.name);
                              }}
                              className="hover:text-amber-400 transition underline-offset-2 hover:underline"
                            >
                              {g.league.name}
                            </button>
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
                          <td className="p-3 text-center text-sm">
                            <button
                              onClick={() =>
                                goTo("rounds", {
                                  gameId: g.id,
                                  gameNumber: g.number,
                                })
                              }
                              className="px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 text-xs"
                            >
                              {g.completedRounds} / {g.totalRounds}
                            </button>
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
                {gamesTotalPages > 1 && (
                  <div className="mt-4 flex justify-center items-center gap-2">
                    <button
                      onClick={() => setGamesPage((p) => Math.max(1, p - 1))}
                      disabled={gamesPage === 1}
                      className="px-3 py-1 bg-[#1e3a5f] text-white rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[#2a4a6f] transition"
                    >
                      Previous
                    </button>
                    <span className="text-sm text-[#a0a0b8]">
                      Page {gamesPage} of {gamesTotalPages}
                    </span>
                    <button
                      onClick={() =>
                        setGamesPage((p) => Math.min(gamesTotalPages, p + 1))
                      }
                      disabled={gamesPage === gamesTotalPages}
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

        {tab === "rounds" && (
          <>
            <div className="mb-3 flex flex-wrap gap-2 items-center">
              <input
                type="text"
                placeholder="Filter rounds by league, status, player, category…"
                value={roundsFilter}
                onChange={(e) => setRoundsFilter(e.target.value)}
                className="px-3 py-2 bg-[#1e3a5f] border border-[#2a4a6f] rounded-lg text-white text-sm placeholder-[#666680] focus:outline-none focus:border-amber-500 flex-1 min-w-[260px]"
              />
            </div>
            {roundsLoading ? (
              <div className="card p-8 text-center">
                <div className="animate-pulse text-[#a0a0b8]">Loading…</div>
              </div>
            ) : (
              <>
                <div className="card overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-[#1e3a5f]">
                        <th className="table-header p-3 text-left">Round</th>
                        <th className="table-header p-3 text-left">
                          Game / League
                        </th>
                        <th className="table-header p-3 text-left">At Bat</th>
                        <th className="table-header p-3 text-center">Status</th>
                        <th className="table-header p-3 text-left">Category</th>
                        <th className="table-header p-3 text-right">
                          Deadline
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredRounds.map((r) => (
                        <tr key={r.id} className="table-row">
                          <td className="p-3 text-white text-sm">
                            <a
                              href={`/games/${r.game.id}?round=${r.id}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="hover:text-amber-400 transition underline-offset-2 hover:underline"
                              title="Open round in new tab"
                            >
                              R{r.number}
                            </a>
                          </td>
                          <td className="p-3 text-[#a0a0b8] text-sm">
                            <button
                              onClick={() => {
                                goTo("leagues");
                                setLeaguesFilter(r.game.league.name);
                              }}
                              className="hover:text-amber-400 transition underline-offset-2 hover:underline"
                            >
                              {r.game.league.name}
                            </button>{" "}
                            <button
                              onClick={() =>
                                goTo("rounds", {
                                  gameId: r.game.id,
                                  gameNumber: r.game.number,
                                })
                              }
                              className="hover:text-amber-400 transition underline-offset-2 hover:underline"
                            >
                              (G{r.game.number})
                            </button>
                          </td>
                          <td className="p-3 text-[#a0a0b8] text-sm">
                            {r.atBatPlayer ? (
                              <button
                                onClick={() =>
                                  goTo("players", {
                                    playerUserId: r.atBatPlayer!.userId,
                                    playerName: r.atBatPlayer!.nickname,
                                  })
                                }
                                className="hover:text-amber-400 transition underline-offset-2 hover:underline"
                              >
                                {r.atBatPlayer.nickname}
                              </button>
                            ) : (
                              "—"
                            )}
                          </td>
                          <td className="p-3 text-center">
                            <span
                              className={`badge ${
                                r.status === "graded"
                                  ? "bg-green-500/20 text-green-400"
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
                {roundsTotalPages > 1 && (
                  <div className="mt-4 flex justify-center items-center gap-2">
                    <button
                      onClick={() => setRoundsPage((p) => Math.max(1, p - 1))}
                      disabled={roundsPage === 1}
                      className="px-3 py-1 bg-[#1e3a5f] text-white rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[#2a4a6f] transition"
                    >
                      Previous
                    </button>
                    <span className="text-sm text-[#a0a0b8]">
                      Page {roundsPage} of {roundsTotalPages}
                    </span>
                    <button
                      onClick={() =>
                        setRoundsPage((p) =>
                          Math.min(roundsTotalPages, p + 1)
                        )
                      }
                      disabled={roundsPage === roundsTotalPages}
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

        {tab === "questions" && (
          <>
            {/* Filter controls */}
            <div className="mb-4 flex flex-wrap gap-3">
              <input
                type="text"
                placeholder="Filter loaded questions (text, creator, league)…"
                value={questionsTextFilter}
                onChange={(e) => setQuestionsTextFilter(e.target.value)}
                className="px-3 py-2 bg-[#1e3a5f] border border-[#2a4a6f] rounded-lg text-white text-sm placeholder-[#666680] focus:outline-none focus:border-amber-500 flex-1 min-w-[240px]"
              />

              <select
                value={filterLeague}
                onChange={(e) => {
                  setFilterLeague(e.target.value);
                  setQuestionsPage(1);
                }}
                className="px-3 py-2 bg-[#1e3a5f] border border-[#2a4a6f] rounded-lg text-white text-sm focus:outline-none focus:border-amber-500"
              >
                <option value="">All Leagues</option>
                {data.leagues.map((l) => (
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

              <div className="flex gap-1">
                {(["all", "with", "without"] as const).map((opt) => (
                  <button
                    key={opt}
                    onClick={() => setFilterImage(opt)}
                    className={`px-3 py-2 rounded-lg text-sm font-medium transition ${
                      filterImage === opt
                        ? "bg-amber-500 text-black"
                        : "bg-[#1e3a5f] text-[#a0a0b8] hover:bg-[#2a4a6f]"
                    }`}
                  >
                    {opt === "all"
                      ? "All"
                      : opt === "with"
                      ? "With Image"
                      : "Without Image"}
                  </button>
                ))}
              </div>

              {(filterLeague ||
                filterCategory ||
                filterDateFrom ||
                filterDateTo ||
                questionsTextFilter ||
                tabFilter.playerUserId) && (
                <button
                  onClick={() => {
                    setFilterLeague("");
                    setFilterCategory("");
                    setFilterDateFrom("");
                    setFilterDateTo("");
                    setQuestionsTextFilter("");
                    setQuestionsPage(1);
                    if (tabFilter.playerUserId) clearFilter();
                  }}
                  className="px-3 py-2 bg-red-500/20 text-red-400 rounded-lg text-sm hover:bg-red-500/30 transition"
                >
                  Clear Filters
                </button>
              )}
            </div>

            {!questionsLoading && questions.length > 0 && (
              <div className="mb-4 p-4 bg-[#1e3a5f] rounded-lg border border-[#2a4a6f]">
                <div className="flex flex-wrap gap-6 text-sm">
                  <div>
                    <span className="text-[#a0a0b8]">
                      Questions with images:{" "}
                    </span>
                    <span className="text-white font-medium">
                      {imageStats.withImage} / {imageStats.total}
                      {imageStats.total > 0 && (
                        <span className="text-[#666680] ml-1">
                          (
                          {Math.round(
                            (imageStats.withImage / imageStats.total) * 100
                          )}
                          %)
                        </span>
                      )}
                    </span>
                  </div>
                  {Object.entries(imageStats.sources).length > 0 && (
                    <div className="flex gap-4">
                      {Object.entries(imageStats.sources).map(
                        ([src, count]) => (
                          <span key={src}>
                            <span className="text-[#a0a0b8] capitalize">
                              {src}:{" "}
                            </span>
                            <span className="text-white font-medium">
                              {count}
                            </span>
                          </span>
                        )
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {questionsLoading ? (
              <div className="card p-8 text-center">
                <div className="animate-pulse text-[#a0a0b8]">
                  Loading questions...
                </div>
              </div>
            ) : filteredQuestions.length === 0 ? (
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
                        <th className="table-header p-3 text-center">Image</th>
                        <th className="table-header p-3 text-center">Review</th>
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
                      {filteredQuestions.map((q) => (
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
                            {q.league ? (
                              <button
                                onClick={() => {
                                  goTo("leagues");
                                  setLeaguesFilter(q.league!.name);
                                }}
                                className="hover:text-amber-400 transition underline-offset-2 hover:underline"
                              >
                                {q.league.name}
                              </button>
                            ) : (
                              "—"
                            )}
                          </td>
                          <td className="p-3 text-center">
                            {q.imageUrl ? (
                              <button
                                onClick={() => setExpandedImageUrl(q.imageUrl!)}
                                className="inline-block"
                              >
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                  src={q.imageUrl}
                                  alt="Question image"
                                  width={32}
                                  height={32}
                                  className="w-8 h-8 rounded object-cover hover:opacity-80 transition"
                                />
                              </button>
                            ) : (
                              <span className="text-[#666680] text-sm">—</span>
                            )}
                          </td>
                          <td className="p-3 text-center">
                            {(() => {
                              const log = reviewIndex.get(q.id);
                              if (!log)
                                return (
                                  <span
                                    className="text-[#666680] text-sm"
                                    title="No reviewer log"
                                  >
                                    —
                                  </span>
                                );
                              const badge =
                                log.status === "review_error"
                                  ? {
                                      cls: "bg-red-500/20 text-red-400",
                                      label: "⚠",
                                      title: `Reviewer error: ${log.notes ?? ""}`,
                                    }
                                  : log.status === "review_unavailable"
                                  ? {
                                      cls: "bg-[#666680]/20 text-[#a0a0b8]",
                                      label: "·",
                                      title: "Reviewer unavailable when this question shipped",
                                    }
                                  : log.changed
                                  ? {
                                      cls: "bg-yellow-500/20 text-yellow-400",
                                      label: "✎",
                                      title: `Reviewer rewrote: ${log.notes ?? ""}`,
                                    }
                                  : {
                                      cls: "bg-green-500/20 text-green-400",
                                      label: "✓",
                                      title: "Reviewer passed clean",
                                    };
                              return (
                                <button
                                  onClick={() =>
                                    goTo("reviewer", {
                                      questionId: q.id,
                                      questionExcerpt: q.questionText,
                                    })
                                  }
                                  className={`px-2 py-1 rounded text-xs font-bold ${badge.cls} hover:opacity-80 transition`}
                                  title={badge.title}
                                >
                                  {badge.label}
                                </button>
                              );
                            })()}
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

        {tab === "reviewer" && (
          <>
            {reviewSummary && (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 mb-6">
                {[
                  {
                    label: "Total Reviewed",
                    value: reviewSummary.totalReviewed,
                  },
                  {
                    label: "Changes Applied",
                    value: reviewSummary.changed,
                    sub:
                      reviewSummary.totalReviewed > 0
                        ? `${Math.round(
                            (reviewSummary.changed /
                              reviewSummary.totalReviewed) *
                              100
                          )}%`
                        : null,
                    accent: "text-yellow-400",
                  },
                  {
                    label: "Errors",
                    value: reviewSummary.errors,
                    accent:
                      reviewSummary.errors > 0 ? "text-red-400" : undefined,
                  },
                  {
                    label: "Unavailable",
                    value: reviewSummary.unavailable,
                  },
                  {
                    label: "Avg Latency",
                    value: `${reviewSummary.avgLatencyMs}ms`,
                  },
                ].map((c) => (
                  <div
                    key={c.label}
                    className="bg-[#1e3a5f] border border-[#2a4a6f] rounded-lg p-3"
                  >
                    <div className="text-xs text-[#a0a0b8] mb-1">{c.label}</div>
                    <div
                      className={`text-xl font-bold ${
                        c.accent ?? "text-white"
                      }`}
                    >
                      {c.value}
                    </div>
                    {c.sub && (
                      <div className="text-xs text-[#666680] mt-0.5">
                        {c.sub}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            <div className="mb-4 flex flex-wrap gap-3 items-center">
              <input
                type="text"
                placeholder="Filter by question text, notes, category…"
                value={reviewQuery}
                onChange={(e) => setReviewQuery(e.target.value)}
                className="px-3 py-2 bg-[#1e3a5f] border border-[#2a4a6f] rounded-lg text-white text-sm placeholder-[#666680] focus:outline-none focus:border-amber-500 flex-1 min-w-[240px]"
              />
              <select
                value={reviewStatusFilter}
                onChange={(e) =>
                  setReviewStatusFilter(e.target.value as typeof reviewStatusFilter)
                }
                className="px-3 py-2 bg-[#1e3a5f] border border-[#2a4a6f] rounded-lg text-white text-sm focus:outline-none focus:border-amber-500"
              >
                <option value="">All statuses</option>
                <option value="ok">OK</option>
                <option value="review_error">Errors</option>
                <option value="review_unavailable">Unavailable</option>
              </select>
              <label className="flex items-center gap-2 px-3 py-2 bg-[#1e3a5f] border border-[#2a4a6f] rounded-lg text-sm text-white cursor-pointer">
                <input
                  type="checkbox"
                  checked={reviewChangedOnly}
                  onChange={(e) => setReviewChangedOnly(e.target.checked)}
                />
                Changed only
              </label>
              {(reviewQuery ||
                reviewStatusFilter ||
                reviewChangedOnly ||
                tabFilter.questionId) && (
                <button
                  onClick={() => {
                    setReviewQuery("");
                    setReviewStatusFilter("");
                    setReviewChangedOnly(false);
                    if (tabFilter.questionId) clearFilter();
                  }}
                  className="px-3 py-2 bg-red-500/20 text-red-400 rounded-lg text-sm hover:bg-red-500/30 transition"
                >
                  Clear Filters
                </button>
              )}
            </div>

            {reviewLogsLoading ? (
              <div className="text-center py-12">
                <div className="animate-pulse text-[#a0a0b8]">Loading…</div>
              </div>
            ) : reviewLogs.length === 0 ? (
              <div className="text-center py-12 text-[#666680]">
                No reviewer logs found.
              </div>
            ) : (
              <>
                <div className="card overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-[#1e3a5f]">
                        <th className="table-header p-3 text-left">When</th>
                        <th className="table-header p-3 text-left">Question</th>
                        <th className="table-header p-3 text-left">League</th>
                        <th className="table-header p-3 text-center">Status</th>
                        <th className="table-header p-3 text-center">Changed</th>
                        <th className="table-header p-3 text-left">Notes</th>
                        <th className="table-header p-3 text-right">Latency</th>
                        <th className="table-header p-3 text-center">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reviewLogs.map((log) => (
                        <tr key={log.id} className="table-row">
                          <td className="p-3 text-xs text-[#a0a0b8] whitespace-nowrap">
                            {new Date(log.createdAt).toLocaleString()}
                          </td>
                          <td className="p-3 text-white text-sm max-w-md truncate">
                            <span className="px-2 py-0.5 rounded text-xs font-medium bg-purple-500/20 text-purple-400 mr-2">
                              {log.category}
                            </span>
                            {log.questionText}
                          </td>
                          <td className="p-3 text-sm text-[#a0a0b8] whitespace-nowrap">
                            {log.league ? (
                              <button
                                onClick={() => {
                                  goTo("leagues");
                                  setLeaguesFilter(log.league!.name);
                                }}
                                className="hover:text-amber-400 transition underline-offset-2 hover:underline"
                              >
                                {log.league.name}
                              </button>
                            ) : (
                              "—"
                            )}
                            {log.seasonNumber !== null &&
                              log.gameNumber !== null && (
                                <span className="text-[#666680] text-xs ml-2">
                                  S{log.seasonNumber}G{log.gameNumber}
                                  {log.roundNumber !== null
                                    ? `R${log.roundNumber}`
                                    : ""}
                                </span>
                              )}
                          </td>
                          <td className="p-3 text-center">
                            <span
                              className={`px-2 py-1 rounded text-xs font-medium ${
                                log.status === "ok"
                                  ? "bg-green-500/20 text-green-400"
                                  : log.status === "review_error"
                                  ? "bg-red-500/20 text-red-400"
                                  : "bg-[#666680]/20 text-[#a0a0b8]"
                              }`}
                            >
                              {log.status === "ok"
                                ? "OK"
                                : log.status === "review_error"
                                ? "Error"
                                : "Unavail."}
                            </span>
                          </td>
                          <td className="p-3 text-center">
                            {log.modelUsed === "commissioner-regrade" ? (
                              <span
                                className="px-2 py-1 rounded text-xs font-medium bg-blue-500/20 text-blue-400"
                                title="Commissioner regrade"
                              >
                                🛠 Commish
                              </span>
                            ) : log.changed ? (
                              <span className="px-2 py-1 rounded text-xs font-medium bg-yellow-500/20 text-yellow-400">
                                ✎ Changed
                              </span>
                            ) : (
                              <span className="text-[#666680] text-xs">—</span>
                            )}
                          </td>
                          <td className="p-3 text-sm text-[#a0a0b8] max-w-xs truncate">
                            {log.notes || "—"}
                          </td>
                          <td className="p-3 text-right text-xs text-[#a0a0b8] whitespace-nowrap">
                            {log.latencyMs}ms
                          </td>
                          <td className="p-3 text-center">
                            <button
                              onClick={() => setSelectedReview(log)}
                              className="px-3 py-1 bg-amber-500/20 text-amber-400 rounded text-xs hover:bg-amber-500/30 transition"
                            >
                              View Diff
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {reviewLogsTotalPages > 1 && (
                  <div className="mt-4 flex justify-center items-center gap-2">
                    <button
                      onClick={() =>
                        setReviewLogsPage((p) => Math.max(1, p - 1))
                      }
                      disabled={reviewLogsPage === 1}
                      className="px-3 py-1 bg-[#1e3a5f] text-white rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[#2a4a6f] transition"
                    >
                      Previous
                    </button>
                    <span className="text-sm text-[#a0a0b8]">
                      Page {reviewLogsPage} of {reviewLogsTotalPages}
                    </span>
                    <button
                      onClick={() =>
                        setReviewLogsPage((p) =>
                          Math.min(reviewLogsTotalPages, p + 1)
                        )
                      }
                      disabled={reviewLogsPage === reviewLogsTotalPages}
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

        {/* Reviewer Diff Modal */}
        {selectedReview && (
          <div
            className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
            onClick={() => setSelectedReview(null)}
          >
            <div
              className="bg-[#1e3a5f] rounded-lg p-6 max-w-5xl w-full max-h-[90vh] overflow-y-auto border border-[#2a4a6f]"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h2 className="text-xl font-bold text-amber-400">
                    Reviewer Log
                  </h2>
                  <p className="text-xs text-[#a0a0b8] mt-1">
                    {new Date(selectedReview.createdAt).toLocaleString()} ·{" "}
                    {selectedReview.modelUsed} · {selectedReview.latencyMs}ms
                  </p>
                </div>
                <button
                  onClick={() => setSelectedReview(null)}
                  className="text-[#a0a0b8] hover:text-white transition"
                >
                  ✕
                </button>
              </div>

              <div className="mb-4">
                <p className="text-white mb-2">{selectedReview.questionText}</p>
                <p className="text-sm text-[#a0a0b8]">
                  <strong>Category:</strong> {selectedReview.category} ·{" "}
                  <strong>Format:</strong> {selectedReview.format}
                </p>
                {selectedReview.notes && (
                  <p className="text-sm text-[#a0a0b8] mt-2">
                    <strong>Notes:</strong> {selectedReview.notes}
                  </p>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h3 className="text-sm font-semibold text-[#a0a0b8] mb-2">
                    Before (submitter / AI draft)
                  </h3>
                  <pre className="bg-[#0f1e30] border border-[#2a4a6f] rounded p-3 text-xs text-white overflow-x-auto whitespace-pre-wrap break-words">
                    {(() => {
                      try {
                        return JSON.stringify(
                          JSON.parse(selectedReview.beforeJson),
                          null,
                          2
                        );
                      } catch {
                        return selectedReview.beforeJson;
                      }
                    })()}
                  </pre>
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-[#a0a0b8] mb-2">
                    After (what shipped)
                    {selectedReview.changed && (
                      <span className="ml-2 px-2 py-0.5 rounded text-xs font-medium bg-yellow-500/20 text-yellow-400">
                        Modified
                      </span>
                    )}
                  </h3>
                  <pre className="bg-[#0f1e30] border border-[#2a4a6f] rounded p-3 text-xs text-white overflow-x-auto whitespace-pre-wrap break-words">
                    {(() => {
                      try {
                        return JSON.stringify(
                          JSON.parse(selectedReview.afterJson),
                          null,
                          2
                        );
                      } catch {
                        return selectedReview.afterJson;
                      }
                    })()}
                  </pre>
                </div>
              </div>

              {selectedReview.gameId && selectedReview.roundId && (
                <div className="mt-4 text-sm">
                  <a
                    href={`/games/${selectedReview.gameId}?round=${selectedReview.roundId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-amber-400 hover:underline"
                  >
                    Open round in game view ↗
                  </a>
                </div>
              )}
            </div>
          </div>
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
                {selectedQuestion.imageUrl && (
                  <div className="mt-4 flex items-start gap-4">
                    <button
                      onClick={() =>
                        setExpandedImageUrl(selectedQuestion.imageUrl!)
                      }
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={selectedQuestion.imageUrl}
                        alt="Question image"
                        className="w-24 h-24 rounded object-cover hover:opacity-80 transition"
                      />
                    </button>
                    <div className="flex flex-col gap-2">
                      {selectedQuestion.imageSource && (
                        <p className="text-sm text-[#a0a0b8]">
                          <strong>Image source:</strong>{" "}
                          <span className="capitalize">
                            {selectedQuestion.imageSource}
                          </span>
                        </p>
                      )}
                      <button
                        onClick={() => handleRemoveImage(selectedQuestion.id)}
                        disabled={removingImage}
                        className="px-3 py-1.5 bg-red-500/20 text-red-400 rounded text-xs hover:bg-red-500/30 transition disabled:opacity-50 disabled:cursor-not-allowed w-fit"
                      >
                        {removingImage ? "Removing..." : "Remove Image"}
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {selectedQuestionReviews.length > 0 && (
                <div className="mb-6">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-lg font-semibold text-amber-400">
                      Reviewer Log ({selectedQuestionReviews.length})
                    </h3>
                    <button
                      onClick={() => {
                        closeQuestionDetails();
                        goTo("reviewer", {
                          questionId: selectedQuestion.id,
                          questionExcerpt: selectedQuestion.questionText,
                        });
                      }}
                      className="text-xs text-amber-400 hover:underline"
                    >
                      Open in Reviewer tab →
                    </button>
                  </div>
                  <div className="space-y-2">
                    {selectedQuestionReviews.map((log) => (
                      <button
                        key={log.id}
                        onClick={() => setSelectedReview(log)}
                        className="w-full text-left bg-[#0f1e30] border border-[#2a4a6f] rounded p-3 hover:border-amber-500/50 transition"
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <span
                            className={`px-2 py-0.5 rounded text-xs font-medium ${
                              log.status === "ok"
                                ? "bg-green-500/20 text-green-400"
                                : log.status === "review_error"
                                ? "bg-red-500/20 text-red-400"
                                : "bg-[#666680]/20 text-[#a0a0b8]"
                            }`}
                          >
                            {log.status === "ok"
                              ? "OK"
                              : log.status === "review_error"
                              ? "Error"
                              : "Unavail."}
                          </span>
                          {log.changed && (
                            <span className="px-2 py-0.5 rounded text-xs font-medium bg-yellow-500/20 text-yellow-400">
                              ✎ Changed
                            </span>
                          )}
                          <span className="text-xs text-[#a0a0b8]">
                            {new Date(log.createdAt).toLocaleString()} ·{" "}
                            {log.latencyMs}ms
                          </span>
                        </div>
                        {log.notes && (
                          <p className="text-sm text-[#a0a0b8]">{log.notes}</p>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}

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
                        <th className="p-2 text-left text-sm text-[#a0a0b8]">
                          Power-Up
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {questionAnswers.map((a: any) => (
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
                          <td className="p-2 text-sm">
                            {a.powerUpType ? (
                              <span className="text-amber-400">
                                {a.powerUpType === "hint"
                                  ? "Hint"
                                  : a.powerUpType === "elimination"
                                  ? "Elim"
                                  : "Hi/Lo"}{" "}
                                ({a.powerUpCost}pt)
                              </span>
                            ) : (
                              <span className="text-[#666680] text-xs">
                                {a.powerUpEligibility || "—"}
                              </span>
                            )}
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

        {expandedImageUrl && (
          <div
            className="fixed inset-0 bg-black/90 flex items-center justify-center z-[60] p-4"
            onClick={() => setExpandedImageUrl(null)}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={expandedImageUrl}
              alt="Expanded question image"
              className="max-w-full max-h-[90vh] rounded-lg object-contain"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        )}

        {/* Test Tab */}
        {tab === "test" && (
          <div className="space-y-6 max-w-2xl">
            <div className="bg-[#1e3a5f] rounded-lg p-5 border border-[#2a4a6f]">
              <h2 className="text-base font-semibold text-white mb-1">
                SMS Test Console
              </h2>
              <p className="text-xs text-[#666680] mb-5">
                Sends a real SMS via Mosio. Notifications are not recorded in
                the database.
              </p>

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

              <div className="text-xs font-medium text-[#a0a0b8] uppercase tracking-wider mb-3">
                Send test notification
              </div>
              <div className="space-y-2">
                {[
                  {
                    type: "at_bat",
                    icon: "⚾",
                    label: "You're Up",
                    desc: "at_bat player – time to submit question",
                  },
                  {
                    type: "new_question",
                    icon: "❓",
                    label: "New Question",
                    desc: "all other players – bets are open",
                  },
                  {
                    type: "all_answers_in",
                    icon: "✅",
                    label: "All Answers In",
                    desc: "at_bat player – time to grade",
                  },
                  {
                    type: "on_deck",
                    icon: "🎯",
                    label: "On Deck",
                    desc: "on_deck player – low level only",
                  },
                  {
                    type: "round_results",
                    icon: "🏆",
                    label: "Round Results",
                    desc: "all players – high level only",
                  },
                  {
                    type: "about_to_be_skipped",
                    icon: "⚠️",
                    label: "About to Be Skipped",
                    desc: "last holdout – high level only",
                  },
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
                          <div className="text-sm font-medium text-white">
                            {label}
                          </div>
                          <div className="text-xs text-[#666680] truncate">
                            {desc}
                          </div>
                        </div>
                      </div>
                      <button
                        disabled={s === "sending" || !testPhone.trim()}
                        onClick={async () => {
                          setTestStatus((prev) => ({
                            ...prev,
                            [type]: "sending",
                          }));
                          try {
                            const res = await fetch("/api/admin/test-sms", {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({
                                to: testPhone,
                                type,
                                appendText: testAppend,
                              }),
                            });
                            const data = await res.json();
                            setTestStatus((prev) => ({
                              ...prev,
                              [type]: data.error ? "failed" : "sent",
                            }));
                            if (data.error) {
                              alert(`Failed: ${data.error}`);
                            }
                          } catch {
                            setTestStatus((prev) => ({
                              ...prev,
                              [type]: "failed",
                            }));
                            alert("Request failed");
                          }
                          setTimeout(
                            () =>
                              setTestStatus((prev) => ({
                                ...prev,
                                [type]: "idle",
                              })),
                            4000
                          );
                        }}
                        className={`shrink-0 px-4 py-1.5 rounded-lg text-xs font-semibold transition-all border ${
                          s === "sent"
                            ? "bg-green-500/20 border-green-500/50 text-green-400"
                            : s === "failed"
                            ? "bg-red-500/20 border-red-500/50 text-red-400"
                            : s === "sending"
                            ? "bg-[#1e3a5f] border-[#2a4a6f] text-[#666680] cursor-wait"
                            : !testPhone.trim()
                            ? "bg-[#1e3a5f] border-[#2a4a6f] text-[#666680] cursor-not-allowed"
                            : "bg-[#e94560]/10 border-[#e94560]/40 text-[#e94560] hover:bg-[#e94560]/20"
                        }`}
                      >
                        {s === "sending"
                          ? "Sending…"
                          : s === "sent"
                          ? "✓ Sent"
                          : s === "failed"
                          ? "✗ Failed"
                          : "Send"}
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
                <div className="bg-[#1e3a5f] rounded-lg p-5 border border-[#2a4a6f]">
                  <h2 className="text-sm font-semibold text-[#a0a0b8] uppercase tracking-wider mb-2">
                    Global Notification Override
                  </h2>
                  <p className="text-xs text-[#666680] mb-3">
                    Overrides all league commissioner settings. Use &quot;Force
                    None&quot; if SMS is going haywire.
                  </p>
                  <div className="flex gap-3 flex-wrap">
                    {[
                      { value: "commissioner", label: "Commissioner Specified" },
                      { value: "none", label: "Force All to None" },
                    ].map((opt) => (
                      <button
                        key={opt.value}
                        disabled={
                          savingOverride ||
                          notifStats.globalOverride === opt.value
                        }
                        onClick={async () => {
                          setSavingOverride(true);
                          await fetch("/api/admin/global-settings", {
                            method: "PUT",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                              notificationOverride: opt.value,
                            }),
                          });
                          setNotifStats((prev) =>
                            prev ? { ...prev, globalOverride: opt.value } : prev
                          );
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

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {[
                    {
                      label: "Total Sent",
                      value: notifStats.totalSent.toLocaleString(),
                    },
                    {
                      label: "SMS Sent",
                      value: notifStats.totalSms.toLocaleString(),
                    },
                    {
                      label: "Link Clicks",
                      value: notifStats.totalClicks.toLocaleString(),
                    },
                    {
                      label: "Click Rate",
                      value: `${notifStats.clickRate.toFixed(1)}%`,
                    },
                  ].map((stat) => (
                    <div
                      key={stat.label}
                      className="bg-[#1e3a5f] rounded-lg p-4 border border-[#2a4a6f] text-center"
                    >
                      <div className="text-2xl font-bold text-amber-400">
                        {stat.value}
                      </div>
                      <div className="text-xs text-[#a0a0b8] mt-1">
                        {stat.label}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="bg-[#1e3a5f] rounded-lg p-5 border border-[#2a4a6f]">
                  <h2 className="text-sm font-semibold text-[#a0a0b8] uppercase tracking-wider mb-3">
                    Notifications by Type
                  </h2>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-[#2a4a6f]">
                          <th className="p-2 text-left text-[#a0a0b8]">Type</th>
                          <th className="p-2 text-right text-[#a0a0b8]">
                            Total
                          </th>
                          <th className="p-2 text-right text-[#a0a0b8]">SMS</th>
                          <th className="p-2 text-right text-[#a0a0b8]">
                            Clicks
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {notifStats.byType.map((row) => (
                          <tr
                            key={row.type}
                            className="border-b border-[#2a4a6f]/50"
                          >
                            <td className="p-2 text-white capitalize">
                              {row.type.replace(/_/g, " ")}
                            </td>
                            <td className="p-2 text-right text-[#a0a0b8]">
                              {row.count}
                            </td>
                            <td className="p-2 text-right text-[#a0a0b8]">
                              {row.smsCount}
                            </td>
                            <td className="p-2 text-right text-[#a0a0b8]">
                              {row.clickCount}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="bg-[#1e3a5f] rounded-lg p-5 border border-[#2a4a6f]">
                  <h2 className="text-sm font-semibold text-[#a0a0b8] uppercase tracking-wider mb-3">
                    Recent Notifications (last 50)
                  </h2>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-[#2a4a6f]">
                          <th className="p-2 text-left text-[#a0a0b8]">Type</th>
                          <th className="p-2 text-left text-[#a0a0b8]">
                            Title
                          </th>
                          <th className="p-2 text-left text-[#a0a0b8]">
                            Player
                          </th>
                          <th className="p-2 text-center text-[#a0a0b8]">
                            SMS
                          </th>
                          <th className="p-2 text-center text-[#a0a0b8]">
                            Clicked
                          </th>
                          <th className="p-2 text-right text-[#a0a0b8]">
                            Sent
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {notifStats.recentNotifications.map((n) => (
                          <tr
                            key={n.id}
                            className="border-b border-[#2a4a6f]/50"
                          >
                            <td className="p-2 text-[#a0a0b8] capitalize text-xs">
                              {n.type.replace(/_/g, " ")}
                            </td>
                            <td className="p-2 text-white text-xs max-w-[180px] truncate">
                              {n.title}
                            </td>
                            <td className="p-2 text-[#a0a0b8] text-xs">
                              <button
                                onClick={() =>
                                  goTo("players", {
                                    playerUserId: n.userId,
                                    playerName: n.userNickname,
                                  })
                                }
                                className="hover:text-amber-400 transition underline-offset-2 hover:underline"
                              >
                                {n.userNickname}
                              </button>
                            </td>
                            <td className="p-2 text-center">
                              <span
                                className={`text-xs ${
                                  n.smsStatus === "sent"
                                    ? "text-green-400"
                                    : n.smsStatus === "failed"
                                    ? "text-red-400"
                                    : "text-[#666680]"
                                }`}
                              >
                                {n.smsStatus ?? "—"}
                              </span>
                            </td>
                            <td className="p-2 text-center text-xs">
                              {n.clickedAt ? (
                                <span className="text-green-400">✓</span>
                              ) : (
                                <span className="text-[#666680]">—</span>
                              )}
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

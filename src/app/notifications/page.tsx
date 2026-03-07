"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  link: string | null;
  isRead: boolean;
  leagueId: string | null;
  roundId: string | null;
  gameId: string | null;
  createdAt: string;
}

const TYPE_ICONS: Record<string, string> = {
  at_bat: "⚾",
  new_question: "❓",
  all_answers_in: "✅",
  on_deck: "🎯",
  round_results: "🏆",
  about_to_be_skipped: "⚠️",
};

const TYPE_LABELS: Record<string, string> = {
  at_bat: "You're Up",
  new_question: "New Question",
  all_answers_in: "Time to Grade",
  on_deck: "On Deck",
  round_results: "Round Results",
  about_to_be_skipped: "Deadline Warning",
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

const PAGE_SIZE = 20;

export default function NotificationsPage() {
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams({
      page: String(page),
      pageSize: String(PAGE_SIZE),
      ...(filter === "unread" ? { unread: "true" } : {}),
    });
    fetch(`/api/notifications/list?${params}`)
      .then((r) => r.json())
      .then((d) => {
        setNotifications(d.notifications || []);
        setTotal(d.total || 0);
      })
      .finally(() => setLoading(false));
  }, [page, filter]);

  const handleClick = (notif: Notification) => {
    // Mark read optimistically
    setNotifications((prev) =>
      prev.map((n) => (n.id === notif.id ? { ...n, isRead: true } : n))
    );
    // Record click in background, navigate directly to destination
    fetch(`/api/notifications/click/${notif.id}`).catch(() => {});
    if (notif.link) {
      router.push(notif.link);
    }
  };

  const markAllRead = async () => {
    await fetch("/api/notifications", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
  };

  const totalPages = Math.ceil(total / PAGE_SIZE);
  const unreadCount = notifications.filter((n) => !n.isRead).length;

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Notifications</h1>
          {unreadCount > 0 && (
            <p className="text-sm text-[#a0a0b8] mt-1">{unreadCount} unread</p>
          )}
        </div>
        <div className="flex items-center gap-3">
          {unreadCount > 0 && (
            <button
              onClick={markAllRead}
              className="text-sm text-[#4fc3f7] hover:text-white transition-colors"
            >
              Mark all read
            </button>
          )}
          <Link href="/dashboard" className="btn btn-secondary text-sm">
            ← Back
          </Link>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 mb-4">
        {(["all", "unread"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => { setFilter(tab); setPage(1); }}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
              filter === tab
                ? "bg-[#e94560] text-white"
                : "text-[#a0a0b8] hover:text-white border border-[#1e3a5f]"
            }`}
          >
            {tab === "all" ? "All" : "Unread"}
          </button>
        ))}
      </div>

      {/* Notification List */}
      <div className="card p-0 overflow-hidden">
        {loading ? (
          <div className="py-12 text-center text-[#a0a0b8]">Loading...</div>
        ) : notifications.length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-4xl mb-3">🔔</p>
            <p className="text-[#a0a0b8]">
              {filter === "unread" ? "No unread notifications" : "No notifications yet"}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-[#1e3a5f]/50">
            {notifications.map((notif) => (
              <button
                key={notif.id}
                onClick={() => handleClick(notif)}
                className={`w-full text-left px-4 py-4 hover:bg-[#1e3a5f]/20 transition-colors flex gap-3 ${
                  !notif.isRead ? "bg-[#1e3a5f]/15" : ""
                }`}
              >
                <span className="text-2xl flex-shrink-0 mt-0.5">
                  {TYPE_ICONS[notif.type] ?? "🔔"}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="text-xs text-[#4fc3f7] font-medium uppercase tracking-wide">
                        {TYPE_LABELS[notif.type] ?? notif.type}
                      </span>
                      <p className={`text-sm font-semibold mt-0.5 ${notif.isRead ? "text-[#c0c0d8]" : "text-white"}`}>
                        {notif.title}
                      </p>
                    </div>
                    {!notif.isRead && (
                      <span className="w-2.5 h-2.5 rounded-full bg-[#e94560] flex-shrink-0 mt-1" />
                    )}
                  </div>
                  <p className="text-sm text-[#a0a0b8] mt-1">{notif.message}</p>
                  <p className="text-xs text-[#606080] mt-1.5">{timeAgo(notif.createdAt)}</p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 mt-6">
          <button
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
            className="btn btn-secondary text-sm disabled:opacity-40"
          >
            ← Prev
          </button>
          <span className="text-sm text-[#a0a0b8]">
            Page {page} of {totalPages}
          </span>
          <button
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
            className="btn btn-secondary text-sm disabled:opacity-40"
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
}

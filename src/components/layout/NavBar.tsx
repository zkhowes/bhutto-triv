"use client";

import { useSession, signOut } from "next-auth/react";
import Link from "next/link";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Avatar from "@/components/ui/Avatar";

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

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function NavBar() {
  const { data: session } = useSession();
  const router = useRouter();
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [menuOpen, setMenuOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!session?.user) return;

    const fetchNotifications = () => {
      fetch("/api/notifications")
        .then((r) => r.json())
        .then((d) => {
          setUnreadCount(d.unreadCount || 0);
          setNotifications(d.notifications || []);
        })
        .catch(() => {});
    };

    let interval: ReturnType<typeof setInterval>;

    const startPolling = () => {
      interval = setInterval(fetchNotifications, 90000);
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        clearInterval(interval);
      } else {
        fetchNotifications();
        startPolling();
      }
    };

    fetchNotifications();
    startPolling();
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [session]);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotifOpen(false);
      }
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const openNotifications = () => {
    setNotifOpen((prev) => !prev);
    setMenuOpen(false);
  };

  const handleNotificationClick = async (notif: Notification) => {
    // Mark as read optimistically
    setNotifications((prev) =>
      prev.map((n) => (n.id === notif.id ? { ...n, isRead: true } : n))
    );
    setUnreadCount((prev) => Math.max(0, prev - (notif.isRead ? 0 : 1)));
    setNotifOpen(false);

    // Navigate via click-tracking URL (records the click server-side)
    const clickUrl = `/api/notifications/click/${notif.id}`;
    router.push(clickUrl);
  };

  const markAllRead = async () => {
    await fetch("/api/notifications", { method: "PUT", body: JSON.stringify({}) });
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    setUnreadCount(0);
  };

  if (!session?.user) return null;

  return (
    <nav className="sticky top-0 z-50 bg-[#1a1a2e]/95 backdrop-blur border-b border-[#1e3a5f]">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center justify-between h-14">
          {/* Logo */}
          <Link
            href="/dashboard"
            className="flex items-center gap-2 font-bold text-lg"
          >
            <span className="text-[#e94560]">BW</span>
            <span className="hidden sm:inline text-white">Bhutto Wisdom</span>
          </Link>

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center gap-6">
            <Link
              href="/dashboard"
              className="text-[#a0a0b8] hover:text-white transition-colors text-sm font-medium"
            >
              Dashboard
            </Link>
            <Link
              href="/leagues/create"
              className="text-[#a0a0b8] hover:text-white transition-colors text-sm font-medium"
            >
              Create League
            </Link>
            <Link
              href="/questions/workshop"
              className="text-[#a0a0b8] hover:text-white transition-colors text-sm font-medium"
            >
              Workshop
            </Link>
            {session.user.isSuperAdmin && (
              <Link
                href="/admin"
                className="text-amber-400 hover:text-amber-300 transition-colors text-sm font-medium"
              >
                Admin
              </Link>
            )}
          </div>

          {/* Right side */}
          <div className="flex items-center gap-3">
            {/* Notifications Bell */}
            <div className="relative" ref={notifRef}>
              <button
                onClick={openNotifications}
                className="relative p-2 text-[#a0a0b8] hover:text-white transition-colors"
                aria-label="Notifications"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
                  />
                </svg>
                {unreadCount > 0 && (
                  <span className="notification-badge">{unreadCount > 99 ? "99+" : unreadCount}</span>
                )}
              </button>

              {/* Notification Dropdown */}
              {notifOpen && (
                <div className="absolute right-0 mt-2 w-80 card py-0 z-50 shadow-xl overflow-hidden">
                  {/* Header */}
                  <div className="flex items-center justify-between px-4 py-3 border-b border-[#1e3a5f]">
                    <span className="text-sm font-semibold text-white">Notifications</span>
                    {unreadCount > 0 && (
                      <button
                        onClick={markAllRead}
                        className="text-xs text-[#4fc3f7] hover:text-white transition-colors"
                      >
                        Mark all read
                      </button>
                    )}
                  </div>

                  {/* List */}
                  <div className="max-h-96 overflow-y-auto">
                    {notifications.length === 0 ? (
                      <div className="px-4 py-8 text-center text-[#a0a0b8] text-sm">
                        No notifications yet
                      </div>
                    ) : (
                      notifications.map((notif) => (
                        <button
                          key={notif.id}
                          onClick={() => handleNotificationClick(notif)}
                          className={`w-full text-left px-4 py-3 border-b border-[#1e3a5f]/50 hover:bg-[#1e3a5f]/30 transition-colors flex gap-3 ${
                            !notif.isRead ? "bg-[#1e3a5f]/20" : ""
                          }`}
                        >
                          <span className="text-lg flex-shrink-0 mt-0.5">
                            {TYPE_ICONS[notif.type] ?? "🔔"}
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-start justify-between gap-2">
                              <p className={`text-sm font-medium leading-tight ${notif.isRead ? "text-[#a0a0b8]" : "text-white"}`}>
                                {notif.title}
                              </p>
                              {!notif.isRead && (
                                <span className="w-2 h-2 rounded-full bg-[#e94560] flex-shrink-0 mt-1" />
                              )}
                            </div>
                            <p className="text-xs text-[#a0a0b8] mt-0.5 line-clamp-2">{notif.message}</p>
                            <p className="text-xs text-[#606080] mt-1">{timeAgo(notif.createdAt)}</p>
                          </div>
                        </button>
                      ))
                    )}
                  </div>

                  {/* Footer */}
                  <div className="border-t border-[#1e3a5f] px-4 py-2">
                    <Link
                      href="/notifications"
                      onClick={() => setNotifOpen(false)}
                      className="text-xs text-[#4fc3f7] hover:text-white transition-colors block text-center"
                    >
                      View all notifications →
                    </Link>
                  </div>
                </div>
              )}
            </div>

            {/* Profile */}
            <div className="relative" ref={menuRef}>
              <button
                onClick={() => { setMenuOpen(!menuOpen); setNotifOpen(false); }}
                className="flex items-center gap-2"
              >
                <Avatar
                  src={session.user.avatarUrl || session.user.image}
                  name={session.user.nickname || session.user.name}
                  size="sm"
                />
              </button>
              {menuOpen && (
                <div className="absolute right-0 mt-2 w-48 card py-2 z-50">
                  <div className="px-4 py-2 border-b border-[#1e3a5f]">
                    <p className="text-sm font-medium text-white">
                      {session.user.nickname || session.user.name}
                    </p>
                    <p className="text-xs text-[#a0a0b8]">
                      {session.user.email}
                    </p>
                  </div>
                  <Link
                    href="/profile"
                    className="block px-4 py-2 text-sm text-[#a0a0b8] hover:text-white hover:bg-[#1e3a5f]/50"
                    onClick={() => setMenuOpen(false)}
                  >
                    Profile Settings
                  </Link>
                  <Link
                    href="/questions/bank"
                    className="block px-4 py-2 text-sm text-[#a0a0b8] hover:text-white hover:bg-[#1e3a5f]/50"
                    onClick={() => setMenuOpen(false)}
                  >
                    Question Bank
                  </Link>
                  <button
                    onClick={() => signOut({ callbackUrl: "/" })}
                    className="block w-full text-left px-4 py-2 text-sm text-red-400 hover:text-red-300 hover:bg-[#1e3a5f]/50"
                  >
                    Sign Out
                  </button>
                </div>
              )}
            </div>

            {/* Mobile menu button */}
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="md:hidden p-2 text-[#a0a0b8]"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 6h16M4 12h16M4 18h16"
                />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
}

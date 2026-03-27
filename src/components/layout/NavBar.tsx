"use client";

import { useSession, signOut } from "next-auth/react";
import Link from "next/link";
import { useState, useEffect, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
import Avatar from "@/components/ui/Avatar";
import WhatsNewModal from "@/components/ui/WhatsNewModal";

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
  const { data: session, status } = useSession();
  const router = useRouter();
  const pathname = usePathname();

  // Redirect to profile setup if user is authenticated but profile incomplete
  useEffect(() => {
    if (status === "authenticated" && session?.user && !session.user.profileComplete && pathname !== "/profile") {
      router.push("/profile");
    }
  }, [status, session, pathname, router]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [menuOpen, setMenuOpen] = useState(false);
  const [shortSha, setShortSha] = useState<string | null>(null);
  const [commissionerLeagueId, setCommissionerLeagueId] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/version")
      .then((r) => r.json())
      .then((d) => setShortSha(d.shortSha ?? null))
      .catch(() => {});
  }, []);

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

  // Detect league context from pathname and check commissioner status
  useEffect(() => {
    if (!session?.user || !pathname) {
      setCommissionerLeagueId(null);
      return;
    }

    // Extract league ID from /leagues/[id], /games/[id], or /rounds/[id]
    const leagueMatch = pathname.match(/^\/leagues\/([^/]+)/);
    const gameMatch = pathname.match(/^\/games\/([^/]+)/);
    const roundMatch = pathname.match(/^\/rounds\/([^/]+)/);

    if (leagueMatch) {
      const leagueId = leagueMatch[1];
      fetch(`/api/leagues/${leagueId}`)
        .then((r) => r.json())
        .then((d) => setCommissionerLeagueId(d.myRole === "commissioner" ? leagueId : null))
        .catch(() => setCommissionerLeagueId(null));
    } else if (gameMatch) {
      fetch(`/api/games/${gameMatch[1]}`)
        .then((r) => r.json())
        .then((d) => {
          const leagueId = d.season?.league?.id;
          if (!leagueId) { setCommissionerLeagueId(null); return; }
          fetch(`/api/leagues/${leagueId}`)
            .then((r) => r.json())
            .then((ld) => setCommissionerLeagueId(ld.myRole === "commissioner" ? leagueId : null))
            .catch(() => setCommissionerLeagueId(null));
        })
        .catch(() => setCommissionerLeagueId(null));
    } else if (roundMatch) {
      fetch(`/api/rounds/${roundMatch[1]}`)
        .then((r) => r.json())
        .then((d) => {
          const leagueId = d.game?.season?.league?.id;
          if (!leagueId) { setCommissionerLeagueId(null); return; }
          fetch(`/api/leagues/${leagueId}`)
            .then((r) => r.json())
            .then((ld) => setCommissionerLeagueId(ld.myRole === "commissioner" ? leagueId : null))
            .catch(() => setCommissionerLeagueId(null));
        })
        .catch(() => setCommissionerLeagueId(null));
    } else {
      setCommissionerLeagueId(null);
    }
  }, [session, pathname]);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const openAvatarMenu = () => {
    setMenuOpen((prev) => {
      if (!prev && unreadCount > 0) {
        fetch("/api/notifications", { method: "PUT", body: JSON.stringify({}) });
        setNotifications((n) => n.map((x) => ({ ...x, isRead: true })));
        setUnreadCount(0);
      }
      return !prev;
    });
  };

  const handleNotificationClick = async (notif: Notification) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === notif.id ? { ...n, isRead: true } : n))
    );
    setUnreadCount((prev) => Math.max(0, prev - (notif.isRead ? 0 : 1)));
    setMenuOpen(false);
    // Record click in background, navigate directly to destination
    fetch(`/api/notifications/click/${notif.id}`).catch(() => {});
    if (notif.link) {
      router.push(notif.link);
    }
  };

  const markAllRead = async () => {
    await fetch("/api/notifications", { method: "PUT", body: JSON.stringify({}) });
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    setUnreadCount(0);
  };

  if (!session?.user) return null;

  return (
    <>
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
            {session.user.isSuperAdmin && (
              <span className="text-[10px] font-bold text-amber-400 bg-amber-400/10 px-1.5 py-0.5 rounded ml-2">
                SA
              </span>
            )}
          </Link>
          {shortSha && (
            <Link
              href="/version"
              className="text-[10px] font-mono text-[#606080] hover:text-[#a0a0b8] transition-colors ml-1"
            >
              {shortSha}
            </Link>
          )}

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
            {/* Commissioner icon */}
            {commissionerLeagueId && (
              <Link
                href={`/leagues/${commissionerLeagueId}/commissioner`}
                className="flex items-center justify-center w-8 h-8 rounded-full bg-amber-500/20 text-amber-400 hover:bg-amber-500/30 transition-colors font-bold text-sm"
                title="Commissioner Tools"
              >
                C
              </Link>
            )}

            {/* Avatar with notification badge + dropdown */}
            <div className="relative" ref={menuRef}>
              <button
                onClick={openAvatarMenu}
                className="relative flex items-center gap-2"
              >
                <Avatar
                  src={session.user.avatarUrl || session.user.image}
                  name={session.user.nickname || session.user.name}
                  size="sm"
                />
                {unreadCount > 0 && (
                  <span className="notification-badge">
                    {unreadCount > 99 ? "99+" : unreadCount}
                  </span>
                )}
              </button>

              {menuOpen && (
                <div className="absolute right-0 mt-2 w-80 card py-0 z-50 shadow-xl overflow-hidden">
                  {/* User info */}
                  <div className="px-4 py-3 border-b border-[#1e3a5f]">
                    <p className="text-sm font-medium text-white">
                      {session.user.nickname || session.user.name}
                    </p>
                    <p className="text-xs text-[#a0a0b8]">
                      {session.user.email}
                    </p>
                  </div>

                  {/* Quick links */}
                  <div className="border-b border-[#1e3a5f]">
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
                    {/* Mobile-only nav links */}
                    <Link
                      href="/dashboard"
                      className="block md:hidden px-4 py-2 text-sm text-[#a0a0b8] hover:text-white hover:bg-[#1e3a5f]/50"
                      onClick={() => setMenuOpen(false)}
                    >
                      Dashboard
                    </Link>
                    <Link
                      href="/questions/workshop"
                      className="block md:hidden px-4 py-2 text-sm text-[#a0a0b8] hover:text-white hover:bg-[#1e3a5f]/50"
                      onClick={() => setMenuOpen(false)}
                    >
                      Workshop
                    </Link>
                  </div>

                  {/* Notifications section */}
                  <div className="flex items-center justify-between px-4 py-2 border-b border-[#1e3a5f]">
                    <span className="text-xs font-semibold text-[#a0a0b8] uppercase tracking-wider">Notifications</span>
                    {notifications.some((n) => !n.isRead) && (
                      <button
                        onClick={markAllRead}
                        className="text-xs text-[#4fc3f7] hover:text-white transition-colors"
                      >
                        Mark all read
                      </button>
                    )}
                  </div>

                  <div className="max-h-64 overflow-y-auto">
                    {notifications.length === 0 ? (
                      <div className="px-4 py-6 text-center text-[#a0a0b8] text-xs">
                        No notifications yet
                      </div>
                    ) : (
                      notifications.slice(0, 5).map((notif) => (
                        <button
                          key={notif.id}
                          onClick={() => handleNotificationClick(notif)}
                          className={`w-full text-left px-4 py-2.5 border-b border-[#1e3a5f]/50 hover:bg-[#1e3a5f]/30 transition-colors flex gap-2.5 ${
                            !notif.isRead ? "bg-[#1e3a5f]/20" : ""
                          }`}
                        >
                          <span className="text-sm flex-shrink-0 mt-0.5">
                            {TYPE_ICONS[notif.type] ?? ""}
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className={`text-xs font-medium leading-tight ${notif.isRead ? "text-[#a0a0b8]" : "text-white"}`}>
                              {notif.title}
                            </p>
                            <p className="text-xs text-[#606080] mt-0.5">{timeAgo(notif.createdAt)}</p>
                          </div>
                          {!notif.isRead && (
                            <span className="w-1.5 h-1.5 rounded-full bg-[#e94560] flex-shrink-0 mt-1.5" />
                          )}
                        </button>
                      ))
                    )}
                  </div>

                  {notifications.length > 5 && (
                    <div className="border-t border-[#1e3a5f] px-4 py-2">
                      <Link
                        href="/notifications"
                        onClick={() => setMenuOpen(false)}
                        className="text-xs text-[#4fc3f7] hover:text-white transition-colors block text-center"
                      >
                        View all notifications
                      </Link>
                    </div>
                  )}

                  {/* Sign out */}
                  <div className="border-t border-[#1e3a5f]">
                    <button
                      onClick={() => signOut({ callbackUrl: "/" })}
                      className="block w-full text-left px-4 py-2 text-sm text-red-400 hover:text-red-300 hover:bg-[#1e3a5f]/50"
                    >
                      Sign Out
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </nav>
    <WhatsNewModal />
    </>
  );
}

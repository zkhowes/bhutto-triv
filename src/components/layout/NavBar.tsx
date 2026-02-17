"use client";

import { useSession, signOut } from "next-auth/react";
import Link from "next/link";
import { useState, useEffect } from "react";
import Avatar from "@/components/ui/Avatar";

export default function NavBar() {
  const { data: session } = useSession();
  const [unreadCount, setUnreadCount] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (session?.user) {
      fetch("/api/notifications")
        .then((r) => r.json())
        .then((d) => setUnreadCount(d.unreadCount || 0))
        .catch(() => {});
    }
  }, [session]);

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
            {/* Notifications */}
            <Link href="/dashboard" className="relative p-2">
              <svg
                className="w-5 h-5 text-[#a0a0b8]"
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
                <span className="notification-badge">{unreadCount}</span>
              )}
            </Link>

            {/* Profile */}
            <div className="relative">
              <button
                onClick={() => setMenuOpen(!menuOpen)}
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

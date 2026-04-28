"use client";

import { useSession, signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function HomePage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [signingIn, setSigningIn] = useState<"google" | "apple" | null>(null);

  useEffect(() => {
    if (session?.user) {
      if (session.user.profileComplete) {
        router.push("/dashboard");
      } else {
        router.push("/profile");
      }
    }
  }, [session, router]);

  const handleSignIn = (provider: "google" | "apple") => {
    setSigningIn(provider);
    signIn(provider, { callbackUrl: "/dashboard" });
  };

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-[#e94560] text-xl">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Hero */}
      <div className="flex-1 flex flex-col items-center justify-center px-4 text-center">
        <div className="mb-8 animate-bounce-in">
          <div className="text-6xl sm:text-8xl font-black tracking-tighter">
            <span className="text-[#e94560]">BHUTTO</span>
            <br />
            <span className="text-[#fbbf24]">WISDOM</span>
          </div>
        </div>

        <p className="text-[#a0a0b8] text-lg sm:text-xl max-w-md mb-2 animate-fade-in">
          Competitive daily trivia with a twist.
        </p>
        <p className="text-[#666680] text-sm sm:text-base max-w-lg mb-10 animate-fade-in">
          Create questions, bet your points, outsmart your friends.
          League play with seasons, stats, and a Hall of Fame.
        </p>

        <div className="flex flex-col gap-3 animate-slide-up">
          {signingIn ? (
            <div className="text-center py-4">
              <div className="animate-spin w-6 h-6 border-2 border-[#e94560] border-t-transparent rounded-full mx-auto mb-3" />
              <p className="text-[#a0a0b8] text-sm">
                Connecting to {signingIn === "apple" ? "Apple" : "Google"}...
              </p>
            </div>
          ) : (
            <>
              <button
                onClick={() => handleSignIn("google")}
                className="btn-primary text-lg px-8 py-3 flex items-center gap-3"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path
                    fill="currentColor"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                  />
                  <path
                    fill="currentColor"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="currentColor"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  />
                  <path
                    fill="currentColor"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </svg>
                Sign in with Google
              </button>

              <button
                onClick={() => handleSignIn("apple")}
                className="text-lg px-8 py-3 flex items-center gap-3 rounded-lg font-semibold bg-white text-black hover:bg-gray-100 transition-colors"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path
                    fill="currentColor"
                    d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"
                  />
                </svg>
                Sign in with Apple
              </button>
            </>
          )}
        </div>

        <div className="mt-4 animate-slide-up" style={{ animationDelay: "0.1s" }}>
          <a
            href="/demo"
            className="text-sm text-[#a0a0b8] hover:text-white transition-colors underline underline-offset-4"
          >
            Try the demo
          </a>
        </div>

        <div className="mt-4 text-xs text-[#666680]">
          Join or create a league to get started
        </div>

        {/* Feature highlights */}
        <div className="mt-16 grid grid-cols-1 sm:grid-cols-3 gap-6 max-w-3xl w-full">
          <div className="card p-6 text-center animate-slide-up">
            <div className="text-3xl mb-3">&#9918;</div>
            <h3 className="font-bold text-white mb-2">League Play</h3>
            <p className="text-sm text-[#a0a0b8]">
              Seasons, games, and rounds. Climb the leaderboard.
            </p>
          </div>
          <div
            className="card p-6 text-center animate-slide-up"
            style={{ animationDelay: "0.1s" }}
          >
            <div className="text-3xl mb-3">&#127922;</div>
            <h3 className="font-bold text-white mb-2">Bet & Answer</h3>
            <p className="text-sm text-[#a0a0b8]">
              Wager your points on every question. Risk it all.
            </p>
          </div>
          <div
            className="card p-6 text-center animate-slide-up"
            style={{ animationDelay: "0.2s" }}
          >
            <div className="text-3xl mb-3">&#127942;</div>
            <h3 className="font-bold text-white mb-2">Hall of Fame</h3>
            <p className="text-sm text-[#a0a0b8]">
              Season awards, stats, and all-time records.
            </p>
          </div>
        </div>
        {/* Lore Section */}
        <div className="mt-20 max-w-2xl w-full mx-auto text-center px-4 animate-fade-in">
          <div className="border-t border-[#1e3a5f] mb-10" />
          <h2 className="text-xl sm:text-2xl font-bold text-[#fbbf24] mb-6">
            The Order of Bhutto
          </h2>
          <p className="text-[#a0a0b8] text-sm sm:text-base leading-relaxed mb-4">
            In an age before written record, a mythical clan of monks &mdash; the
            Bhuttos &mdash; devoted themselves to knowing all things. They believed
            wisdom was not proven by recitation, but by conviction. To test their
            knowledge, each Bhutto would pose a challenge to the others, who would
            wager something of great value on their answer. Only those willing to
            risk loss could claim true wisdom.
          </p>
          <p className="text-[#a0a0b8] text-sm sm:text-base leading-relaxed">
            Their tradition lives on. In Bhutto Wisdom, you stake your points on
            every question. The bold are rewarded. The reckless are eliminated.
            Only the wisest survive the season.
          </p>
          <div className="border-t border-[#1e3a5f] mt-10" />
        </div>
      </div>

      {/* Footer */}
      <footer className="py-6 text-center text-xs text-[#666680]">
        <div className="mb-2">Bhutto Wisdom &copy; {new Date().getFullYear()}</div>
        <div className="flex items-center justify-center gap-4">
          <a href="/privacy" className="hover:text-[#a0a0b8] transition-colors">
            Privacy Policy
          </a>
          <span>&middot;</span>
          <a href="/terms" className="hover:text-[#a0a0b8] transition-colors">
            Terms &amp; Conditions
          </a>
        </div>
      </footer>
    </div>
  );
}

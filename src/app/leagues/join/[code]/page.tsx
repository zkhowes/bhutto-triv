"use client";

import { useSession, signIn } from "next-auth/react";
import { useRouter, useParams } from "next/navigation";
import { useState, useEffect } from "react";

export default function JoinLeaguePage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const params = useParams();
  const code = params.code as string;
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState("");
  const [signingIn, setSigningIn] = useState<"google" | "apple" | null>(null);

  const handleSignIn = (provider: "google" | "apple") => {
    setSigningIn(provider);
    signIn(provider, { callbackUrl: `/leagues/join/${code}` });
  };

  useEffect(() => {
    if (session?.user && code) {
      // If profile is incomplete, redirect to profile setup first with a return URL
      if (!session.user.profileComplete) {
        router.push(`/profile?returnTo=/leagues/join/${code}`);
        return;
      }
      setJoining(true);
      fetch("/api/leagues/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inviteCode: code }),
      })
        .then((r) => r.json())
        .then((data) => {
          if (data.leagueId) {
            router.push(`/dashboard`);
          } else {
            setError(data.error || "Failed to join");
            setJoining(false);
          }
        })
        .catch(() => {
          setError("Failed to join league");
          setJoining(false);
        });
    }
  }, [session, code, router]);

  if (status === "loading" || joining) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-pulse text-[#e94560] text-xl mb-2">
            Joining league...
          </div>
          <p className="text-[#666680] text-sm">Code: {code}</p>
        </div>
      </div>
    );
  }

  if (!session?.user) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="card p-8 text-center max-w-sm">
          <h1 className="text-2xl font-bold text-white mb-2">
            Join League
          </h1>
          <p className="text-[#a0a0b8] text-sm mb-6">
            Sign in to join this league
          </p>
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
                className="btn-primary w-full flex items-center justify-center gap-3"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
                  <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                  <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                </svg>
                Sign in with Google
              </button>
              <button
                onClick={() => handleSignIn("apple")}
                className="w-full text-lg px-8 py-3 flex items-center justify-center gap-3 rounded-lg font-semibold bg-white text-black hover:bg-gray-100 transition-colors"
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
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="card p-8 text-center max-w-sm">
        {error ? (
          <>
            <p className="text-red-400 mb-4">{error}</p>
            <button
              onClick={() => router.push("/dashboard")}
              className="btn-primary"
            >
              Go to Dashboard
            </button>
          </>
        ) : (
          <div className="animate-pulse text-[#e94560]">Processing...</div>
        )}
      </div>
    </div>
  );
}

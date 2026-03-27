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
          <button
            onClick={() => signIn("google", { callbackUrl: `/leagues/join/${code}` })}
            className="btn-primary w-full"
          >
            Sign in with Google
          </button>
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

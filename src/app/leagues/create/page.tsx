"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import NavBar from "@/components/layout/NavBar";
import { useRequireProfile } from "@/hooks/useRequireProfile";

export default function CreateLeaguePage() {
  useRequireProfile();
  const { data: session, status } = useSession();
  const router = useRouter();
  const [name, setName] = useState("");
  const [type, setType] = useState("season");
  const [maxPlayers, setMaxPlayers] = useState(6);
  const [gamesPerSeason, setGamesPerSeason] = useState(3);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const isDev = process.env.NODE_ENV === "development" || session?.user?.isSuperAdmin;

  useEffect(() => {
    if (status === "unauthenticated") router.push("/");
  }, [status, router]);

  useEffect(() => {
    fetch("/api/ai/suggest-names")
      .then((r) => r.json())
      .then((d) => setSuggestions(d.names || []))
      .catch(() => {});
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("League name is required");
      return;
    }
    setCreating(true);
    setError("");

    try {
      const res = await fetch("/api/leagues", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          type,
          maxPlayers,
          gamesPerSeason,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to create league");
      }

      const league = await res.json();

      // Auto-populate fake players for test leagues
      if (type === "test") {
        const testRes = await fetch(`/api/leagues/${league.id}/test-players`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ count: maxPlayers - 1 }),
        });
        if (!testRes.ok) {
          const testData = await testRes.json();
          console.error("Failed to add test players:", testData.error);
        }
      }

      router.push(`/leagues/${league.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create league");
    } finally {
      setCreating(false);
    }
  };

  if (status === "loading") {
    return (
      <div className="min-h-screen">
        <NavBar />
        <div className="flex items-center justify-center py-20">
          <div className="animate-pulse text-[#e94560]">Loading...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <NavBar />
      <div className="max-w-lg mx-auto px-4 py-6">
        <h1 className="text-2xl font-bold text-white mb-6">Create League</h1>

        {/* League Type Selection */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          <button
            type="button"
            onClick={() => setType("single")}
            className={`card p-4 text-center transition-all ${
              type === "single"
                ? "border-[#e94560] bg-[#e94560]/10"
                : "hover:border-[#1e3a5f]"
            }`}
          >
            <div className="text-2xl mb-2">&#9889;</div>
            <h3 className="font-semibold text-white text-sm">Single Game</h3>
            <p className="text-xs text-[#a0a0b8] mt-1">Quick one-off</p>
          </button>
          <button
            type="button"
            onClick={() => setType("season")}
            className={`card p-4 text-center transition-all ${
              type === "season"
                ? "border-[#e94560] bg-[#e94560]/10"
                : "hover:border-[#1e3a5f]"
            }`}
          >
            <div className="text-2xl mb-2">&#127942;</div>
            <h3 className="font-semibold text-white text-sm">League Seasons</h3>
            <p className="text-xs text-[#a0a0b8] mt-1">Ongoing competition</p>
          </button>
        </div>

        {isDev && (
          <button
            type="button"
            onClick={() => setType("test")}
            className={`w-full card p-3 text-center mb-6 transition-all ${
              type === "test"
                ? "border-purple-500 bg-purple-500/10"
                : "hover:border-[#1e3a5f]"
            }`}
          >
            <span className="text-purple-400 font-semibold text-sm">
              &#128736; Test Mode (Dev Only)
            </span>
            <span className="text-xs text-[#666680] ml-2">
              Create fake players, test all features
            </span>
          </button>
        )}

        <form onSubmit={handleCreate} className="space-y-5">
          {/* League Name */}
          <div>
            <label className="block text-sm font-medium text-[#a0a0b8] mb-1.5">
              League Name *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="input-field"
              placeholder="Enter league name"
              maxLength={50}
            />
            {suggestions.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {suggestions.map((s, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setName(s)}
                    className="text-xs bg-[#1e3a5f] text-[#a0a0b8] px-2.5 py-1 rounded-full hover:bg-[#254a73] hover:text-white transition-colors"
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Max Players */}
          <div>
            <label className="block text-sm font-medium text-[#a0a0b8] mb-1.5">
              Max Players: {maxPlayers}
            </label>
            <input
              type="range"
              min={2}
              max={10}
              value={maxPlayers}
              onChange={(e) => setMaxPlayers(Number(e.target.value))}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-[#666680]">
              <span>2</span>
              <span>10</span>
            </div>
          </div>

          {/* Advanced Settings */}
          <button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="text-sm text-[#a0a0b8] hover:text-white flex items-center gap-1"
          >
            <svg
              className={`w-4 h-4 transition-transform ${showAdvanced ? "rotate-90" : ""}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 5l7 7-7 7"
              />
            </svg>
            Advanced Settings
          </button>

          {showAdvanced && (
            <div className="space-y-4 card p-4">
              {type !== "single" && (
                <div>
                  <label className="block text-sm font-medium text-[#a0a0b8] mb-1">
                    Games per Season
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={50}
                    value={gamesPerSeason}
                    onChange={(e) => setGamesPerSeason(Number(e.target.value))}
                    className="input-field"
                  />
                </div>
              )}
              <div className="card p-3 bg-[#0f0f23]/50">
                <p className="text-xs text-[#a0a0b8]">
                  Rounds per game = number of players (each player bats once)
                </p>
              </div>
            </div>
          )}

          {error && (
            <div className="text-red-400 text-sm bg-red-500/10 rounded-lg p-3">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={creating}
            className="btn-primary w-full"
          >
            {creating ? "Creating..." : "Create League"}
          </button>
        </form>
      </div>
    </div>
  );
}

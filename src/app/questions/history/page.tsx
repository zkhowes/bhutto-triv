"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import NavBar from "@/components/layout/NavBar";
import Link from "next/link";
import Avatar from "@/components/ui/Avatar";
import StarRating from "@/components/ui/StarRating";

interface PlayerResult {
  name: string;
  avatarUrl: string | null;
  isCorrect: boolean | null;
  isAbsent: boolean;
  pointsWon: number;
  cheatSeekerHeat: string | null;
  questionRating: number | null;
}

interface HistoryEntry {
  roundId: string;
  roundNumber: number;
  gameNumber: number;
  seasonNumber: number;
  leagueName: string;
  leagueId: string;
  question: {
    category: string;
    questionText: string;
    answerFormat: string;
    correctOption: string | null;
    correctAnswer: string | null;
  };
  avgRating: number | null;
  successRate: number | null;
  createdAt: string;
  playerResults: PlayerResult[];
}

export default function QuestionHistoryPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/");
    if (status === "authenticated") {
      fetch("/api/questions/history")
        .then((r) => r.json())
        .then((d) => setHistory(d.history || []))
        .catch(() => {})
        .finally(() => setLoading(false));
    }
  }, [status, router]);

  if (status === "loading" || loading) {
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
      <div className="max-w-4xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white">Past Questions</h1>
            <p className="text-sm text-[#a0a0b8]">
              Questions you&apos;ve submitted and how players did
            </p>
          </div>
          <Link href="/questions/workshop" className="btn-secondary text-sm">
            Workshop
          </Link>
        </div>

        {history.length === 0 ? (
          <div className="card p-8 text-center">
            <p className="text-[#a0a0b8]">
              No past questions yet. Submit a question when you&apos;re up!
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {history.map((entry) => {
              const isExpanded = expandedId === entry.roundId;
              return (
                <div key={entry.roundId} className="card overflow-hidden">
                  <button
                    onClick={() => setExpandedId(isExpanded ? null : entry.roundId)}
                    className="w-full text-left p-4 hover:bg-[#1e3a5f]/20 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-white font-medium text-sm truncate">
                          {entry.question.questionText}
                        </p>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          <span className="text-xs text-[#fbbf24]">
                            {entry.question.category}
                          </span>
                          <span className="text-xs text-[#666680]">
                            {entry.leagueName} &middot; S{entry.seasonNumber}G{entry.gameNumber}R{entry.roundNumber}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 flex-shrink-0">
                        {entry.avgRating != null && (
                          <StarRating value={entry.avgRating} size="sm" />
                        )}
                        {entry.successRate != null && (
                          <span className={`text-xs font-medium ${
                            entry.successRate > 0.7 ? "text-emerald-400" :
                            entry.successRate > 0.3 ? "text-amber-400" : "text-red-400"
                          }`}>
                            {Math.round(entry.successRate * 100)}%
                          </span>
                        )}
                        <span className="text-[#666680] text-sm">
                          {isExpanded ? "\u25B2" : "\u25BC"}
                        </span>
                      </div>
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="border-t border-[#1e3a5f] px-4 pb-4 pt-3">
                      <div className="mb-3">
                        <p className="text-xs text-[#a0a0b8]">
                          Answer: <span className="text-emerald-400">{entry.question.correctAnswer || entry.question.correctOption}</span>
                        </p>
                      </div>
                      <div className="space-y-1.5">
                        {entry.playerResults.map((pr, i) => (
                          <div
                            key={i}
                            className="flex items-center gap-2 py-1.5 px-2 rounded-lg hover:bg-[#0f0f23]/50"
                          >
                            <Avatar
                              src={pr.avatarUrl}
                              name={pr.name}
                              size="sm"
                            />
                            <span className="flex-1 text-white text-sm">{pr.name}</span>
                            {pr.isAbsent ? (
                              <span className="text-xs text-gray-500">Absent</span>
                            ) : (
                              <span className={`text-sm font-medium ${
                                pr.isCorrect ? "text-emerald-400" : "text-red-400"
                              }`}>
                                {pr.isCorrect ? "\u2713" : "\u2717"}
                              </span>
                            )}
                            {pr.pointsWon !== 0 && (
                              <span className={`text-xs ${pr.pointsWon > 0 ? "text-emerald-400" : "text-red-400"}`}>
                                {pr.pointsWon > 0 ? "+" : ""}{pr.pointsWon}
                              </span>
                            )}
                            {pr.cheatSeekerHeat && (
                              <span className={`text-xs ${
                                pr.cheatSeekerHeat === "On Fire" ? "text-red-400" :
                                pr.cheatSeekerHeat === "Hot" ? "text-orange-400" : "text-amber-400"
                              }`}>
                                {pr.cheatSeekerHeat === "On Fire" ? "\uD83D\uDD25" : ""} {pr.cheatSeekerHeat}
                              </span>
                            )}
                            {pr.questionRating != null && (
                              <StarRating value={pr.questionRating} size="sm" />
                            )}
                          </div>
                        ))}
                      </div>
                      <div className="mt-3 text-right">
                        <Link
                          href={`/rounds/${entry.roundId}`}
                          className="text-xs text-[#4fc3f7] hover:text-white"
                        >
                          View full round
                        </Link>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

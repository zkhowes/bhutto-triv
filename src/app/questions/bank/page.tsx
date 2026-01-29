"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import NavBar from "@/components/layout/NavBar";

interface Draft {
  id: string;
  category: string | null;
  questionText: string | null;
  answerFormat: string | null;
  useOnNextRound: boolean;
  createdAt: string;
  updatedAt: string;
}

export default function QuestionBankPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/");
  }, [status, router]);

  useEffect(() => {
    if (session?.user) {
      fetch("/api/questions/drafts")
        .then((r) => r.json())
        .then((data) => {
          setDrafts(Array.isArray(data) ? data : []);
          setLoading(false);
        })
        .catch(() => setLoading(false));
    }
  }, [session]);

  const deleteDraft = async (id: string) => {
    await fetch(`/api/questions/drafts?id=${id}`, { method: "DELETE" });
    setDrafts(drafts.filter((d) => d.id !== id));
  };

  const toggleAutoSubmit = async (id: string, current: boolean) => {
    await fetch("/api/questions/drafts", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, useOnNextRound: !current }),
    });
    setDrafts(
      drafts.map((d) =>
        d.id === id ? { ...d, useOnNextRound: !current } : d
      )
    );
  };

  return (
    <div className="min-h-screen">
      <NavBar />
      <div className="max-w-3xl mx-auto px-4 py-6">
        <h1 className="text-xl font-bold text-white mb-1">Question Bank</h1>
        <p className="text-sm text-[#a0a0b8] mb-6">
          Your saved drafts and banked questions
        </p>

        {loading ? (
          <div className="text-center py-10 animate-pulse text-[#e94560]">
            Loading...
          </div>
        ) : drafts.length === 0 ? (
          <div className="card p-8 text-center">
            <p className="text-[#666680] mb-3">No saved questions yet.</p>
            <button
              onClick={() => router.push("/questions/workshop")}
              className="btn-primary"
            >
              Go to Workshop
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {drafts.map((draft) => (
              <div key={draft.id} className="card p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    {draft.category && (
                      <span className="badge bg-[#1e3a5f] text-[#a0a0b8] mb-2">
                        {draft.category}
                      </span>
                    )}
                    <p className="text-white text-sm mt-1">
                      {draft.questionText || "Untitled draft"}
                    </p>
                    <p className="text-xs text-[#666680] mt-1">
                      {draft.answerFormat === "multiple_choice"
                        ? "Multiple Choice"
                        : draft.answerFormat === "free_text"
                          ? "Free Text"
                          : "Format not set"}
                      {" \u00b7 "}
                      {new Date(draft.updatedAt).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 ml-4">
                    <button
                      onClick={() =>
                        toggleAutoSubmit(draft.id, draft.useOnNextRound)
                      }
                      className={`text-xs px-2 py-1 rounded ${
                        draft.useOnNextRound
                          ? "bg-emerald-500/20 text-emerald-400"
                          : "bg-[#1e3a5f] text-[#a0a0b8]"
                      }`}
                    >
                      {draft.useOnNextRound ? "Auto-submit ON" : "Auto-submit"}
                    </button>
                    <button
                      onClick={() => deleteDraft(draft.id)}
                      className="text-xs text-red-400 hover:text-red-300"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

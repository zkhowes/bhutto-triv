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
  optionA: string | null;
  optionB: string | null;
  optionC: string | null;
  optionD: string | null;
  correctOption: string | null;
  correctAnswer: string | null;
  useOnNextRound: boolean;
  createdAt: string;
  updatedAt: string;
}

export default function QuestionBankPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [loading, setLoading] = useState(true);
  const [formatting, setFormatting] = useState<string | null>(null);

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
    const draft = drafts.find((d) => d.id === id);
    // Warn if toggling on without structured fields
    if (!current && draft && !draft.category && !draft.answerFormat) {
      if (!confirm("This draft hasn't been formatted into a structured question yet. Auto-submit may not work correctly. Continue?")) {
        return;
      }
    }

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

  const formatQuestion = async (id: string) => {
    const draft = drafts.find((d) => d.id === id);
    if (!draft?.questionText) return;

    setFormatting(id);
    try {
      const res = await fetch("/api/questions/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: draft.questionText }),
      });

      if (!res.ok) {
        alert("Could not parse this text into a structured question.");
        return;
      }

      const parsed = await res.json();

      // Update the draft with parsed data
      await fetch("/api/questions/drafts", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id,
          category: parsed.category,
          questionText: parsed.questionText,
          answerFormat: parsed.answerFormat,
          optionA: parsed.optionA || null,
          optionB: parsed.optionB || null,
          optionC: parsed.optionC || null,
          optionD: parsed.optionD || null,
          correctOption: parsed.correctOption || null,
          correctAnswer: parsed.correctAnswer || null,
        }),
      });

      // Update local state
      setDrafts(
        drafts.map((d) =>
          d.id === id
            ? {
                ...d,
                category: parsed.category,
                questionText: parsed.questionText,
                answerFormat: parsed.answerFormat,
                optionA: parsed.optionA || null,
                optionB: parsed.optionB || null,
                optionC: parsed.optionC || null,
                optionD: parsed.optionD || null,
                correctOption: parsed.correctOption || null,
                correctAnswer: parsed.correctAnswer || null,
              }
            : d
        )
      );
    } catch {
      alert("Failed to format question");
    } finally {
      setFormatting(null);
    }
  };

  const isStructured = (draft: Draft) =>
    !!(draft.category && draft.answerFormat);

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
                    <div className="flex items-center gap-2 mb-1">
                      {draft.category && (
                        <span className="badge bg-[#1e3a5f] text-[#a0a0b8]">
                          {draft.category}
                        </span>
                      )}
                      {isStructured(draft) && (
                        <span className="badge bg-emerald-500/20 text-emerald-400 text-[10px]">
                          Formatted
                        </span>
                      )}
                    </div>
                    <p className="text-white text-sm mt-1">
                      {draft.questionText || "Untitled draft"}
                    </p>
                    {/* Show options preview for MC */}
                    {draft.answerFormat === "multiple_choice" && draft.optionA && (
                      <div className="mt-2 text-xs text-[#a0a0b8] space-y-0.5">
                        {[
                          { key: "A", val: draft.optionA },
                          { key: "B", val: draft.optionB },
                          { key: "C", val: draft.optionC },
                          { key: "D", val: draft.optionD },
                        ].map(
                          (opt) =>
                            opt.val && (
                              <p key={opt.key}>
                                <span
                                  className={
                                    draft.correctOption === opt.key
                                      ? "text-emerald-400 font-bold"
                                      : ""
                                  }
                                >
                                  {opt.key}.
                                </span>{" "}
                                {opt.val}
                              </p>
                            )
                        )}
                      </div>
                    )}
                    {draft.answerFormat === "free_text" && draft.correctAnswer && (
                      <p className="mt-1 text-xs text-emerald-400">
                        Answer: {draft.correctAnswer}
                      </p>
                    )}
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
                  <div className="flex items-center gap-2 ml-4 flex-shrink-0">
                    {!isStructured(draft) && (
                      <button
                        onClick={() => formatQuestion(draft.id)}
                        disabled={formatting === draft.id}
                        className="text-xs px-2 py-1 rounded bg-purple-500/20 text-purple-400 hover:bg-purple-500/30"
                      >
                        {formatting === draft.id ? "..." : "Format"}
                      </button>
                    )}
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

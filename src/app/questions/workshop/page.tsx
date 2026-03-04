"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState, useEffect, useCallback } from "react";
import NavBar from "@/components/layout/NavBar";
import QuestionPreviewCard from "@/components/question/QuestionPreviewCard";
import Avatar from "@/components/ui/Avatar";
import StarRating from "@/components/ui/StarRating";
import type { WorkshopVariation, WorkshopResponse } from "@/lib/ai";

// ─── Types ────────────────────────────────────────────────────────────────────

type WorkshopState =
  | "idle"
  | "loading"
  | "viewing_cards"
  | "selected"
  | "editing";

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
  acceptableAnswers: string | null;
  useOnNextRound: boolean;
  updatedAt: string;
}

interface PastPlayerResult {
  name: string;
  avatarUrl: string | null;
  isCorrect: boolean | null;
  isAbsent: boolean;
  pointsWon: number;
  selectedOption: string | null;
  freeTextAnswer: string | null;
  betAmount: number | null;
  placement: number | null;
  fastestLap: boolean;
  gradedBy: string | null;
  powerUpType: string | null;
  powerUpCost: number;
  cheatSeekerData: string | null;
  questionRating: number | null;
}

interface PastQuestion {
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
    optionA: string | null;
    optionB: string | null;
    optionC: string | null;
    optionD: string | null;
  };
  avgRating: number | null;
  successRate: number | null;
  createdAt: string;
  playerResults: PastPlayerResult[];
}

type BankFilter = "all" | "drafts" | "past";

const SUGGESTION_CHIPS = [
  "Geography challenge",
  "Obscure history",
  "Sports stats",
  "Science stumper",
  "Pop culture",
  "Food & Drink",
];

const EDIT_CHIPS = [
  "Make Harder",
  "Make Easier",
  "Change to MC",
  "Change to Free Text",
  "Change to PiR",
  "Different Angle",
];

// ─── Helper: convert draft to WorkshopVariation ──────────────────────────────

function draftToVariation(draft: Draft): WorkshopVariation {
  let acceptableAnswers: string[] = [];
  if (draft.acceptableAnswers) {
    try {
      const arr = JSON.parse(draft.acceptableAnswers);
      if (Array.isArray(arr)) acceptableAnswers = arr;
    } catch {
      // ignore
    }
  }
  return {
    category: draft.category || "General Knowledge",
    questionText: draft.questionText || "",
    answerFormat: (draft.answerFormat as WorkshopVariation["answerFormat"]) || "multiple_choice",
    optionA: draft.optionA || undefined,
    optionB: draft.optionB || undefined,
    optionC: draft.optionC || undefined,
    optionD: draft.optionD || undefined,
    correctOption: draft.correctOption || undefined,
    correctAnswer: draft.correctAnswer || undefined,
    acceptableAnswers,
    difficulty: "medium",
    hook: "",
  };
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function WorkshopPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  // Workshop state machine
  const [workshopState, setWorkshopState] = useState<WorkshopState>("idle");
  const [input, setInput] = useState("");
  const [lastPrompt, setLastPrompt] = useState("");
  const [variations, setVariations] = useState<WorkshopVariation[]>([]);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [conversationText, setConversationText] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedFeedback, setSavedFeedback] = useState(false);

  // Edit state
  const [editInput, setEditInput] = useState("");

  // Bank state
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [draftsLoading, setDraftsLoading] = useState(true);
  const [editingDraftId, setEditingDraftId] = useState<string | null>(null);
  const [draftEditInput, setDraftEditInput] = useState("");
  const [draftEditLoading, setDraftEditLoading] = useState(false);
  const [draftVariations, setDraftVariations] = useState<WorkshopVariation[]>([]);
  const [draftSelectedIdx, setDraftSelectedIdx] = useState<number | null>(null);
  const [draftSaving, setDraftSaving] = useState(false);
  const [deletingDraftId, setDeletingDraftId] = useState<string | null>(null);

  // Past questions state
  const [pastQuestions, setPastQuestions] = useState<PastQuestion[]>([]);
  const [pastLoading, setPastLoading] = useState(true);
  const [expandedPastId, setExpandedPastId] = useState<string | null>(null);
  const [savingPastId, setSavingPastId] = useState<string | null>(null);

  // Filter state
  const [bankFilter, setBankFilter] = useState<BankFilter>("all");

  useEffect(() => {
    if (status === "unauthenticated") router.push("/");
  }, [status, router]);

  const loadDrafts = useCallback(async () => {
    try {
      const r = await fetch("/api/questions/drafts");
      const data = await r.json();
      setDrafts(Array.isArray(data) ? data : []);
    } finally {
      setDraftsLoading(false);
    }
  }, []);

  const loadPastQuestions = useCallback(async () => {
    try {
      const r = await fetch("/api/questions/history");
      const data = await r.json();
      setPastQuestions(Array.isArray(data.history) ? data.history : []);
    } finally {
      setPastLoading(false);
    }
  }, []);

  useEffect(() => {
    if (session?.user) {
      loadDrafts();
      loadPastQuestions();
    }
  }, [session, loadDrafts, loadPastQuestions]);

  // ── Workshop actions ───────────────────────────────────────────────────────

  const handlePrompt = async (prompt: string) => {
    if (!prompt.trim()) return;
    setWorkshopState("loading");
    setLastPrompt(prompt);
    setInput("");
    setSelectedIdx(null);
    setConversationText(null);
    setVariations([]);

    try {
      const res = await fetch("/api/questions/workshop", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });
      const data: WorkshopResponse = await res.json();

      if (data.type === "questions" && data.variations?.length) {
        setVariations(data.variations);
        setWorkshopState("viewing_cards");
      } else {
        setConversationText(data.text || "No response from AI.");
        setWorkshopState("idle");
      }
    } catch {
      setConversationText("Something went wrong. Try again.");
      setWorkshopState("idle");
    }
  };

  const handleSelectCard = (idx: number) => {
    setSelectedIdx(idx);
    setWorkshopState("selected");
  };

  const handleEditFurther = () => {
    setEditInput("");
    setWorkshopState("editing");
  };

  const handleEditSubmit = async (instruction: string) => {
    if (!instruction.trim() || selectedIdx === null) return;
    const question = variations[selectedIdx];
    setWorkshopState("loading");
    setSelectedIdx(null);

    try {
      const res = await fetch("/api/questions/workshop/edit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, instruction }),
      });
      const data: WorkshopResponse = await res.json();

      if (data.type === "questions" && data.variations?.length) {
        setVariations(data.variations);
        setWorkshopState("viewing_cards");
      } else {
        setConversationText(data.text || "No response from AI.");
        setWorkshopState("idle");
      }
    } catch {
      setConversationText("Something went wrong. Try again.");
      setWorkshopState("idle");
    }
  };

  const handleSaveToBank = async (autoSubmit: boolean = false) => {
    if (selectedIdx === null) return;
    const v = variations[selectedIdx];
    setSaving(true);

    try {
      const body: Record<string, unknown> = {
        category: v.category,
        questionText: v.questionText,
        answerFormat: v.answerFormat,
        useOnNextRound: autoSubmit,
      };
      if (v.answerFormat === "multiple_choice") {
        body.optionA = v.optionA;
        body.optionB = v.optionB;
        body.optionC = v.optionC;
        body.optionD = v.optionD;
        body.correctOption = v.correctOption;
      } else {
        body.correctAnswer = v.correctAnswer;
        if (v.acceptableAnswers?.length) {
          body.acceptableAnswers = v.acceptableAnswers;
        }
      }

      await fetch("/api/questions/drafts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      setSavedFeedback(true);
      await loadDrafts();
      setTimeout(() => {
        setSavedFeedback(false);
        setWorkshopState("idle");
        setVariations([]);
        setSelectedIdx(null);
      }, 1500);
    } finally {
      setSaving(false);
    }
  };

  const handleStartOver = () => {
    setWorkshopState("idle");
    setVariations([]);
    setSelectedIdx(null);
    setConversationText(null);
  };

  // ── Bank actions ───────────────────────────────────────────────────────────

  const toggleAutoSubmit = async (id: string, current: boolean) => {
    await fetch("/api/questions/drafts", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, useOnNextRound: !current }),
    });
    setDrafts((prev) =>
      prev.map((d) => (d.id === id ? { ...d, useOnNextRound: !current } : d))
    );
  };

  const deleteDraft = async (id: string) => {
    setDeletingDraftId(id);
    await fetch(`/api/questions/drafts?id=${id}`, { method: "DELETE" });
    setDrafts((prev) => prev.filter((d) => d.id !== id));
    if (editingDraftId === id) {
      setEditingDraftId(null);
      setDraftVariations([]);
    }
    setDeletingDraftId(null);
  };

  const startDraftEdit = (draft: Draft) => {
    setEditingDraftId(draft.id);
    setDraftEditInput("");
    setDraftVariations([]);
    setDraftSelectedIdx(null);
  };

  const handleDraftEditSubmit = async (draftId: string, instruction: string) => {
    if (!instruction.trim()) return;
    const draft = drafts.find((d) => d.id === draftId);
    if (!draft) return;

    setDraftEditLoading(true);
    setDraftSelectedIdx(null);

    try {
      const question = draftToVariation(draft);
      const res = await fetch("/api/questions/workshop/edit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, instruction }),
      });
      const data: WorkshopResponse = await res.json();

      if (data.type === "questions" && data.variations?.length) {
        setDraftVariations(data.variations);
      }
    } finally {
      setDraftEditLoading(false);
    }
  };

  const saveDraftVariation = async (draftId: string) => {
    if (draftSelectedIdx === null) return;
    const v = draftVariations[draftSelectedIdx];
    setDraftSaving(true);

    try {
      const body: Record<string, unknown> = {
        id: draftId,
        category: v.category,
        questionText: v.questionText,
        answerFormat: v.answerFormat,
      };
      if (v.answerFormat === "multiple_choice") {
        body.optionA = v.optionA;
        body.optionB = v.optionB;
        body.optionC = v.optionC;
        body.optionD = v.optionD;
        body.correctOption = v.correctOption;
      } else {
        body.correctAnswer = v.correctAnswer;
        if (v.acceptableAnswers?.length) {
          body.acceptableAnswers = v.acceptableAnswers;
        }
      }

      await fetch("/api/questions/drafts", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      await loadDrafts();
      setEditingDraftId(null);
      setDraftVariations([]);
      setDraftSelectedIdx(null);
    } finally {
      setDraftSaving(false);
    }
  };

  // ── Past question actions ──────────────────────────────────────────────────

  const savePastToBank = async (pq: PastQuestion) => {
    setSavingPastId(pq.roundId);
    try {
      const body: Record<string, unknown> = {
        category: pq.question.category,
        questionText: pq.question.questionText,
        answerFormat: pq.question.answerFormat,
      };
      if (pq.question.answerFormat === "multiple_choice") {
        body.optionA = pq.question.optionA;
        body.optionB = pq.question.optionB;
        body.optionC = pq.question.optionC;
        body.optionD = pq.question.optionD;
        body.correctOption = pq.question.correctOption;
      } else {
        body.correctAnswer = pq.question.correctAnswer;
      }

      await fetch("/api/questions/drafts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      await loadDrafts();
    } finally {
      setSavingPastId(null);
    }
  };

  const getOptionText = (q: PastQuestion["question"], key: string | null): string => {
    if (!key) return "";
    const map: Record<string, string | null> = {
      A: q.optionA,
      B: q.optionB,
      C: q.optionC,
      D: q.optionD,
    };
    return map[key] || key;
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  const bankLoading = draftsLoading || pastLoading;
  const totalCount = drafts.length + pastQuestions.length;

  return (
    <div className="min-h-screen">
      <NavBar />
      <div className="max-w-3xl mx-auto px-4 py-6 space-y-10">
        {/* ── Workshop ── */}
        <section>
          <div className="mb-1">
            <h1 className="text-xl font-bold text-white">
              Question Workshop
            </h1>
          </div>
          <p className="text-sm text-[#a0a0b8] mb-4">
            Tell the AI what kind of question you want and pick from 3 creative
            variations
          </p>

          {/* IDLE state */}
          {workshopState === "idle" && (
            <div className="space-y-4">
              {conversationText && (
                <div className="card p-4 text-sm text-[#e8e8e8]">
                  <p className="whitespace-pre-wrap">{conversationText}</p>
                </div>
              )}

              <div className="flex gap-2">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handlePrompt(input);
                  }}
                  className="input-field flex-1"
                  placeholder="What kind of question do you want?"
                />
                <button
                  onClick={() => handlePrompt(input)}
                  disabled={!input.trim()}
                  className="btn-primary"
                >
                  Go
                </button>
              </div>

              <div className="flex flex-wrap gap-2">
                {SUGGESTION_CHIPS.map((chip) => (
                  <button
                    key={chip}
                    onClick={() => handlePrompt(chip)}
                    className="text-xs px-3 py-1.5 rounded-full bg-[#1e3a5f] text-[#a0a0b8] hover:text-white hover:bg-[#254a73] transition-all"
                  >
                    {chip}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* LOADING state */}
          {workshopState === "loading" && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="rounded-xl border border-[#1e3a5f] bg-[#16162a] p-3 animate-pulse"
                >
                  <div className="h-3 w-16 bg-[#1e3a5f] rounded mb-3" />
                  <div className="h-4 w-3/4 bg-[#1e3a5f] rounded mb-2" />
                  <div className="h-4 w-1/2 bg-[#1e3a5f] rounded mb-4" />
                  <div className="space-y-2">
                    <div className="h-7 bg-[#0f0f23] rounded" />
                    <div className="h-7 bg-[#0f0f23] rounded" />
                    <div className="h-7 bg-[#0f0f23] rounded" />
                    <div className="h-7 bg-[#0f0f23] rounded" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* VIEWING_CARDS state */}
          {workshopState === "viewing_cards" && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {variations.map((v, i) => (
                  <QuestionPreviewCard
                    key={i}
                    category={v.category}
                    questionText={v.questionText}
                    answerFormat={v.answerFormat}
                    optionA={v.optionA}
                    optionB={v.optionB}
                    optionC={v.optionC}
                    optionD={v.optionD}
                    correctOption={v.correctOption}
                    correctAnswer={v.correctAnswer}
                    difficulty={v.difficulty}
                    hook={v.hook}
                    compact
                    onSelect={() => handleSelectCard(i)}
                  />
                ))}
              </div>
              <div className="flex gap-2 justify-center">
                <button
                  onClick={() => handlePrompt(lastPrompt)}
                  className="text-sm px-3 py-1.5 rounded-full bg-[#1e3a5f] text-[#a0a0b8] hover:text-white hover:bg-[#254a73] transition-all flex items-center gap-1.5"
                  title="Regenerate"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                  New set
                </button>
                <button
                  onClick={handleStartOver}
                  className="text-sm px-3 py-1.5 rounded-full text-[#666680] hover:text-[#a0a0b8] transition-all"
                >
                  Start Over
                </button>
              </div>
            </div>
          )}

          {/* SELECTED state */}
          {workshopState === "selected" && selectedIdx !== null && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {variations.map((v, i) => (
                  <div
                    key={i}
                    className={`transition-opacity ${
                      i !== selectedIdx ? "opacity-40" : ""
                    }`}
                  >
                    <QuestionPreviewCard
                      category={v.category}
                      questionText={v.questionText}
                      answerFormat={v.answerFormat}
                      optionA={v.optionA}
                      optionB={v.optionB}
                      optionC={v.optionC}
                      optionD={v.optionD}
                      correctOption={v.correctOption}
                      correctAnswer={v.correctAnswer}
                      difficulty={v.difficulty}
                      hook={v.hook}
                      selected={i === selectedIdx}
                      compact
                      onSelect={() => handleSelectCard(i)}
                    />
                  </div>
                ))}
              </div>

              {savedFeedback ? (
                <div className="text-center text-emerald-400 font-semibold py-3">
                  Saved to Bank!
                </div>
              ) : (
                <div className="flex gap-2 justify-center">
                  <button
                    onClick={() => handlePrompt(lastPrompt)}
                    className="text-sm px-3 py-1.5 rounded-full bg-[#1e3a5f] text-[#a0a0b8] hover:text-white hover:bg-[#254a73] transition-all flex items-center gap-1.5"
                    title="Regenerate all"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                    New set
                  </button>
                  <button
                    onClick={() => handleSaveToBank(false)}
                    disabled={saving}
                    className="btn-primary text-sm"
                  >
                    {saving ? "Saving..." : "Add to Bank"}
                  </button>
                  <button
                    onClick={handleEditFurther}
                    className="btn-secondary text-sm"
                  >
                    Edit Further
                  </button>
                </div>
              )}
            </div>
          )}

          {/* EDITING state */}
          {workshopState === "editing" && selectedIdx !== null && (
            <div className="space-y-4">
              <div className="max-w-md mx-auto">
                <QuestionPreviewCard
                  {...variations[selectedIdx]}
                  selected
                  compact
                />
              </div>

              <div className="flex flex-wrap gap-2 justify-center">
                {EDIT_CHIPS.map((chip) => (
                  <button
                    key={chip}
                    onClick={() => handleEditSubmit(chip)}
                    className="text-xs px-3 py-1.5 rounded-full bg-[#1e3a5f] text-[#a0a0b8] hover:text-white hover:bg-[#254a73] transition-all"
                  >
                    {chip}
                  </button>
                ))}
              </div>

              <div className="flex gap-2">
                <input
                  type="text"
                  value={editInput}
                  onChange={(e) => setEditInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && editInput.trim())
                      handleEditSubmit(editInput);
                  }}
                  className="input-field flex-1"
                  placeholder="Or type a custom request..."
                />
                <button
                  onClick={() => handleEditSubmit(editInput)}
                  disabled={!editInput.trim()}
                  className="btn-primary"
                >
                  Go
                </button>
              </div>

              <button
                onClick={() => setWorkshopState("selected")}
                className="text-sm text-[#a0a0b8] hover:text-white w-full text-center"
              >
                Back to selection
              </button>
            </div>
          )}
        </section>

        {/* ── Question Bank ── */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-bold text-white">Question Bank</h2>
              <p className="text-sm text-[#a0a0b8]">
                Saved questions and past rounds
              </p>
            </div>
            {!bankLoading && totalCount > 0 && (
              <span className="text-sm text-[#666680]">
                {totalCount} question{totalCount !== 1 ? "s" : ""}
              </span>
            )}
          </div>

          {/* Filter tabs */}
          {!bankLoading && totalCount > 0 && (
            <div className="flex gap-2 mb-4">
              {(["all", "drafts", "past"] as BankFilter[]).map((f) => (
                <button
                  key={f}
                  onClick={() => setBankFilter(f)}
                  className={`text-xs px-3 py-1.5 rounded-full transition-all ${
                    bankFilter === f
                      ? "bg-[#e94560]/20 text-[#e94560] font-bold"
                      : "bg-[#1e3a5f] text-[#a0a0b8] hover:text-white"
                  }`}
                >
                  {f === "all" ? "All" : f === "drafts" ? `Drafts (${drafts.length})` : `Past (${pastQuestions.length})`}
                </button>
              ))}
            </div>
          )}

          {bankLoading ? (
            <div className="card p-8 text-center animate-pulse text-[#e94560]">
              Loading...
            </div>
          ) : totalCount === 0 ? (
            <div className="card p-8 text-center text-[#666680]">
              <p>No saved questions yet. Use the workshop above to create some!</p>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Draft questions */}
              {(bankFilter === "all" || bankFilter === "drafts") && drafts.map((draft) => {
                const isEditing = editingDraftId === draft.id;

                return (
                  <div key={draft.id} className="space-y-3">
                    {/* Card preview */}
                    <div className="relative">
                      <QuestionPreviewCard
                        category={draft.category || "General Knowledge"}
                        questionText={draft.questionText || "Untitled draft"}
                        answerFormat={
                          (draft.answerFormat as WorkshopVariation["answerFormat"]) ||
                          "multiple_choice"
                        }
                        optionA={draft.optionA || undefined}
                        optionB={draft.optionB || undefined}
                        optionC={draft.optionC || undefined}
                        optionD={draft.optionD || undefined}
                        correctOption={draft.correctOption || undefined}
                        correctAnswer={draft.correctAnswer || undefined}
                        difficulty="medium"
                        hook=""
                        compact
                      />

                      {/* Overlay badges and actions */}
                      <div className="absolute top-3 right-3 flex items-center gap-1.5">
                        {draft.useOnNextRound && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[#e94560]/20 text-[#e94560]">
                            Auto ON
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Action buttons */}
                    <div className="flex gap-2 px-1">
                      <button
                        onClick={() => toggleAutoSubmit(draft.id, draft.useOnNextRound)}
                        className={`text-xs px-2 py-1 rounded transition-all ${
                          draft.useOnNextRound
                            ? "bg-[#e94560]/20 text-[#e94560]"
                            : "bg-[#1e3a5f] text-[#a0a0b8] hover:text-white"
                        }`}
                      >
                        {draft.useOnNextRound ? "Auto ON" : "Auto"}
                      </button>
                      <button
                        onClick={() =>
                          isEditing
                            ? setEditingDraftId(null)
                            : startDraftEdit(draft)
                        }
                        className="text-xs px-2 py-1 rounded bg-[#1e3a5f] text-[#a0a0b8] hover:text-white"
                      >
                        {isEditing ? "Done" : "Edit"}
                      </button>
                      <button
                        onClick={() => deleteDraft(draft.id)}
                        disabled={deletingDraftId === draft.id}
                        className="text-xs text-red-400 hover:text-red-300"
                      >
                        {deletingDraftId === draft.id ? "..." : "Delete"}
                      </button>
                    </div>

                    {/* Edit panel */}
                    {isEditing && (
                      <div className="card p-4 space-y-3">
                        {/* Quick action chips */}
                        <div className="flex flex-wrap gap-2">
                          {EDIT_CHIPS.map((chip) => (
                            <button
                              key={chip}
                              onClick={() => {
                                setDraftEditInput(chip);
                                handleDraftEditSubmit(draft.id, chip);
                              }}
                              disabled={draftEditLoading}
                              className="text-xs px-3 py-1.5 rounded-full bg-[#1e3a5f] text-[#a0a0b8] hover:text-white hover:bg-[#254a73] transition-all disabled:opacity-50"
                            >
                              {chip}
                            </button>
                          ))}
                        </div>

                        {/* Custom edit input */}
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={draftEditInput}
                            onChange={(e) => setDraftEditInput(e.target.value)}
                            onKeyDown={(e) => {
                              if (
                                e.key === "Enter" &&
                                draftEditInput.trim() &&
                                !draftEditLoading
                              )
                                handleDraftEditSubmit(draft.id, draftEditInput);
                            }}
                            className="input-field flex-1 text-sm"
                            placeholder="Or type a custom request..."
                          />
                          <button
                            onClick={() =>
                              handleDraftEditSubmit(draft.id, draftEditInput)
                            }
                            disabled={
                              draftEditLoading || !draftEditInput.trim()
                            }
                            className="btn-primary text-sm"
                          >
                            {draftEditLoading ? "..." : "Go"}
                          </button>
                        </div>

                        {/* AI edit results */}
                        {draftEditLoading && (
                          <div className="text-sm text-[#666680] animate-pulse text-center py-4">
                            Generating variations...
                          </div>
                        )}

                        {draftVariations.length > 0 && (
                          <div className="space-y-3">
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                              {draftVariations.map((v, i) => (
                                <div
                                  key={i}
                                  className={`transition-opacity ${
                                    draftSelectedIdx !== null &&
                                    i !== draftSelectedIdx
                                      ? "opacity-40"
                                      : ""
                                  }`}
                                >
                                  <QuestionPreviewCard
                                    category={v.category}
                                    questionText={v.questionText}
                                    answerFormat={v.answerFormat}
                                    optionA={v.optionA}
                                    optionB={v.optionB}
                                    optionC={v.optionC}
                                    optionD={v.optionD}
                                    correctOption={v.correctOption}
                                    correctAnswer={v.correctAnswer}
                                    difficulty={v.difficulty}
                                    hook={v.hook}
                                    selected={draftSelectedIdx === i}
                                    compact
                                    onSelect={() => setDraftSelectedIdx(i)}
                                  />
                                </div>
                              ))}
                            </div>

                            {draftSelectedIdx !== null && (
                              <button
                                onClick={() =>
                                  saveDraftVariation(draft.id)
                                }
                                disabled={draftSaving}
                                className="btn-primary w-full text-sm"
                              >
                                {draftSaving
                                  ? "Saving..."
                                  : "Replace Draft with Selection"}
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Past questions */}
              {(bankFilter === "all" || bankFilter === "past") && pastQuestions.map((pq) => {
                const isExpanded = expandedPastId === pq.roundId;

                return (
                  <div key={pq.roundId} className="space-y-2">
                    <div className="card p-4">
                      {/* Header badges */}
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-500/20 text-blue-400 font-bold uppercase">
                          Past
                        </span>
                        <span className="text-[10px] text-[#666680]">
                          {pq.leagueName} &middot; S{pq.seasonNumber}G{pq.gameNumber}R{pq.roundNumber}
                        </span>
                        {pq.avgRating != null && (
                          <span className="ml-auto flex items-center gap-1">
                            <StarRating value={pq.avgRating} size="sm" />
                          </span>
                        )}
                      </div>

                      {/* Question content */}
                      <p className="text-xs text-[#a0a0b8] uppercase tracking-wider mb-0.5">
                        {pq.question.category}
                      </p>
                      <p className="text-white text-sm font-medium mb-2">
                        {pq.question.questionText}
                      </p>

                      {/* MC options if applicable */}
                      {pq.question.answerFormat === "multiple_choice" && (
                        <div className="space-y-1 mb-2">
                          {(["A", "B", "C", "D"] as const).map((opt) => {
                            const text = pq.question[`option${opt}` as keyof typeof pq.question];
                            if (!text) return null;
                            const isCorrect = pq.question.correctOption === opt;
                            return (
                              <div
                                key={opt}
                                className={`text-xs px-2 py-1 rounded ${
                                  isCorrect
                                    ? "bg-emerald-500/10 text-emerald-400"
                                    : "text-[#a0a0b8]"
                                }`}
                              >
                                {opt}. {text} {isCorrect && "  ✓"}
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* Correct answer for non-MC */}
                      {pq.question.answerFormat !== "multiple_choice" && pq.question.correctAnswer && (
                        <p className="text-xs text-emerald-400 mb-2">
                          Answer: {pq.question.correctAnswer}
                        </p>
                      )}

                      {/* Stats + actions row */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3 text-xs text-[#666680]">
                          {pq.successRate != null && (
                            <span>{Math.round(pq.successRate * 100)}% correct</span>
                          )}
                          <span>{pq.playerResults.length} players</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setExpandedPastId(isExpanded ? null : pq.roundId)}
                            className="text-xs px-2 py-1 rounded bg-[#1e3a5f] text-[#a0a0b8] hover:text-white transition-colors"
                          >
                            {isExpanded ? "Hide Answers" : "Player Answers"}
                          </button>
                          <button
                            onClick={() => savePastToBank(pq)}
                            disabled={savingPastId === pq.roundId}
                            className="text-xs px-2 py-1 rounded bg-[#1e3a5f] text-[#a0a0b8] hover:text-white transition-colors"
                          >
                            {savingPastId === pq.roundId ? "Saving..." : "Save to Bank"}
                          </button>
                        </div>
                      </div>

                      {/* Expanded player answers */}
                      {isExpanded && (
                        <div className="mt-3 pt-3 border-t border-[#1e3a5f] space-y-2">
                          {[...pq.playerResults]
                            .sort((a, b) => (a.placement || 999) - (b.placement || 999))
                            .map((pr, i) => (
                              <div
                                key={i}
                                className={`rounded-lg p-2 border text-xs ${
                                  pr.isAbsent
                                    ? "border-gray-500/30 bg-gray-500/5"
                                    : pr.isCorrect
                                      ? "border-emerald-500/30 bg-emerald-500/5"
                                      : "border-red-500/30 bg-red-500/5"
                                }`}
                              >
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    <Avatar src={pr.avatarUrl} name={pr.name} size="sm" />
                                    <span className="text-white font-medium">{pr.name}</span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <span
                                      className={`font-bold ${
                                        pr.pointsWon > 0
                                          ? "text-emerald-400"
                                          : pr.pointsWon < 0
                                            ? "text-red-400"
                                            : "text-[#666680]"
                                      }`}
                                    >
                                      {pr.pointsWon > 0 ? "+" : ""}{pr.pointsWon}
                                    </span>
                                    {pr.isAbsent ? (
                                      <span className="text-gray-400">Absent</span>
                                    ) : pr.isCorrect ? (
                                      <span className="text-emerald-400">&#10003;</span>
                                    ) : (
                                      <span className="text-red-400">&#10007;</span>
                                    )}
                                  </div>
                                </div>
                                {!pr.isAbsent && (
                                  <p className="text-[#a0a0b8] mt-1 truncate">
                                    {pq.question.answerFormat === "multiple_choice" && pr.selectedOption
                                      ? `${pr.selectedOption}. ${getOptionText(pq.question, pr.selectedOption)}`
                                      : pr.freeTextAnswer || "(no answer)"}
                                    {pr.betAmount != null && (
                                      <span className="text-[#666680] ml-2">Bet: {pr.betAmount}</span>
                                    )}
                                    {pr.fastestLap && (
                                      <span className="text-purple-400 ml-1">Fastest</span>
                                    )}
                                  </p>
                                )}
                              </div>
                            ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

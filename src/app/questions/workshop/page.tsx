"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState, useEffect, useCallback } from "react";
import NavBar from "@/components/layout/NavBar";
import { CATEGORIES } from "@/lib/constants";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ParsedBoth {
  category: string;
  questionText: string;
  multipleChoice: {
    optionA: string;
    optionB: string;
    optionC: string;
    optionD: string;
    correctOption: string;
  };
  freeText: {
    correctAnswer: string;
    acceptableAnswers: string[];
  };
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  parsed?: ParsedBoth;
}

interface QuestionEdit {
  format: "multiple_choice" | "free_text";
  category: string;
  questionText: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  correctOption: string;
  correctAnswer: string;
  acceptableAnswers: string;
}

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

// ─── Parsed question card (shown in chat) ────────────────────────────────────

interface QuestionEditorProps {
  edit: QuestionEdit;
  onUpdate: (u: Partial<QuestionEdit>) => void;
  onSave: () => void;
  onAutoSubmit: () => void;
  saving: boolean;
  saved: boolean;
}

function QuestionEditor({ edit, onUpdate, onSave, onAutoSubmit, saving, saved }: QuestionEditorProps) {
  return (
    <div className="max-w-[92%] rounded-xl bg-[#1e3a5f] border border-[#254a73] overflow-hidden">
      <div className="p-4">
        {/* Category */}
        <div className="mb-2">
          <select
            value={edit.category}
            onChange={(e) => onUpdate({ category: e.target.value })}
            className="text-xs font-semibold text-[#fbbf24] bg-transparent border-none outline-none uppercase tracking-wider cursor-pointer"
          >
            <option value="">Select category...</option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>

        {/* Question text */}
        <textarea
          value={edit.questionText}
          onChange={(e) => onUpdate({ questionText: e.target.value })}
          className="w-full bg-transparent text-white font-medium mb-3 resize-none outline-none border-b border-[#254a73] pb-2 text-sm leading-relaxed"
          rows={2}
          placeholder="Question text..."
        />

        {/* Format toggle */}
        <div className="flex gap-2 mb-3">
          <button
            onClick={() => onUpdate({ format: "multiple_choice" })}
            className={`text-xs px-3 py-1 rounded-full transition-all ${
              edit.format === "multiple_choice"
                ? "bg-[#e94560] text-white"
                : "bg-[#0f0f23] text-[#a0a0b8] hover:text-white"
            }`}
          >
            Multiple Choice
          </button>
          <button
            onClick={() => onUpdate({ format: "free_text" })}
            className={`text-xs px-3 py-1 rounded-full transition-all ${
              edit.format === "free_text"
                ? "bg-[#e94560] text-white"
                : "bg-[#0f0f23] text-[#a0a0b8] hover:text-white"
            }`}
          >
            Free Text
          </button>
        </div>

        {/* Multiple choice options */}
        {edit.format === "multiple_choice" && (
          <div className="space-y-2 mb-3">
            {(["A", "B", "C", "D"] as const).map((letter) => {
              const key = `option${letter}` as "optionA" | "optionB" | "optionC" | "optionD";
              return (
                <div key={letter} className="flex items-center gap-2">
                  <button
                    onClick={() => onUpdate({ correctOption: letter })}
                    className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 transition-all ${
                      edit.correctOption === letter
                        ? "bg-emerald-500 text-white"
                        : "bg-[#0f0f23] text-[#a0a0b8] hover:bg-[#1e3a5f]"
                    }`}
                  >
                    {letter}
                  </button>
                  <input
                    type="text"
                    value={edit[key]}
                    onChange={(e) => onUpdate({ [key]: e.target.value })}
                    className="flex-1 bg-[#0f0f23] text-sm text-[#e8e8e8] px-2 py-1 rounded outline-none border border-transparent focus:border-[#254a73]"
                    placeholder={`Option ${letter}`}
                  />
                </div>
              );
            })}
            <p className="text-[10px] text-[#666680]">Click a letter to mark it as correct</p>
          </div>
        )}

        {/* Free text answer */}
        {edit.format === "free_text" && (
          <div className="space-y-2 mb-3">
            <input
              type="text"
              value={edit.correctAnswer}
              onChange={(e) => onUpdate({ correctAnswer: e.target.value })}
              className="w-full bg-emerald-500/20 text-emerald-400 text-sm px-2 py-1.5 rounded outline-none placeholder:text-emerald-400/50"
              placeholder="Correct answer"
            />
            <input
              type="text"
              value={edit.acceptableAnswers}
              onChange={(e) => onUpdate({ acceptableAnswers: e.target.value })}
              className="w-full bg-[#0f0f23] text-sm text-[#a0a0b8] px-2 py-1.5 rounded outline-none"
              placeholder="Also acceptable (comma-separated)"
            />
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-2 px-4 pb-4">
        <button
          onClick={onSave}
          disabled={saving || saved}
          className="btn-primary text-xs flex-1"
        >
          {saved ? "Saved!" : saving ? "Saving..." : "Save to Bank"}
        </button>
        <button
          onClick={onAutoSubmit}
          disabled={saving || saved}
          className="text-xs px-3 py-1.5 rounded bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 flex-1"
        >
          {saved ? "Saved!" : saving ? "..." : "Auto-submit"}
        </button>
      </div>
    </div>
  );
}

// ─── Draft card (shown in bank) ───────────────────────────────────────────────

interface DraftCardProps {
  draft: Draft;
  expanded: boolean;
  editState: QuestionEdit | undefined;
  aiEditInput: string;
  aiEditing: boolean;
  saving: boolean;
  deleting: boolean;
  onExpand: () => void;
  onCollapse: () => void;
  onUpdateEdit: (u: Partial<QuestionEdit>) => void;
  onSave: () => void;
  onToggleAutoSubmit: () => void;
  onDelete: () => void;
  onAiEditInputChange: (v: string) => void;
  onAiEdit: () => void;
}

function DraftCard({
  draft, expanded, editState, aiEditInput, aiEditing, saving, deleting,
  onExpand, onCollapse, onUpdateEdit, onSave, onToggleAutoSubmit, onDelete,
  onAiEditInputChange, onAiEdit,
}: DraftCardProps) {
  const isStructured = !!(draft.category && draft.answerFormat);

  return (
    <div className={`card transition-all ${expanded ? "ring-1 ring-[#e94560]/30" : ""}`}>
      {/* Header (always visible) */}
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
              {draft.category && (
                <span className="badge bg-[#1e3a5f] text-[#a0a0b8] text-xs">{draft.category}</span>
              )}
              {isStructured && (
                <span className="badge bg-emerald-500/20 text-emerald-400 text-[10px]">Formatted</span>
              )}
              {draft.useOnNextRound && (
                <span className="badge bg-[#e94560]/20 text-[#e94560] text-[10px]">Auto-submit ON</span>
              )}
              <span className="text-[10px] text-[#666680]">
                {draft.answerFormat === "multiple_choice"
                  ? "Multiple Choice"
                  : draft.answerFormat === "free_text"
                  ? "Free Text"
                  : "Format not set"}
              </span>
            </div>
            <p className="text-white text-sm leading-snug">
              {draft.questionText || "Untitled draft"}
            </p>
          </div>

          <div className="flex items-center gap-1.5 flex-shrink-0">
            <button
              onClick={onToggleAutoSubmit}
              className={`text-xs px-2 py-1 rounded transition-all ${
                draft.useOnNextRound
                  ? "bg-[#e94560]/20 text-[#e94560]"
                  : "bg-[#1e3a5f] text-[#a0a0b8] hover:text-white"
              }`}
            >
              {draft.useOnNextRound ? "Auto ON" : "Auto"}
            </button>
            <button
              onClick={expanded ? onCollapse : onExpand}
              className="text-xs px-2 py-1 rounded bg-[#1e3a5f] text-[#a0a0b8] hover:text-white"
            >
              {expanded ? "Done" : "Edit"}
            </button>
            <button
              onClick={onDelete}
              disabled={deleting}
              className="text-xs text-red-400 hover:text-red-300"
            >
              {deleting ? "..." : "Delete"}
            </button>
          </div>
        </div>

        {/* Collapsed preview */}
        {!expanded && draft.answerFormat === "multiple_choice" && draft.optionA && (
          <div className="mt-2 text-xs text-[#a0a0b8] space-y-0.5 pl-1">
            {[
              { key: "A", val: draft.optionA },
              { key: "B", val: draft.optionB },
              { key: "C", val: draft.optionC },
              { key: "D", val: draft.optionD },
            ].map(
              (opt) =>
                opt.val && (
                  <p key={opt.key}>
                    <span className={draft.correctOption === opt.key ? "text-emerald-400 font-bold" : ""}>
                      {opt.key}.
                    </span>{" "}
                    {opt.val}
                  </p>
                )
            )}
          </div>
        )}
        {!expanded && draft.answerFormat === "free_text" && draft.correctAnswer && (
          <p className="mt-1 text-xs text-emerald-400 pl-1">Answer: {draft.correctAnswer}</p>
        )}
      </div>

      {/* Expanded edit form */}
      {expanded && editState && (
        <div className="border-t border-[#1e3a5f] px-4 pb-4 pt-4 space-y-4">
          {/* Category */}
          <div>
            <label className="text-xs text-[#666680] mb-1.5 block">Category</label>
            <div className="grid grid-cols-3 gap-1.5">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  onClick={() => onUpdateEdit({ category: cat })}
                  className={`text-xs py-1.5 px-2 rounded border text-left transition-all ${
                    editState.category === cat
                      ? "border-[#e94560] bg-[#e94560]/10 text-white"
                      : "border-[#1e3a5f] text-[#a0a0b8] hover:border-[#2a5a8f]"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Question text */}
          <div>
            <label className="text-xs text-[#666680] mb-1.5 block">Question</label>
            <textarea
              value={editState.questionText}
              onChange={(e) => onUpdateEdit({ questionText: e.target.value })}
              className="input-field text-sm min-h-[70px]"
              placeholder="Question text..."
            />
          </div>

          {/* Format toggle */}
          <div>
            <label className="text-xs text-[#666680] mb-1.5 block">Format</label>
            <div className="flex gap-2">
              <button
                onClick={() => onUpdateEdit({ format: "multiple_choice" })}
                className={`text-xs px-3 py-1.5 rounded border flex-1 transition-all ${
                  editState.format === "multiple_choice"
                    ? "border-[#e94560] bg-[#e94560]/10 text-white"
                    : "border-[#1e3a5f] text-[#a0a0b8]"
                }`}
              >
                Multiple Choice
              </button>
              <button
                onClick={() => onUpdateEdit({ format: "free_text" })}
                className={`text-xs px-3 py-1.5 rounded border flex-1 transition-all ${
                  editState.format === "free_text"
                    ? "border-[#e94560] bg-[#e94560]/10 text-white"
                    : "border-[#1e3a5f] text-[#a0a0b8]"
                }`}
              >
                Free Text
              </button>
            </div>
          </div>

          {/* MC options */}
          {editState.format === "multiple_choice" && (
            <div className="space-y-2">
              {(["A", "B", "C", "D"] as const).map((letter) => {
                const key = `option${letter}` as "optionA" | "optionB" | "optionC" | "optionD";
                return (
                  <div key={letter} className="flex items-center gap-2">
                    <button
                      onClick={() => onUpdateEdit({ correctOption: letter })}
                      className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 transition-all ${
                        editState.correctOption === letter
                          ? "bg-emerald-500 text-white"
                          : "bg-[#1e3a5f] text-[#a0a0b8]"
                      }`}
                    >
                      {letter}
                    </button>
                    <input
                      type="text"
                      value={editState[key]}
                      onChange={(e) => onUpdateEdit({ [key]: e.target.value })}
                      className="input-field flex-1 text-sm"
                      placeholder={`Option ${letter}`}
                    />
                  </div>
                );
              })}
              <p className="text-[10px] text-[#666680]">Click a letter to mark it as correct (green = correct)</p>
            </div>
          )}

          {/* Free text */}
          {editState.format === "free_text" && (
            <div className="space-y-2">
              <div>
                <label className="text-xs text-[#666680] mb-1 block">Correct Answer</label>
                <input
                  type="text"
                  value={editState.correctAnswer}
                  onChange={(e) => onUpdateEdit({ correctAnswer: e.target.value })}
                  className="input-field text-sm"
                  placeholder="The exact correct answer"
                />
              </div>
              <div>
                <label className="text-xs text-[#666680] mb-1 block">Also Acceptable (comma-separated)</label>
                <input
                  type="text"
                  value={editState.acceptableAnswers}
                  onChange={(e) => onUpdateEdit({ acceptableAnswers: e.target.value })}
                  className="input-field text-sm"
                  placeholder="alt answer 1, alt answer 2"
                />
              </div>
            </div>
          )}

          {/* AI edit */}
          <div>
            <label className="text-xs text-[#666680] mb-1.5 block">Ask AI to Modify</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={aiEditInput}
                onChange={(e) => onAiEditInputChange(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !aiEditing && aiEditInput.trim()) onAiEdit();
                }}
                className="input-field flex-1 text-sm"
                placeholder='e.g. "Make this multiple choice" or "Change category to Sports"'
              />
              <button
                onClick={onAiEdit}
                disabled={aiEditing || !aiEditInput.trim()}
                className="btn-secondary text-sm"
              >
                {aiEditing ? "..." : "Ask AI"}
              </button>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex gap-2">
            <button
              onClick={onSave}
              disabled={saving}
              className="btn-primary text-sm flex-1"
            >
              {saving ? "Saving..." : "Save Changes"}
            </button>
            <button onClick={onCollapse} className="btn-secondary text-sm">
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function WorkshopPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  // Chat state
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [messageEdits, setMessageEdits] = useState<Record<number, QuestionEdit>>({});
  const [savingMsgIdx, setSavingMsgIdx] = useState<number | null>(null);
  const [savedMsgIdx, setSavedMsgIdx] = useState<number | null>(null);

  // Bank state
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [draftsLoading, setDraftsLoading] = useState(true);
  const [expandedDraftId, setExpandedDraftId] = useState<string | null>(null);
  const [draftEdits, setDraftEdits] = useState<Record<string, QuestionEdit>>({});
  const [savingDraftId, setSavingDraftId] = useState<string | null>(null);
  const [deletingDraftId, setDeletingDraftId] = useState<string | null>(null);
  const [aiEditInputs, setAiEditInputs] = useState<Record<string, string>>({});
  const [aiEditing, setAiEditing] = useState<Record<string, boolean>>({});

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

  useEffect(() => {
    if (session?.user) loadDrafts();
  }, [session, loadDrafts]);

  // ── Chat ──────────────────────────────────────────────────────────────────

  const sendMessage = async () => {
    if (!input.trim() || loading) return;
    const newMessages: ChatMessage[] = [...messages, { role: "user", content: input }];
    setMessages(newMessages);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/questions/workshop", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: newMessages }),
      });
      const data = await res.json();
      const assistantContent: string = data.response || "No response";

      let parsed: ParsedBoth | undefined;
      try {
        const parseRes = await fetch("/api/questions/parse", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: assistantContent }),
        });
        if (parseRes.ok) parsed = await parseRes.json();
      } catch {
        // Parsing failed — show plain text
      }

      const assistantMsgIndex = newMessages.length;
      if (parsed) {
        setMessageEdits((prev) => ({
          ...prev,
          [assistantMsgIndex]: {
            format: "multiple_choice",
            category: parsed!.category,
            questionText: parsed!.questionText,
            optionA: parsed!.multipleChoice?.optionA || "",
            optionB: parsed!.multipleChoice?.optionB || "",
            optionC: parsed!.multipleChoice?.optionC || "",
            optionD: parsed!.multipleChoice?.optionD || "",
            correctOption: parsed!.multipleChoice?.correctOption || "",
            correctAnswer: parsed!.freeText?.correctAnswer || "",
            acceptableAnswers: (parsed!.freeText?.acceptableAnswers || []).join(", "),
          },
        }));
      }

      setMessages([...newMessages, { role: "assistant", content: assistantContent, parsed }]);
    } catch {
      setMessages([...newMessages, { role: "assistant", content: "Something went wrong. Try again." }]);
    } finally {
      setLoading(false);
    }
  };

  const updateMessageEdit = (idx: number, updates: Partial<QuestionEdit>) => {
    setMessageEdits((prev) => ({ ...prev, [idx]: { ...prev[idx], ...updates } }));
  };

  const saveFromChat = async (idx: number, autoSubmit: boolean) => {
    const edit = messageEdits[idx];
    if (!edit) return;
    setSavingMsgIdx(idx);
    try {
      const body: Record<string, unknown> = {
        category: edit.category,
        questionText: edit.questionText,
        answerFormat: edit.format,
        useOnNextRound: autoSubmit,
      };
      if (edit.format === "multiple_choice") {
        body.optionA = edit.optionA;
        body.optionB = edit.optionB;
        body.optionC = edit.optionC;
        body.optionD = edit.optionD;
        body.correctOption = edit.correctOption;
      } else {
        body.correctAnswer = edit.correctAnswer;
        body.acceptableAnswers = edit.acceptableAnswers
          .split(",")
          .map((a) => a.trim())
          .filter(Boolean);
      }
      await fetch("/api/questions/drafts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      setSavedMsgIdx(idx);
      await loadDrafts();
      setTimeout(() => setSavedMsgIdx((prev) => (prev === idx ? null : prev)), 2000);
    } finally {
      setSavingMsgIdx(null);
    }
  };

  // ── Bank ──────────────────────────────────────────────────────────────────

  const parsedAcceptableAnswers = (json: string | null): string => {
    if (!json) return "";
    try {
      const arr = JSON.parse(json);
      return Array.isArray(arr) ? arr.join(", ") : "";
    } catch {
      return "";
    }
  };

  const expandDraft = (draft: Draft) => {
    setDraftEdits((prev) => ({
      ...prev,
      [draft.id]: {
        format: (draft.answerFormat as "multiple_choice" | "free_text") || "multiple_choice",
        category: draft.category || "",
        questionText: draft.questionText || "",
        optionA: draft.optionA || "",
        optionB: draft.optionB || "",
        optionC: draft.optionC || "",
        optionD: draft.optionD || "",
        correctOption: draft.correctOption || "",
        correctAnswer: draft.correctAnswer || "",
        acceptableAnswers: parsedAcceptableAnswers(draft.acceptableAnswers),
      },
    }));
    setExpandedDraftId(draft.id);
  };

  const updateDraftEdit = (id: string, updates: Partial<QuestionEdit>) => {
    setDraftEdits((prev) => ({ ...prev, [id]: { ...prev[id], ...updates } }));
  };

  const saveDraftEdit = async (id: string) => {
    const edit = draftEdits[id];
    if (!edit) return;
    setSavingDraftId(id);
    try {
      const body: Record<string, unknown> = {
        id,
        category: edit.category,
        questionText: edit.questionText,
        answerFormat: edit.format,
      };
      if (edit.format === "multiple_choice") {
        body.optionA = edit.optionA;
        body.optionB = edit.optionB;
        body.optionC = edit.optionC;
        body.optionD = edit.optionD;
        body.correctOption = edit.correctOption;
      } else {
        body.correctAnswer = edit.correctAnswer;
        body.acceptableAnswers = edit.acceptableAnswers
          .split(",")
          .map((a) => a.trim())
          .filter(Boolean);
      }
      await fetch("/api/questions/drafts", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      await loadDrafts();
      setExpandedDraftId(null);
    } finally {
      setSavingDraftId(null);
    }
  };

  const toggleAutoSubmit = async (id: string, current: boolean) => {
    await fetch("/api/questions/drafts", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, useOnNextRound: !current }),
    });
    setDrafts((prev) => prev.map((d) => (d.id === id ? { ...d, useOnNextRound: !current } : d)));
  };

  const deleteDraft = async (id: string) => {
    setDeletingDraftId(id);
    await fetch(`/api/questions/drafts?id=${id}`, { method: "DELETE" });
    setDrafts((prev) => prev.filter((d) => d.id !== id));
    if (expandedDraftId === id) setExpandedDraftId(null);
    setDeletingDraftId(null);
  };

  const aiEditDraft = async (id: string) => {
    const prompt = aiEditInputs[id];
    const draft = drafts.find((d) => d.id === id);
    if (!prompt?.trim() || !draft) return;

    setAiEditing((prev) => ({ ...prev, [id]: true }));
    try {
      const contextMsg = `I have an existing trivia question:\n\nCategory: ${draft.category || "unknown"}\nQuestion: ${draft.questionText}\nFormat: ${draft.answerFormat || "unknown"}\n\nRequest: ${prompt}`;
      const res = await fetch("/api/questions/workshop", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: [{ role: "user", content: contextMsg }] }),
      });
      const data = await res.json();
      const parseRes = await fetch("/api/questions/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: data.response }),
      });
      if (parseRes.ok) {
        const parsed: ParsedBoth = await parseRes.json();
        const currentFormat = draftEdits[id]?.format || "multiple_choice";
        setDraftEdits((prev) => ({
          ...prev,
          [id]: {
            category: parsed.category,
            questionText: parsed.questionText,
            format: currentFormat,
            optionA: parsed.multipleChoice?.optionA || "",
            optionB: parsed.multipleChoice?.optionB || "",
            optionC: parsed.multipleChoice?.optionC || "",
            optionD: parsed.multipleChoice?.optionD || "",
            correctOption: parsed.multipleChoice?.correctOption || "",
            correctAnswer: parsed.freeText?.correctAnswer || "",
            acceptableAnswers: (parsed.freeText?.acceptableAnswers || []).join(", "),
          },
        }));
      }
      setAiEditInputs((prev) => ({ ...prev, [id]: "" }));
    } finally {
      setAiEditing((prev) => ({ ...prev, [id]: false }));
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen">
      <NavBar />
      <div className="max-w-3xl mx-auto px-4 py-6 space-y-10">

        {/* ── Workshop Chat ── */}
        <section>
          <h1 className="text-xl font-bold text-white mb-1">Question Workshop</h1>
          <p className="text-sm text-[#a0a0b8] mb-4">
            Chat with AI to brainstorm and refine trivia questions
          </p>

          <div className="card p-4 mb-4 overflow-y-auto max-h-[60vh] min-h-[180px]">
            {messages.length === 0 && (
              <div className="text-center py-10 text-[#666680]">
                <p className="text-lg mb-2">&#128161;</p>
                <p className="text-sm mb-4">
                  Ask me to help create trivia questions! I&apos;ll generate both multiple choice
                  and free text versions so you can pick the format you want.
                </p>
                <div className="space-y-2">
                  {[
                    "Help me create a geography question about world capitals",
                    "Suggest an Olympics history question",
                    "Make a tricky science question",
                  ].map((prompt) => (
                    <button
                      key={prompt}
                      onClick={() => setInput(prompt)}
                      className="block mx-auto text-xs bg-[#1e3a5f] text-[#a0a0b8] px-3 py-1.5 rounded-full hover:text-white"
                    >
                      &quot;{prompt}&quot;
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-3">
              {messages.map((msg, i) => (
                <div
                  key={i}
                  className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  {msg.role === "user" ? (
                    <div className="max-w-[80%] p-3 rounded-xl text-sm bg-[#e94560]/20 text-white">
                      <p className="whitespace-pre-wrap">{msg.content}</p>
                    </div>
                  ) : msg.parsed && messageEdits[i] ? (
                    <QuestionEditor
                      edit={messageEdits[i]}
                      onUpdate={(u) => updateMessageEdit(i, u)}
                      onSave={() => saveFromChat(i, false)}
                      onAutoSubmit={() => saveFromChat(i, true)}
                      saving={savingMsgIdx === i}
                      saved={savedMsgIdx === i}
                    />
                  ) : (
                    <div className="max-w-[80%] p-3 rounded-xl text-sm bg-[#1e3a5f] text-[#e8e8e8]">
                      <p className="whitespace-pre-wrap">{msg.content}</p>
                    </div>
                  )}
                </div>
              ))}
              {loading && (
                <div className="text-sm text-[#666680] animate-pulse pl-2">Thinking...</div>
              )}
            </div>
          </div>

          <div className="flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") sendMessage(); }}
              className="input-field flex-1"
              placeholder="Ask about question ideas..."
            />
            <button
              onClick={sendMessage}
              disabled={loading || !input.trim()}
              className="btn-primary"
            >
              Send
            </button>
          </div>
        </section>

        {/* ── Question Bank ── */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-bold text-white">Question Bank</h2>
              <p className="text-sm text-[#a0a0b8]">
                Edit, refine, or queue saved questions for auto-submit
              </p>
            </div>
            {!draftsLoading && drafts.length > 0 && (
              <span className="text-sm text-[#666680]">
                {drafts.length} question{drafts.length !== 1 ? "s" : ""}
              </span>
            )}
          </div>

          {draftsLoading ? (
            <div className="card p-8 text-center animate-pulse text-[#e94560]">Loading...</div>
          ) : drafts.length === 0 ? (
            <div className="card p-8 text-center text-[#666680]">
              <p>No saved questions yet. Chat with the workshop above to create some!</p>
            </div>
          ) : (
            <div className="space-y-3">
              {drafts.map((draft) => (
                <DraftCard
                  key={draft.id}
                  draft={draft}
                  expanded={expandedDraftId === draft.id}
                  editState={draftEdits[draft.id]}
                  aiEditInput={aiEditInputs[draft.id] || ""}
                  aiEditing={aiEditing[draft.id] || false}
                  saving={savingDraftId === draft.id}
                  deleting={deletingDraftId === draft.id}
                  onExpand={() => expandDraft(draft)}
                  onCollapse={() => setExpandedDraftId(null)}
                  onUpdateEdit={(u) => updateDraftEdit(draft.id, u)}
                  onSave={() => saveDraftEdit(draft.id)}
                  onToggleAutoSubmit={() => toggleAutoSubmit(draft.id, draft.useOnNextRound)}
                  onDelete={() => deleteDraft(draft.id)}
                  onAiEditInputChange={(v) =>
                    setAiEditInputs((prev) => ({ ...prev, [draft.id]: v }))
                  }
                  onAiEdit={() => aiEditDraft(draft.id)}
                />
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

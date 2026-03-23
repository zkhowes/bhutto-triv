"use client";

import { useState, useEffect, useCallback } from "react";
import QuestionPreviewCard from "./QuestionPreviewCard";
import ImageSearchModal from "./ImageSearchModal";
import type { WorkshopVariation, WorkshopResponse } from "@/lib/ai";

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

interface WorkshopEmbedProps {
  onSelectQuestion: (question: {
    category: string;
    questionText: string;
    answerFormat: string;
    optionA?: string;
    optionB?: string;
    optionC?: string;
    optionD?: string;
    correctOption?: string;
    correctAnswer?: string;
    acceptableAnswers?: string[];
    imageUrl?: string;
    imageSource?: string;
    imageAttribution?: string;
  }) => void;
}

interface CardImage {
  url: string;
  source: string;
  attribution?: string;
}

type WorkshopState = "idle" | "loading" | "viewing_cards" | "selected" | "editing";

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

export default function WorkshopEmbed({ onSelectQuestion }: WorkshopEmbedProps) {
  const [tab, setTab] = useState<"generate" | "bank">("generate");

  // Workshop state
  const [workshopState, setWorkshopState] = useState<WorkshopState>("idle");
  const [input, setInput] = useState("");
  const [lastPrompt, setLastPrompt] = useState("");
  const [variations, setVariations] = useState<WorkshopVariation[]>([]);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [conversationText, setConversationText] = useState<string | null>(null);
  const [editInput, setEditInput] = useState("");

  // Image state
  const [cardImages, setCardImages] = useState<Record<number, CardImage>>({});
  const [imageModalOpen, setImageModalOpen] = useState(false);
  const [imageModalIdx, setImageModalIdx] = useState<number | null>(null);
  const [imageModalQuery, setImageModalQuery] = useState("");

  // Bank state
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [draftsLoading, setDraftsLoading] = useState(true);

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
    loadDrafts();
  }, [loadDrafts]);

  // Auto-search image for first card when variations load
  useEffect(() => {
    if (workshopState !== "viewing_cards" || variations.length === 0) return;
    const firstTerm = variations[0]?.imageSearchTerm;
    if (!firstTerm) return;
    // Reset images when new variations arrive
    setCardImages({});
    fetch("/api/images/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: firstTerm, source: "unsplash" }),
    })
      .then((r) => r.json())
      .then((data) => {
        const results = data.results as Array<{ url: string; attribution?: { name: string } }> | undefined;
        if (results && results.length > 0) {
          setCardImages((prev) => ({
            ...prev,
            0: {
              url: results[0].url,
              source: "unsplash",
              attribution: results[0].attribution?.name,
            },
          }));
        }
      })
      .catch(() => {/* ignore */});
  }, [variations, workshopState]);

  const handleOpenImageModal = (idx: number) => {
    const term = variations[idx]?.imageSearchTerm || "";
    setImageModalIdx(idx);
    setImageModalQuery(term);
    setImageModalOpen(true);
  };

  const handleImageSelected = (image: { url: string; source: string; attribution?: string }) => {
    if (imageModalIdx === null) return;
    setCardImages((prev) => ({
      ...prev,
      [imageModalIdx]: {
        url: image.url,
        source: image.source,
        attribution: image.attribution,
      },
    }));
    setImageModalOpen(false);
    setImageModalIdx(null);
  };

  // Workshop actions
  const handlePrompt = async (prompt: string) => {
    if (!prompt.trim()) return;
    setWorkshopState("loading");
    setLastPrompt(prompt);
    setInput("");
    setSelectedIdx(null);
    setConversationText(null);
    setVariations([]);
    setCardImages({});

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

  const handleUseQuestion = (v: WorkshopVariation, idx: number) => {
    const img = cardImages[idx];
    onSelectQuestion({
      category: v.category,
      questionText: v.questionText,
      answerFormat: v.answerFormat,
      optionA: v.optionA,
      optionB: v.optionB,
      optionC: v.optionC,
      optionD: v.optionD,
      correctOption: v.correctOption,
      correctAnswer: v.correctAnswer,
      acceptableAnswers: v.acceptableAnswers,
      imageUrl: img?.url,
      imageSource: img?.source,
      imageAttribution: img?.attribution,
    });
  };

  const handleEditSubmit = async (instruction: string) => {
    if (!instruction.trim() || selectedIdx === null) return;
    const question = variations[selectedIdx];
    setWorkshopState("loading");
    setSelectedIdx(null);
    setCardImages({});

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

  const handleUseDraft = (draft: Draft) => {
    onSelectQuestion({
      category: draft.category || "General Knowledge",
      questionText: draft.questionText || "",
      answerFormat: draft.answerFormat || "free_text",
      optionA: draft.optionA || undefined,
      optionB: draft.optionB || undefined,
      optionC: draft.optionC || undefined,
      optionD: draft.optionD || undefined,
      correctOption: draft.correctOption || undefined,
      correctAnswer: draft.correctAnswer || undefined,
      acceptableAnswers: draft.acceptableAnswers
        ? (() => { try { const a = JSON.parse(draft.acceptableAnswers!); return Array.isArray(a) ? a : undefined; } catch { return undefined; } })()
        : undefined,
    });
  };

  return (
    <div className="card p-4 bg-[#0f0f23] space-y-3">
      {/* Tabs */}
      <div className="flex gap-2">
        <button
          onClick={() => setTab("generate")}
          className={`text-xs px-3 py-1.5 rounded-lg font-medium ${
            tab === "generate"
              ? "bg-[#e94560] text-white"
              : "bg-[#1e3a5f] text-[#a0a0b8]"
          }`}
        >
          Generate
        </button>
        <button
          onClick={() => setTab("bank")}
          className={`text-xs px-3 py-1.5 rounded-lg font-medium ${
            tab === "bank"
              ? "bg-[#e94560] text-white"
              : "bg-[#1e3a5f] text-[#a0a0b8]"
          }`}
        >
          Question Bank {drafts.length > 0 && `(${drafts.length})`}
        </button>
      </div>

      {/* Generate Tab */}
      {tab === "generate" && (
        <div className="space-y-3">
          {/* IDLE */}
          {workshopState === "idle" && (
            <>
              {conversationText && (
                <div className="p-3 text-sm text-[#e8e8e8] bg-[#16162a] rounded-lg">
                  <p className="whitespace-pre-wrap">{conversationText}</p>
                </div>
              )}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") handlePrompt(input); }}
                  className="input-field flex-1 text-sm"
                  placeholder="What kind of question?"
                />
                <button
                  onClick={() => handlePrompt(input)}
                  disabled={!input.trim()}
                  className="btn-primary text-sm"
                >
                  Go
                </button>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {SUGGESTION_CHIPS.map((chip) => (
                  <button
                    key={chip}
                    onClick={() => handlePrompt(chip)}
                    className="text-xs px-2 py-1 rounded-full bg-[#1e3a5f] text-[#a0a0b8] hover:text-white hover:bg-[#254a73] transition-all"
                  >
                    {chip}
                  </button>
                ))}
              </div>
            </>
          )}

          {/* LOADING */}
          {workshopState === "loading" && (
            <div className="grid grid-cols-3 gap-2">
              {[0, 1, 2].map((i) => (
                <div key={i} className="rounded-lg border border-[#1e3a5f] bg-[#16162a] p-2 animate-pulse">
                  <div className="h-2 w-12 bg-[#1e3a5f] rounded mb-2" />
                  <div className="h-3 w-3/4 bg-[#1e3a5f] rounded mb-1.5" />
                  <div className="h-3 w-1/2 bg-[#1e3a5f] rounded" />
                </div>
              ))}
            </div>
          )}

          {/* VIEWING_CARDS */}
          {workshopState === "viewing_cards" && (
            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {variations.map((v, i) => (
                  <QuestionPreviewCard
                    key={i}
                    {...v}
                    compact
                    onSelect={() => handleSelectCard(i)}
                    imageUrl={cardImages[i]?.url}
                    onImageClick={() => handleOpenImageModal(i)}
                  />
                ))}
              </div>
              <div className="flex gap-2 justify-center">
                <button
                  onClick={() => handlePrompt(lastPrompt)}
                  className="text-xs px-2 py-1 rounded-full bg-[#1e3a5f] text-[#a0a0b8] hover:text-white transition-all"
                >
                  New set
                </button>
                <button
                  onClick={() => { setWorkshopState("idle"); setVariations([]); setConversationText(null); }}
                  className="text-xs px-2 py-1 text-[#666680] hover:text-[#a0a0b8]"
                >
                  Start Over
                </button>
              </div>
            </div>
          )}

          {/* SELECTED */}
          {workshopState === "selected" && selectedIdx !== null && (
            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {variations.map((v, i) => (
                  <div key={i} className={i !== selectedIdx ? "opacity-40" : ""}>
                    <QuestionPreviewCard
                      {...v}
                      selected={i === selectedIdx}
                      compact
                      onSelect={() => handleSelectCard(i)}
                      imageUrl={cardImages[i]?.url}
                      onImageClick={() => handleOpenImageModal(i)}
                    />
                  </div>
                ))}
              </div>
              <div className="flex gap-2 justify-center">
                <button
                  onClick={() => handleUseQuestion(variations[selectedIdx], selectedIdx)}
                  className="btn-primary text-sm"
                >
                  Use This Question
                </button>
                <button
                  onClick={() => { setEditInput(""); setWorkshopState("editing"); }}
                  className="btn-secondary text-xs"
                >
                  Edit Further
                </button>
                <button
                  onClick={() => handlePrompt(lastPrompt)}
                  className="text-xs px-2 py-1 rounded-full bg-[#1e3a5f] text-[#a0a0b8] hover:text-white transition-all"
                >
                  New set
                </button>
              </div>
            </div>
          )}

          {/* EDITING */}
          {workshopState === "editing" && selectedIdx !== null && (
            <div className="space-y-3">
              <div className="max-w-xs mx-auto">
                <QuestionPreviewCard
                  {...variations[selectedIdx]}
                  selected
                  compact
                  imageUrl={cardImages[selectedIdx]?.url}
                  onImageClick={() => handleOpenImageModal(selectedIdx)}
                />
              </div>
              <div className="flex flex-wrap gap-1.5 justify-center">
                {EDIT_CHIPS.map((chip) => (
                  <button
                    key={chip}
                    onClick={() => handleEditSubmit(chip)}
                    className="text-xs px-2 py-1 rounded-full bg-[#1e3a5f] text-[#a0a0b8] hover:text-white hover:bg-[#254a73] transition-all"
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
                  onKeyDown={(e) => { if (e.key === "Enter" && editInput.trim()) handleEditSubmit(editInput); }}
                  className="input-field flex-1 text-sm"
                  placeholder="Custom edit request..."
                />
                <button
                  onClick={() => handleEditSubmit(editInput)}
                  disabled={!editInput.trim()}
                  className="btn-primary text-sm"
                >
                  Go
                </button>
              </div>
              <button
                onClick={() => setWorkshopState("selected")}
                className="text-xs text-[#a0a0b8] hover:text-white w-full text-center"
              >
                Back
              </button>
            </div>
          )}
        </div>
      )}

      {/* Bank Tab */}
      {tab === "bank" && (
        <div className="space-y-2">
          {draftsLoading ? (
            <div className="text-center text-sm text-[#666680] animate-pulse py-4">
              Loading...
            </div>
          ) : drafts.length === 0 ? (
            <div className="text-center text-sm text-[#666680] py-4">
              No saved questions. Use Generate to create some!
            </div>
          ) : (
            drafts.map((draft) => (
              <div
                key={draft.id}
                className="flex items-center gap-2 p-2 rounded-lg hover:bg-[#1e3a5f]/30 transition-colors cursor-pointer"
                onClick={() => handleUseDraft(draft)}
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white truncate">
                    {draft.questionText || "Untitled"}
                  </p>
                  <p className="text-xs text-[#666680]">
                    {draft.category} &middot; {draft.answerFormat?.replace(/_/g, " ")}
                  </p>
                </div>
                <span className="text-xs text-[#4fc3f7] flex-shrink-0">
                  Use
                </span>
              </div>
            ))
          )}
        </div>
      )}

      <ImageSearchModal
        isOpen={imageModalOpen}
        onClose={() => { setImageModalOpen(false); setImageModalIdx(null); }}
        onSelect={(img) => handleImageSelected({ url: img.url, source: img.source, attribution: img.attribution })}
        initialQuery={imageModalQuery}
      />
    </div>
  );
}

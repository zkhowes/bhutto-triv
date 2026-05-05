"use client";

import { useState, useEffect } from "react";
import QuestionPreviewCard from "./QuestionPreviewCard";
import ImageSearchModal from "./ImageSearchModal";
import type { WorkshopVariation, WorkshopResponse } from "@/lib/ai";

export interface AssistedQuestion {
  category: string;
  questionText: string;
  answerFormat: string;
  optionA?: string;
  optionB?: string;
  optionC?: string;
  optionD?: string;
  correctOption?: string;
  correctAnswer?: string;
  correctAnswerUnit?: string;
  orderingItems?: string[];
  orderingDirection?: string;
  orderingItemValues?: Array<string | number | null>;
  imageUrl?: string;
  imageSource?: string;
  imageAttribution?: string;
}

interface AssistButtonProps {
  // Current form state — used to compute mode
  questionText: string;
  category: string;
  answerFormat: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  correctOption: string;
  correctAnswer: string;
  orderingItem1: string;
  orderingItem2: string;
  orderingItem3: string;
  orderingDirection: string;
  onAccept: (q: AssistedQuestion) => void;
  // Optional controlled open state — when provided, the parent owns visibility.
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

type Mode = "brainstorm" | "build_answer" | "refine";
type State = "idle" | "loading" | "viewing" | "selected" | "editing";

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
  "Change to PiR",
  "Change to Ordering",
  "Different Angle",
];

interface CardImage {
  url: string;
  source: string;
  attribution?: string;
}

export default function AssistButton(props: AssistButtonProps) {
  const {
    questionText,
    category,
    answerFormat,
    optionA,
    optionB,
    optionC,
    optionD,
    correctOption,
    correctAnswer,
    orderingItem1,
    orderingItem2,
    orderingItem3,
    orderingDirection,
    onAccept,
    open: controlledOpen,
    onOpenChange,
  } = props;

  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? (controlledOpen as boolean) : internalOpen;
  const setOpen = (next: boolean) => {
    if (isControlled) onOpenChange?.(next);
    else setInternalOpen(next);
  };
  const [state, setState] = useState<State>("idle");
  const [prompt, setPrompt] = useState("");
  const [editText, setEditText] = useState("");
  const [variations, setVariations] = useState<WorkshopVariation[]>([]);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [conversation, setConversation] = useState<string | null>(null);

  const [cardImages, setCardImages] = useState<Record<number, CardImage>>({});
  const [imageModalOpen, setImageModalOpen] = useState(false);
  const [imageModalIdx, setImageModalIdx] = useState<number | null>(null);
  const [imageModalQuery, setImageModalQuery] = useState("");

  // Determine mode from form state
  const hasQuestion = questionText.trim().length > 0;
  const hasAnswer =
    (answerFormat === "multiple_choice" && optionA && optionB && correctOption) ||
    (answerFormat === "price_is_right" && correctAnswer.trim() !== "") ||
    (answerFormat === "ordering" &&
      orderingItem1 &&
      orderingItem2 &&
      orderingItem3 &&
      orderingDirection);
  const mode: Mode = !hasQuestion
    ? "brainstorm"
    : !hasAnswer
      ? "build_answer"
      : "refine";

  useEffect(() => {
    if (!open) return;
    if (mode === "brainstorm") return;
    if (state !== "idle") return;
    if (variations.length > 0) return;
    generate("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, mode]);

  // Auto-search image for first card when variations arrive
  useEffect(() => {
    if (state !== "viewing" || variations.length === 0) return;
    const firstTerm = variations[0]?.imageSearchTerm;
    if (!firstTerm) return;
    setCardImages({});
    fetch("/api/images/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: firstTerm, source: "unsplash" }),
    })
      .then((r) => r.json())
      .then((data) => {
        const results = data.results as
          | Array<{ url: string; attribution?: { name: string } }>
          | undefined;
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
      .catch(() => {});
  }, [variations, state]);

  const currentAsVariation = (): WorkshopVariation => {
    const orderingItems = [orderingItem1, orderingItem2, orderingItem3].filter(Boolean);
    return {
      category: category || "General Knowledge",
      questionText,
      answerFormat: answerFormat as WorkshopVariation["answerFormat"],
      optionA: optionA || undefined,
      optionB: optionB || undefined,
      optionC: optionC || undefined,
      optionD: optionD || undefined,
      correctOption: correctOption || undefined,
      correctAnswer: correctAnswer || undefined,
      orderingItems: orderingItems.length >= 3 ? orderingItems : undefined,
      orderingCorrectOrder:
        orderingItems.length >= 3
          ? orderingItems.map((_, i) => i + 1)
          : undefined,
      orderingDirection: orderingDirection || undefined,
      difficulty: "medium",
      hook: "",
    };
  };

  const generate = async (userPrompt: string) => {
    setState("loading");
    setSelectedIdx(null);
    setConversation(null);
    setVariations([]);
    setCardImages({});

    try {
      let res: Response;
      if (mode === "brainstorm") {
        res = await fetch("/api/questions/workshop", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt: userPrompt }),
        });
      } else {
        const instruction =
          mode === "build_answer"
            ? `Build out the answer formats for this question — propose multiple_choice options, price_is_right, or ordering arrangements that fit. Match the question's tone. ${userPrompt ? "Also: " + userPrompt : ""}`.trim()
            : `Refine this question — vary the angle, difficulty, or format. ${userPrompt ? "Also: " + userPrompt : ""}`.trim();
        res = await fetch("/api/questions/workshop/edit", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            question: currentAsVariation(),
            instruction,
          }),
        });
      }
      const data: WorkshopResponse = await res.json();
      if (data.type === "questions" && data.variations?.length) {
        setVariations(data.variations);
        setState("viewing");
      } else {
        setConversation(data.text || "No response from AI.");
        setState("idle");
      }
    } catch {
      setConversation("Something went wrong. Try again.");
      setState("idle");
    }
  };

  const acceptCard = (idx: number) => {
    const v = variations[idx];
    const img = cardImages[idx];
    onAccept({
      category: v.category,
      questionText: v.questionText,
      answerFormat: v.answerFormat,
      optionA: v.optionA,
      optionB: v.optionB,
      optionC: v.optionC,
      optionD: v.optionD,
      correctOption: v.correctOption,
      correctAnswer: v.correctAnswer,
      correctAnswerUnit: v.correctAnswerUnit,
      orderingItems: v.orderingItems,
      orderingDirection: v.orderingDirection,
      orderingItemValues: v.orderingItemValues,
      imageUrl: img?.url,
      imageSource: img?.source,
      imageAttribution: img?.attribution,
    });
    setOpen(false);
    setState("idle");
    setVariations([]);
  };

  const editSelected = async (instruction: string) => {
    if (selectedIdx === null) return;
    const question = variations[selectedIdx];
    setState("loading");
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
        setState("viewing");
      } else {
        setConversation(data.text || "No response from AI.");
        setState("idle");
      }
    } catch {
      setConversation("Something went wrong. Try again.");
      setState("idle");
    }
  };

  const openImageModal = (idx: number) => {
    setImageModalIdx(idx);
    setImageModalQuery(variations[idx]?.imageSearchTerm || "");
    setImageModalOpen(true);
  };

  const onImageSelected = (img: { url: string; source: string; attribution?: string }) => {
    if (imageModalIdx === null) return;
    setCardImages((prev) => ({
      ...prev,
      [imageModalIdx]: img,
    }));
    setImageModalOpen(false);
    setImageModalIdx(null);
  };

  return (
    <div>
      {open && (
        <div className="mt-3 card p-4 bg-[#0f0f23] space-y-3">
          {/* Brainstorm: prompt + chips */}
          {mode === "brainstorm" && state === "idle" && (
            <>
              {conversation && (
                <div className="p-3 text-sm text-[#e8e8e8] bg-[#16162a] rounded-lg">
                  <p className="whitespace-pre-wrap">{conversation}</p>
                </div>
              )}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") generate(prompt || "Surprise me with something fun");
                  }}
                  className="input-field flex-1 text-sm"
                  placeholder="What kind of question?"
                />
                <button
                  onClick={() => generate(prompt || "Surprise me with something fun")}
                  className="btn-primary text-sm"
                >
                  Go
                </button>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {SUGGESTION_CHIPS.map((chip) => (
                  <button
                    key={chip}
                    onClick={() => generate(chip)}
                    className="text-xs px-2 py-1 rounded-full bg-[#1e3a5f] text-[#a0a0b8] hover:text-white hover:bg-[#254a73] transition-all"
                  >
                    {chip}
                  </button>
                ))}
              </div>
            </>
          )}

          {/* Loading skeleton */}
          {state === "loading" && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="rounded-lg border border-[#1e3a5f] bg-[#16162a] p-2 animate-pulse"
                >
                  <div className="h-2 w-12 bg-[#1e3a5f] rounded mb-2" />
                  <div className="h-3 w-3/4 bg-[#1e3a5f] rounded mb-1.5" />
                  <div className="h-3 w-1/2 bg-[#1e3a5f] rounded" />
                </div>
              ))}
            </div>
          )}

          {/* Viewing cards */}
          {state === "viewing" && (
            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {variations.map((v, i) => (
                  <QuestionPreviewCard
                    key={i}
                    {...v}
                    compact
                    onSelect={() => {
                      setSelectedIdx(i);
                      setState("selected");
                    }}
                    imageUrl={cardImages[i]?.url}
                    onImageClick={() => openImageModal(i)}
                  />
                ))}
              </div>
              <div className="flex gap-2 justify-center">
                <button
                  onClick={() =>
                    mode === "brainstorm"
                      ? generate(prompt || "Surprise me with something fun")
                      : generate("")
                  }
                  className="text-xs px-2 py-1 rounded-full bg-[#1e3a5f] text-[#a0a0b8] hover:text-white transition-all"
                >
                  New set
                </button>
              </div>
            </div>
          )}

          {/* Selected — confirm or edit further */}
          {state === "selected" && selectedIdx !== null && (
            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {variations.map((v, i) => (
                  <div key={i} className={i !== selectedIdx ? "opacity-40" : ""}>
                    <QuestionPreviewCard
                      {...v}
                      selected={i === selectedIdx}
                      compact
                      onSelect={() => setSelectedIdx(i)}
                      imageUrl={cardImages[i]?.url}
                      onImageClick={() => openImageModal(i)}
                    />
                  </div>
                ))}
              </div>
              <div className="flex gap-2 justify-center flex-wrap">
                <button
                  onClick={() => acceptCard(selectedIdx)}
                  className="btn-primary text-sm"
                >
                  Use This Question
                </button>
                <button
                  onClick={() => {
                    setEditText("");
                    setState("editing");
                  }}
                  className="btn-secondary text-xs"
                >
                  Refine further
                </button>
                <button
                  onClick={() =>
                    mode === "brainstorm"
                      ? generate(prompt || "Surprise me with something fun")
                      : generate("")
                  }
                  className="text-xs px-2 py-1 rounded-full bg-[#1e3a5f] text-[#a0a0b8] hover:text-white transition-all"
                >
                  New set
                </button>
              </div>
            </div>
          )}

          {/* Editing — chips + custom edit */}
          {state === "editing" && selectedIdx !== null && (
            <div className="space-y-3">
              <div className="max-w-xs mx-auto">
                <QuestionPreviewCard
                  {...variations[selectedIdx]}
                  selected
                  compact
                  imageUrl={cardImages[selectedIdx]?.url}
                  onImageClick={() => openImageModal(selectedIdx)}
                />
              </div>
              <div className="flex flex-wrap gap-1.5 justify-center">
                {EDIT_CHIPS.map((chip) => (
                  <button
                    key={chip}
                    onClick={() => editSelected(chip)}
                    className="text-xs px-2 py-1 rounded-full bg-[#1e3a5f] text-[#a0a0b8] hover:text-white hover:bg-[#254a73] transition-all"
                  >
                    {chip}
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={editText}
                  onChange={(e) => setEditText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && editText.trim()) editSelected(editText);
                  }}
                  className="input-field flex-1 text-sm"
                  placeholder="Custom edit request..."
                />
                <button
                  onClick={() => editText.trim() && editSelected(editText)}
                  disabled={!editText.trim()}
                  className="btn-primary text-sm"
                >
                  Go
                </button>
              </div>
              <button
                onClick={() => setState("selected")}
                className="text-xs text-[#a0a0b8] hover:text-white w-full text-center"
              >
                Back
              </button>
            </div>
          )}
        </div>
      )}

      <ImageSearchModal
        isOpen={imageModalOpen}
        onClose={() => {
          setImageModalOpen(false);
          setImageModalIdx(null);
        }}
        onSelect={onImageSelected}
        initialQuery={imageModalQuery}
      />
    </div>
  );
}

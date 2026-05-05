"use client";

import { useState, useEffect } from "react";
import ImageAttachment from "./ImageAttachment";
import CategorySelect from "./CategorySelect";
import AssistButton, { type AssistedQuestion } from "./AssistButton";
import Spinner from "@/components/ui/Spinner";

interface QuestionSubmitFormProps {
  roundId: string;
  leaguePlayerId: string;
  leagueId?: string;
  onSubmitted: () => void;
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
  correctAnswerUnit?: string | null;
  orderingItems?: string;
  orderingCorrectOrder?: string;
  orderingDirection?: string;
  orderingItemValues?: string;
  imageUrl?: string;
  imageSource?: string;
  imageAttribution?: string;
  useOnNextRound?: boolean;
  isReplay?: boolean;
  originalQuestionId?: string | null;
  updatedAt?: string;
}

interface CustomCategory {
  id: string;
  name: string;
  usageCount: number;
}

export default function QuestionSubmitForm({
  roundId,
  leaguePlayerId,
  leagueId,
  onSubmitted,
}: QuestionSubmitFormProps) {
  const [category, setCategory] = useState("");
  const [customCategories, setCustomCategories] = useState<CustomCategory[]>([]);
  const [questionText, setQuestionText] = useState("");
  const [answerFormat, setAnswerFormat] = useState("multiple_choice");
  const [optionA, setOptionA] = useState("");
  const [optionB, setOptionB] = useState("");
  const [optionC, setOptionC] = useState("");
  const [optionD, setOptionD] = useState("");
  const [correctOption, setCorrectOption] = useState("");
  const [correctAnswer, setCorrectAnswer] = useState("");
  const [correctAnswerUnit, setCorrectAnswerUnit] = useState("");
  // Ordering format
  const [orderingDirection, setOrderingDirection] = useState("");
  const [orderingItem1, setOrderingItem1] = useState("");
  const [orderingItem2, setOrderingItem2] = useState("");
  const [orderingItem3, setOrderingItem3] = useState("");
  const [orderingItem4, setOrderingItem4] = useState("");
  const [showFourthItem, setShowFourthItem] = useState(false);
  // Optional ordering value per item (year, population, etc.). Free-text — when present,
  // server validates that values agree with the direction and equal values count as ties.
  const [orderingValue1, setOrderingValue1] = useState("");
  const [orderingValue2, setOrderingValue2] = useState("");
  const [orderingValue3, setOrderingValue3] = useState("");
  const [orderingValue4, setOrderingValue4] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [draftLoaded, setDraftLoaded] = useState(false);
  const [autoSubmitDraftId, setAutoSubmitDraftId] = useState<string | null>(null);
  const [originalQuestionId, setOriginalQuestionId] = useState<string | null>(null);
  const [recentDrafts, setRecentDrafts] = useState<Draft[]>([]);
  const [skippedFreeTextDraft, setSkippedFreeTextDraft] = useState(false);
  const [imageUrl, setImageUrl] = useState("");
  const [imageSource, setImageSource] = useState("");
  const [imageAttribution, setImageAttribution] = useState("");
  const [assistOpen, setAssistOpen] = useState(false);

  // Difficulty check
  const [difficultyResult, setDifficultyResult] = useState<{
    difficulty: "easy" | "medium" | "hard";
    reasoning: string;
    categoryMismatch?: boolean;
    categoryNote?: string;
  } | null>(null);
  const [difficultyLoading, setDifficultyLoading] = useState(false);

  // Load drafts (auto-submit + recent for chips)
  useEffect(() => {
    if (draftLoaded) return;
    // Consume any "load this draft into the form" signal from the workshop handoff.
    let preferredDraftId: string | null = null;
    if (typeof window !== "undefined" && roundId) {
      const key = `bwiz:loadDraft:${roundId}`;
      preferredDraftId = window.localStorage.getItem(key);
      if (preferredDraftId) window.localStorage.removeItem(key);
    }
    fetch("/api/questions/drafts")
      .then((r) => r.json())
      .then((drafts: Draft[]) => {
        if (!Array.isArray(drafts)) return;

        // Most recent non-free-text drafts for the chip strip
        const recent = drafts
          .filter((d) => d.answerFormat && d.answerFormat !== "free_text" && d.questionText)
          .slice(0, 3);
        setRecentDrafts(recent);

        // Workshop handoff: prefer a specific draft if signaled.
        const handoffDraft = preferredDraftId
          ? drafts.find((d) => d.id === preferredDraftId)
          : null;
        const autoSubmitDraft = handoffDraft || drafts.find((d) => d.useOnNextRound);

        // Edge case: auto-submit draft is free_text (deprecated). Skip it,
        // clear the flag, surface a one-line warning.
        if (autoSubmitDraft && autoSubmitDraft.answerFormat === "free_text") {
          fetch("/api/questions/drafts", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id: autoSubmitDraft.id, useOnNextRound: false }),
          }).catch(() => {});
          setSkippedFreeTextDraft(true);
        } else if (autoSubmitDraft && autoSubmitDraft.category && autoSubmitDraft.answerFormat) {
          setAutoSubmitDraftId(autoSubmitDraft.id);
          if (autoSubmitDraft.originalQuestionId) {
            setOriginalQuestionId(autoSubmitDraft.originalQuestionId);
          }
          setCategory(autoSubmitDraft.category);
          setQuestionText(autoSubmitDraft.questionText || "");
          setAnswerFormat(autoSubmitDraft.answerFormat);
          if (autoSubmitDraft.answerFormat === "multiple_choice") {
            setOptionA(autoSubmitDraft.optionA || "");
            setOptionB(autoSubmitDraft.optionB || "");
            setOptionC(autoSubmitDraft.optionC || "");
            setOptionD(autoSubmitDraft.optionD || "");
            setCorrectOption(autoSubmitDraft.correctOption || "");
          } else if (autoSubmitDraft.answerFormat === "ordering" && autoSubmitDraft.orderingItems) {
            const rawItems = JSON.parse(autoSubmitDraft.orderingItems);
            const order = autoSubmitDraft.orderingCorrectOrder
              ? JSON.parse(autoSubmitDraft.orderingCorrectOrder)
              : rawItems.map((_: string, i: number) => i + 1);
            const rawValues: Array<string | number | null> | null = autoSubmitDraft.orderingItemValues
              ? (() => { try { const a = JSON.parse(autoSubmitDraft.orderingItemValues!); return Array.isArray(a) ? a : null; } catch { return null; } })()
              : null;
            const sorted = order
              .map((pos: number, idx: number) => ({ pos, item: rawItems[idx], value: rawValues?.[idx] ?? null }))
              .sort((a: { pos: number }, b: { pos: number }) => a.pos - b.pos);
            const items = sorted.map((e: { item: string }) => e.item);
            const values = sorted.map((e: { value: string | number | null }) => e.value);
            setOrderingItem1(items[0] || "");
            setOrderingItem2(items[1] || "");
            setOrderingItem3(items[2] || "");
            setOrderingValue1(values[0] != null ? String(values[0]) : "");
            setOrderingValue2(values[1] != null ? String(values[1]) : "");
            setOrderingValue3(values[2] != null ? String(values[2]) : "");
            if (items[3]) {
              setOrderingItem4(items[3]);
              setOrderingValue4(values[3] != null ? String(values[3]) : "");
              setShowFourthItem(true);
            }
            setOrderingDirection(autoSubmitDraft.orderingDirection || "");
          } else {
            setCorrectAnswer(autoSubmitDraft.correctAnswer || "");
            setCorrectAnswerUnit(autoSubmitDraft.correctAnswerUnit || "");
          }
          // price_is_right uses correctAnswer (+ optional correctAnswerUnit)
          if (autoSubmitDraft.imageUrl) {
            setImageUrl(autoSubmitDraft.imageUrl);
            setImageSource(autoSubmitDraft.imageSource || "");
            setImageAttribution(autoSubmitDraft.imageAttribution || "");
          }
        }
        setDraftLoaded(true);
      })
      .catch(() => setDraftLoaded(true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftLoaded, roundId]);

  // Load custom categories for this league
  useEffect(() => {
    if (!leagueId) return;
    fetch(`/api/leagues/${leagueId}/categories`)
      .then((r) => r.json())
      .then((data) => {
        if (data.custom) setCustomCategories(data.custom);
      })
      .catch(() => {});
  }, [leagueId]);

  const handleSubmit = async () => {
    if (!category) {
      setError("Select a category");
      return;
    }
    if (!questionText.trim()) {
      setError("Enter your question");
      return;
    }
    if (answerFormat === "multiple_choice") {
      if (!optionA || !optionB || !optionC || !optionD) {
        setError("Provide all 4 options");
        return;
      }
      if (!correctOption) {
        setError("Select the correct answer");
        return;
      }
    } else if (answerFormat === "price_is_right") {
      if (!correctAnswer.trim() || isNaN(parseFloat(correctAnswer.trim()))) {
        setError("Provide a valid numeric correct answer");
        return;
      }
    } else if (answerFormat === "ordering") {
      if (!orderingDirection.trim()) {
        setError("Provide a direction (e.g. 'most to least')");
        return;
      }
      const pairs = [
        [orderingItem1, orderingValue1],
        [orderingItem2, orderingValue2],
        [orderingItem3, orderingValue3],
        [orderingItem4, orderingValue4],
      ].filter(([item]) => item);
      if (pairs.length < 3) {
        setError("Provide at least 3 items");
        return;
      }
      if (pairs.some(([, val]) => !val.trim())) {
        setError("Provide a value for every item — values are how the grader checks the order");
        return;
      }
    }

    setSubmitting(true);
    setError("");

    try {
      const body: Record<string, unknown> = {
        roundId,
        leaguePlayerId,
        category,
        questionText: questionText.trim(),
        answerFormat,
      };

      if (originalQuestionId) {
        body.originalQuestionId = originalQuestionId;
      }

      if (imageUrl) {
        body.imageUrl = imageUrl;
        body.imageSource = imageSource;
        body.imageAttribution = imageAttribution;
      }

      if (answerFormat === "multiple_choice") {
        body.optionA = optionA;
        body.optionB = optionB;
        body.optionC = optionC;
        body.optionD = optionD;
        body.correctOption = correctOption;
      } else if (answerFormat === "price_is_right") {
        body.correctAnswer = correctAnswer.trim();
        if (correctAnswerUnit.trim()) body.correctAnswerUnit = correctAnswerUnit.trim();
      } else if (answerFormat === "ordering") {
        const items: string[] = [];
        const rawValues: string[] = [];
        for (const [item, val] of [
          [orderingItem1, orderingValue1],
          [orderingItem2, orderingValue2],
          [orderingItem3, orderingValue3],
          [orderingItem4, orderingValue4],
        ] as const) {
          if (item) {
            items.push(item);
            rawValues.push(val.trim());
          }
        }
        body.orderingItems = items;
        body.orderingCorrectOrder = items.map((_, i) => i + 1);
        body.orderingDirection = orderingDirection.trim();
        body.orderingItemValues = rawValues.map((v) => {
          const n = Number(v);
          return !isNaN(n) && v.trim() !== "" ? n : v;
        });
      }

      const res = await fetch("/api/questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to submit question");
      }

      // Clear auto-submit flag on the draft that was used
      if (autoSubmitDraftId) {
        fetch("/api/questions/drafts", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: autoSubmitDraftId, useOnNextRound: false }),
        }).catch(() => {});
      }

      setImageUrl("");
      setImageSource("");
      setImageAttribution("");
      onSubmitted();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit");
    } finally {
      setSubmitting(false);
    }
  };

  // Debounced auto-difficulty check.
  const orderingItemsForCheck = [orderingItem1, orderingItem2, orderingItem3].filter(Boolean);
  const hasAnswerForDifficulty =
    (answerFormat === "multiple_choice" && optionA && optionB && optionC && optionD && correctOption) ||
    (answerFormat === "price_is_right" && correctAnswer.trim() !== "") ||
    (answerFormat === "ordering" && orderingItemsForCheck.length >= 3 && orderingDirection);
  const shouldAutoCheck = !!category && questionText.trim().length >= 20 && hasAnswerForDifficulty;

  useEffect(() => {
    if (!shouldAutoCheck) {
      setDifficultyResult(null);
      setDifficultyLoading(false);
      return;
    }
    const controller = new AbortController();
    const timeout = setTimeout(async () => {
      setDifficultyLoading(true);
      try {
        const res = await fetch("/api/questions/difficulty", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            category,
            questionText: questionText.trim(),
            leagueId,
            answerFormat,
            correctAnswer: correctAnswer.trim() || undefined,
            correctOption: correctOption || undefined,
            options:
              answerFormat === "multiple_choice"
                ? { optionA, optionB, optionC, optionD }
                : undefined,
          }),
          signal: controller.signal,
        });
        const data = await res.json();
        setDifficultyResult(data);
      } catch {
        // ignore aborts and errors
      } finally {
        setDifficultyLoading(false);
      }
    }, 1500);
    return () => {
      clearTimeout(timeout);
      controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    shouldAutoCheck,
    category,
    questionText,
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
    leagueId,
  ]);

  const fillFromDraft = (draft: Draft) => {
    let orderingItems: string[] | undefined;
    let orderingValues: Array<string | number | null> | undefined;
    if (draft.orderingItems) {
      try {
        const items = JSON.parse(draft.orderingItems);
        if (Array.isArray(items)) {
          orderingItems = items;
        }
      } catch {}
    }
    if (draft.orderingItemValues) {
      try {
        const vals = JSON.parse(draft.orderingItemValues);
        if (Array.isArray(vals)) orderingValues = vals;
      } catch {}
    }
    // Drafts may carry a replay link that needs to survive into the submission.
    setOriginalQuestionId(draft.originalQuestionId || null);
    fillFromQuestion({
      category: draft.category || "General Knowledge",
      questionText: draft.questionText || "",
      answerFormat: draft.answerFormat || "multiple_choice",
      optionA: draft.optionA || undefined,
      optionB: draft.optionB || undefined,
      optionC: draft.optionC || undefined,
      optionD: draft.optionD || undefined,
      correctOption: draft.correctOption || undefined,
      correctAnswer: draft.correctAnswer || undefined,
      orderingItems,
      orderingDirection: draft.orderingDirection || undefined,
      orderingItemValues: orderingValues,
      imageUrl: draft.imageUrl,
      imageSource: draft.imageSource,
      imageAttribution: draft.imageAttribution,
    });
  };

  const fillFromQuestion = (q: AssistedQuestion) => {
    setCategory(q.category);
    setQuestionText(q.questionText);
    setAnswerFormat(q.answerFormat);
    if (q.answerFormat === "multiple_choice") {
      setOptionA(q.optionA || "");
      setOptionB(q.optionB || "");
      setOptionC(q.optionC || "");
      setOptionD(q.optionD || "");
      setCorrectOption(q.correctOption || "");
    } else if (q.answerFormat === "ordering") {
      const rawItems = q.orderingItems || [];
      const rawValues = q.orderingItemValues;
      // Server contract: orderingItems are already in correct order.
      const items = rawItems;
      const values = rawValues || [];
      setOrderingItem1(items[0] || "");
      setOrderingItem2(items[1] || "");
      setOrderingItem3(items[2] || "");
      setOrderingItem4(items[3] || "");
      setOrderingValue1(values[0] != null ? String(values[0]) : "");
      setOrderingValue2(values[1] != null ? String(values[1]) : "");
      setOrderingValue3(values[2] != null ? String(values[2]) : "");
      setOrderingValue4(values[3] != null ? String(values[3]) : "");
      setShowFourthItem(items.length >= 4);
      setOrderingDirection(q.orderingDirection || "");
    } else {
      setCorrectAnswer(q.correctAnswer || "");
      setCorrectAnswerUnit(q.correctAnswerUnit || "");
    }
    if (q.imageUrl) {
      setImageUrl(q.imageUrl);
      setImageSource(q.imageSource || "");
      setImageAttribution(q.imageAttribution || "");
    }
  };

  return (
    <div className="space-y-4">
      <div className="card p-6">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-[#e94560]">You&apos;re Up!</h2>
            <p className="text-sm text-[#a0a0b8]">Submit today&apos;s question</p>
          </div>
        </div>

        {skippedFreeTextDraft && (
          <div className="mb-3 text-xs text-amber-300 bg-amber-500/10 border border-amber-500/30 rounded-lg p-2">
            A saved free-text question was skipped — open the bank to convert it.
          </div>
        )}

        {/* Alt-start row: pick up a draft or jump to the workshop */}
        <div className="mb-4 pb-3 border-b border-[#1e2a4a]">
          <div className="flex items-center justify-between gap-2 mb-2">
            <span className="text-xs text-[#666680]">
              {recentDrafts.length > 0 ? "Select one from your Question Bank" : "Start from scratch or"}
            </span>
            <a
              href={
                leagueId && roundId
                  ? `/questions/workshop?leagueId=${encodeURIComponent(leagueId)}&roundId=${encodeURIComponent(roundId)}&leaguePlayerId=${encodeURIComponent(leaguePlayerId)}&returnTo=submit`
                  : "/questions/workshop"
              }
              className="text-xs text-[#4fc3f7] hover:text-white transition-colors font-medium whitespace-nowrap"
            >
              Workshop →
            </a>
          </div>
          {recentDrafts.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {recentDrafts.map((d) => (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => fillFromDraft(d)}
                  className="text-xs px-2 py-1 rounded-full border border-solid border-[#2a5a8f] text-[#a0a0b8] hover:border-[#4a7abf] hover:text-white transition-all max-w-full truncate"
                  title={d.questionText || ""}
                >
                  {d.questionText || "Untitled"}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Brainstorm toggle row — sits above the form fields */}
        <div className="mb-4 flex items-center justify-between gap-3 px-1">
          <div className="flex items-center gap-2 min-w-0">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="currentColor"
              className="w-5 h-5 flex-shrink-0 text-[#e94560]"
              aria-hidden="true"
            >
              <path d="M12 2.5l1.6 4.6 4.6 1.6-4.6 1.6L12 14.9l-1.6-4.6L5.8 8.7l4.6-1.6L12 2.5zM18.5 13.5l.9 2.6 2.6.9-2.6.9-.9 2.6-.9-2.6-2.6-.9 2.6-.9.9-2.6zM5.5 15l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7.7-2z" />
            </svg>
            <span className="text-sm font-medium text-white">Help me brainstorm</span>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={assistOpen}
            onClick={() => setAssistOpen(!assistOpen)}
            className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors ${
              assistOpen ? "bg-[#e94560]" : "bg-[#1e3a5f]"
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                assistOpen ? "translate-x-6" : "translate-x-1"
              }`}
            />
          </button>
        </div>

        {assistOpen ? (
          <div className="mb-4">
            <AssistButton
              questionText={questionText}
              category={category}
              answerFormat={answerFormat}
              optionA={optionA}
              optionB={optionB}
              optionC={optionC}
              optionD={optionD}
              correctOption={correctOption}
              correctAnswer={correctAnswer}
              orderingItem1={orderingItem1}
              orderingItem2={orderingItem2}
              orderingItem3={orderingItem3}
              orderingDirection={orderingDirection}
              open={assistOpen}
              onOpenChange={setAssistOpen}
              onAccept={(q) => {
                setOriginalQuestionId(null);
                fillFromQuestion(q);
                setAssistOpen(false);
              }}
            />
          </div>
        ) : (
          <div className="mb-4 space-y-4">
            {/* Category */}
            <div>
              <label className="block text-sm font-medium text-[#a0a0b8] mb-1.5">
                Category *
              </label>
              <CategorySelect
                value={category}
                customCategories={customCategories}
                onChange={setCategory}
                onError={setError}
              />
            </div>

            {/* Question Text with image attach below */}
            <div>
              <label className="block text-sm font-medium text-[#a0a0b8] mb-1.5">
                Question *
              </label>
              <textarea
                value={questionText}
                onChange={(e) => setQuestionText(e.target.value)}
                className="input-field min-h-[80px] w-full"
                placeholder="Enter your trivia question..."
              />
              <div className="mt-2">
                {imageUrl ? (
                  <ImageAttachment
                    imageUrl={imageUrl}
                    imageSource={imageSource}
                    imageAttribution={imageAttribution}
                    questionText={questionText}
                    onChange={(img) => {
                      if (img) {
                        setImageUrl(img.url);
                        setImageSource(img.source);
                        setImageAttribution(img.attribution || "");
                      } else {
                        setImageUrl("");
                        setImageSource("");
                        setImageAttribution("");
                      }
                    }}
                  />
                ) : (
                  <ImageAttachment
                    compact
                    iconOnly
                    imageUrl={imageUrl}
                    imageSource={imageSource}
                    imageAttribution={imageAttribution}
                    questionText={questionText}
                    onChange={(img) => {
                      if (img) {
                        setImageUrl(img.url);
                        setImageSource(img.source);
                        setImageAttribution(img.attribution || "");
                      } else {
                        setImageUrl("");
                        setImageSource("");
                        setImageAttribution("");
                      }
                    }}
                  />
                )}
              </div>
            </div>
          </div>
        )}

        {/* Answer Format */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-[#a0a0b8] mb-1.5">
            Answer Format
          </label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => { setAnswerFormat("multiple_choice"); }}
              className={`flex-1 py-2 px-3 rounded-lg border text-sm ${
                answerFormat === "multiple_choice"
                  ? "border-[#e94560] bg-[#e94560]/10 text-white"
                  : "border-[#1e3a5f] text-[#a0a0b8]"
              }`}
            >
              Multiple Choice
            </button>
            <button
              type="button"
              onClick={() => { setAnswerFormat("price_is_right"); }}
              className={`flex-1 py-2 px-3 rounded-lg border text-sm ${
                answerFormat === "price_is_right"
                  ? "border-[#e94560] bg-[#e94560]/10 text-white"
                  : "border-[#1e3a5f] text-[#a0a0b8]"
              }`}
            >
              Closest Guess
            </button>
            <button
              type="button"
              onClick={() => { setAnswerFormat("ordering"); }}
              className={`flex-1 py-2 px-3 rounded-lg border text-sm ${
                answerFormat === "ordering"
                  ? "border-[#e94560] bg-[#e94560]/10 text-white"
                  : "border-[#1e3a5f] text-[#a0a0b8]"
              }`}
            >
              Ordering
            </button>
          </div>
        </div>

        {/* Multiple Choice Options */}
        {answerFormat === "multiple_choice" && (
          <div className="space-y-3 mb-4">
            {[
              { key: "A", value: optionA, setter: setOptionA },
              { key: "B", value: optionB, setter: setOptionB },
              { key: "C", value: optionC, setter: setOptionC },
              { key: "D", value: optionD, setter: setOptionD },
            ].map((opt) => (
              <div key={opt.key} className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setCorrectOption(opt.key)}
                  className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold transition-all ${
                    correctOption === opt.key
                      ? "bg-emerald-500 text-white"
                      : "bg-[#1e3a5f] text-[#a0a0b8]"
                  }`}
                >
                  {opt.key}
                </button>
                <input
                  type="text"
                  value={opt.value}
                  onChange={(e) => opt.setter(e.target.value)}
                  className="input-field flex-1"
                  placeholder={`Option ${opt.key}`}
                />
              </div>
            ))}
            <p className="text-xs text-[#666680]">
              Click the letter to mark the correct answer (green = correct)
            </p>
          </div>
        )}

        {/* Closest Guess Answer */}
        {answerFormat === "price_is_right" && (
          <div className="space-y-3 mb-4">
            <div className="flex gap-2">
              <div className="flex-1">
                <label className="block text-sm font-medium text-[#a0a0b8] mb-1">
                  Correct Answer (number) *
                </label>
                <input
                  type="number"
                  value={correctAnswer}
                  onChange={(e) => setCorrectAnswer(e.target.value)}
                  className="input-field"
                  placeholder="e.g. 1907"
                  step="any"
                />
              </div>
              <div className="w-32">
                <label className="block text-sm font-medium text-[#a0a0b8] mb-1">
                  Unit
                </label>
                <input
                  type="text"
                  value={correctAnswerUnit}
                  onChange={(e) => setCorrectAnswerUnit(e.target.value)}
                  className="input-field"
                  placeholder="miles, tons…"
                  maxLength={24}
                />
              </div>
            </div>
            <p className="text-xs text-[#666680]">
              Players guess a number — closest to the answer wins (over or under). The unit is shown to answerers so guesses use the same scale.
            </p>
          </div>
        )}

        {/* Ordering Items */}
        {answerFormat === "ordering" && (
          <div className="space-y-3 mb-4">
            <div>
              <label className="block text-sm font-medium text-[#a0a0b8] mb-1">
                Direction *
              </label>
              <select
                value={orderingDirection}
                onChange={(e) => setOrderingDirection(e.target.value)}
                className="input-field"
              >
                <option value="">Select direction...</option>
                <option value="most to least">Most to least</option>
                <option value="least to most">Least to most</option>
                <option value="earliest to latest">Earliest to latest</option>
                <option value="latest to earliest">Latest to earliest</option>
                <option value="largest to smallest">Largest to smallest</option>
                <option value="smallest to largest">Smallest to largest</option>
                <option value="oldest to newest">Oldest to newest</option>
                <option value="newest to oldest">Newest to oldest</option>
                <option value="highest to lowest">Highest to lowest</option>
                <option value="lowest to highest">Lowest to highest</option>
                <option value="northernmost to southernmost">Northernmost to southernmost</option>
                <option value="alphabetical (A to Z)">Alphabetical (A to Z)</option>
              </select>
            </div>
            <p className="text-xs text-[#666680]">
              Enter items in the correct order (1st = position 1). Values are optional; when supplied, equal values count as ties when scoring.
            </p>
            {[
              { n: 1, value: orderingItem1, setter: setOrderingItem1, val: orderingValue1, valSetter: setOrderingValue1 },
              { n: 2, value: orderingItem2, setter: setOrderingItem2, val: orderingValue2, valSetter: setOrderingValue2 },
              { n: 3, value: orderingItem3, setter: setOrderingItem3, val: orderingValue3, valSetter: setOrderingValue3 },
            ].map((item) => (
              <div key={item.n} className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-[#1e3a5f] text-[#a0a0b8] flex items-center justify-center text-xs font-bold">
                  {item.n}
                </span>
                <input
                  type="text"
                  value={item.value}
                  onChange={(e) => item.setter(e.target.value)}
                  className="input-field flex-1"
                  placeholder={`Item ${item.n}`}
                />
                <input
                  type="text"
                  value={item.val}
                  onChange={(e) => item.valSetter(e.target.value)}
                  className="input-field w-24"
                  placeholder="Value"
                />
              </div>
            ))}
            {showFourthItem ? (
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-[#1e3a5f] text-[#a0a0b8] flex items-center justify-center text-xs font-bold">
                  4
                </span>
                <input
                  type="text"
                  value={orderingItem4}
                  onChange={(e) => setOrderingItem4(e.target.value)}
                  className="input-field flex-1"
                  placeholder="Item 4"
                />
                <input
                  type="text"
                  value={orderingValue4}
                  onChange={(e) => setOrderingValue4(e.target.value)}
                  className="input-field w-24"
                  placeholder="Value"
                />
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setShowFourthItem(true)}
                className="text-sm text-[#4fc3f7] hover:text-white transition-colors font-medium"
              >
                + Add 4th item
              </button>
            )}
          </div>
        )}

        {/* Category mismatch warning (load-bearing) */}
        {difficultyResult?.categoryMismatch && difficultyResult.categoryNote && (
          <div className="mb-3 p-3 rounded-lg border text-sm bg-amber-500/10 border-amber-500/30 text-amber-300">
            <span className="font-bold">Category check:</span>{" "}
            That doesn&apos;t look quite right — {difficultyResult.categoryNote}
          </div>
        )}

        {/* Inline difficulty reasoning — surfaced once the auto-check completes */}
        {difficultyResult?.reasoning && (
          <div
            className={`mb-3 p-3 rounded-lg border text-sm ${
              difficultyResult.difficulty === "easy"
                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
                : difficultyResult.difficulty === "hard"
                  ? "border-red-500/30 bg-red-500/10 text-red-200"
                  : "border-amber-500/30 bg-amber-500/10 text-amber-200"
            }`}
          >
            <span className="font-bold uppercase text-xs tracking-wide mr-2">
              {difficultyResult.difficulty}
            </span>
            <span className="text-[#e8e8e8]">{difficultyResult.reasoning}</span>
          </div>
        )}

        {error && (
          <div className="text-red-400 text-sm bg-red-500/10 rounded-lg p-3 mb-4">
            {error}
          </div>
        )}

        <div className="flex items-center gap-3">
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="btn-primary flex-1"
          >
            {submitting ? <span className="inline-flex items-center justify-center gap-2"><Spinner /> Submitting...</span> : "Submit Question"}
          </button>
          {difficultyLoading && (
            <span
              className="flex-shrink-0 text-xs font-bold uppercase px-2 py-1.5 rounded-lg border border-[#1e3a5f] text-[#666680]"
              title="Checking difficulty..."
            >
              ...
            </span>
          )}
        </div>

        {draftLoaded && (
          <button
            type="button"
            onClick={() => {
              if (!window.confirm("Clear all fields? This won't delete saved drafts.")) return;
              setCategory("");
              setQuestionText("");
              setAnswerFormat("multiple_choice");
              setOptionA("");
              setOptionB("");
              setOptionC("");
              setOptionD("");
              setCorrectOption("");
              setCorrectAnswer("");
              setOrderingDirection("");
              setOrderingItem1("");
              setOrderingItem2("");
              setOrderingItem3("");
              setOrderingItem4("");
              setOrderingValue1("");
              setOrderingValue2("");
              setOrderingValue3("");
              setOrderingValue4("");
              setShowFourthItem(false);
              setImageUrl("");
              setImageSource("");
              setImageAttribution("");
              setDifficultyResult(null);
              setOriginalQuestionId(null);
              setError("");
            }}
            className="mt-3 text-xs text-[#666680] hover:text-[#a0a0b8] transition-colors"
          >
            Clear form
          </button>
        )}
      </div>
    </div>
  );
}

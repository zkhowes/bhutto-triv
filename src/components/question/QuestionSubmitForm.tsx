"use client";

import { useState, useEffect } from "react";
import { CATEGORIES, isDefaultCategory } from "@/lib/constants";
import WorkshopEmbed from "./WorkshopEmbed";
import ImageAttachment from "./ImageAttachment";

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
  orderingItems?: string;
  orderingCorrectOrder?: string;
  orderingDirection?: string;
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
  const [newCategoryInput, setNewCategoryInput] = useState("");
  const [showNewCategoryInput, setShowNewCategoryInput] = useState(false);
  const [questionText, setQuestionText] = useState("");
  const [answerFormat, setAnswerFormat] = useState("multiple_choice");
  const [optionA, setOptionA] = useState("");
  const [optionB, setOptionB] = useState("");
  const [optionC, setOptionC] = useState("");
  const [optionD, setOptionD] = useState("");
  const [correctOption, setCorrectOption] = useState("");
  const [correctAnswer, setCorrectAnswer] = useState("");
  const [acceptableAnswers, setAcceptableAnswers] = useState("");
  // Ordering format
  const [orderingDirection, setOrderingDirection] = useState("");
  const [orderingItem1, setOrderingItem1] = useState("");
  const [orderingItem2, setOrderingItem2] = useState("");
  const [orderingItem3, setOrderingItem3] = useState("");
  const [orderingItem4, setOrderingItem4] = useState("");
  const [showFourthItem, setShowFourthItem] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [draftLoaded, setDraftLoaded] = useState(false);
  const [autoSubmitDraftId, setAutoSubmitDraftId] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState("");
  const [imageSource, setImageSource] = useState("");
  const [imageAttribution, setImageAttribution] = useState("");

  // AI Workshop
  const [showWorkshop, setShowWorkshop] = useState(false);

  // Difficulty check
  const [difficultyResult, setDifficultyResult] = useState<{
    difficulty: "easy" | "medium" | "hard";
    reasoning: string;
  } | null>(null);
  const [difficultyLoading, setDifficultyLoading] = useState(false);

  // Format suggestion
  const [formatSuggestion, setFormatSuggestion] = useState<{
    suggestedFormat: "multiple_choice" | "price_is_right" | "ordering";
    message: string;
    options?: {
      optionA: string;
      optionB: string;
      optionC: string;
      optionD: string;
      correctOption: string;
    };
    orderingItems?: string[];
    orderingDirection?: string;
  } | null>(null);
  const [formatSuggestionLoading, setFormatSuggestionLoading] = useState(false);
  const [formatSuggestionDismissed, setFormatSuggestionDismissed] = useState(false);

  // Load auto-submit draft
  useEffect(() => {
    if (draftLoaded) return;
    fetch("/api/questions/drafts")
      .then((r) => r.json())
      .then((drafts: Draft[]) => {
        if (!Array.isArray(drafts)) return;
        const autoSubmitDraft = drafts.find(
          (d: Draft) => (d as Draft & { useOnNextRound: boolean }).useOnNextRound
        );
        if (autoSubmitDraft && autoSubmitDraft.category && autoSubmitDraft.answerFormat) {
          setAutoSubmitDraftId(autoSubmitDraft.id);
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
            const items = JSON.parse(autoSubmitDraft.orderingItems);
            setOrderingItem1(items[0] || "");
            setOrderingItem2(items[1] || "");
            setOrderingItem3(items[2] || "");
            if (items[3]) {
              setOrderingItem4(items[3]);
              setShowFourthItem(true);
            }
            setOrderingDirection(autoSubmitDraft.orderingDirection || "");
          } else {
            setCorrectAnswer(autoSubmitDraft.correctAnswer || "");
          }
          // price_is_right uses correctAnswer field same as free_text
          if ((autoSubmitDraft as Draft & { imageUrl?: string }).imageUrl) {
            setImageUrl((autoSubmitDraft as Draft & { imageUrl?: string }).imageUrl!);
            setImageSource((autoSubmitDraft as Draft & { imageSource?: string }).imageSource || "");
            setImageAttribution((autoSubmitDraft as Draft & { imageAttribution?: string }).imageAttribution || "");
          }
        }
        setDraftLoaded(true);
      })
      .catch(() => setDraftLoaded(true));
  }, [draftLoaded]);

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

  const handleNewCategorySubmit = () => {
    const trimmed = newCategoryInput.trim();
    if (!trimmed) return;
    if (trimmed.length > 50) {
      setError("Category name must be 50 characters or less");
      return;
    }
    if (isDefaultCategory(trimmed)) {
      setError(`"${trimmed}" matches a default category. Select it above.`);
      return;
    }
    // Check if it matches an existing custom category (case-insensitive)
    const existing = customCategories.find(
      (c) => c.name.toLowerCase() === trimmed.toLowerCase()
    );
    if (existing) {
      setCategory(existing.name);
    } else {
      setCategory(trimmed);
    }
    setNewCategoryInput("");
    setShowNewCategoryInput(false);
  };

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
      const items = [orderingItem1, orderingItem2, orderingItem3, orderingItem4].filter(Boolean);
      if (items.length < 3) {
        setError("Provide at least 3 items");
        return;
      }
    } else {
      if (!correctAnswer.trim()) {
        setError("Provide the correct answer");
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
      } else if (answerFormat === "ordering") {
        const items = [orderingItem1, orderingItem2, orderingItem3, orderingItem4].filter(Boolean);
        body.orderingItems = items;
        body.orderingCorrectOrder = items.map((_, i) => i + 1);
        body.orderingDirection = orderingDirection.trim();
      } else {
        body.correctAnswer = correctAnswer.trim();
        body.acceptableAnswers = acceptableAnswers
          .split(",")
          .map((a) => a.trim())
          .filter(Boolean);
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

  const checkDifficulty = async () => {
    setDifficultyLoading(true);
    setDifficultyResult(null);
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
          options: answerFormat === "multiple_choice" ? { optionA, optionB, optionC, optionD } : undefined,
        }),
      });
      const data = await res.json();
      setDifficultyResult(data);
    } catch {
      setDifficultyResult(null);
    } finally {
      setDifficultyLoading(false);
    }
  };

  const fetchFormatSuggestion = async () => {
    if (answerFormat !== "free_text" || !questionText.trim() || !correctAnswer.trim()) return;
    setFormatSuggestionLoading(true);
    setFormatSuggestion(null);
    setFormatSuggestionDismissed(false);
    try {
      const res = await fetch("/api/questions/suggest-format", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          questionText: questionText.trim(),
          correctAnswer: correctAnswer.trim(),
          acceptableAnswers: acceptableAnswers
            .split(",")
            .map((a) => a.trim())
            .filter(Boolean),
        }),
      });
      const data = await res.json();
      if (data.suggestion) setFormatSuggestion(data.suggestion);
    } catch {
      // Silently fail — suggestion is optional
    } finally {
      setFormatSuggestionLoading(false);
    }
  };

  const applyFormatSuggestion = () => {
    if (!formatSuggestion) return;
    if (formatSuggestion.suggestedFormat === "multiple_choice" && formatSuggestion.options) {
      setAnswerFormat("multiple_choice");
      setOptionA(formatSuggestion.options.optionA);
      setOptionB(formatSuggestion.options.optionB);
      setOptionC(formatSuggestion.options.optionC);
      setOptionD(formatSuggestion.options.optionD);
      setCorrectOption(formatSuggestion.options.correctOption);
    } else if (formatSuggestion.suggestedFormat === "price_is_right") {
      setAnswerFormat("price_is_right");
    } else if (formatSuggestion.suggestedFormat === "ordering") {
      setAnswerFormat("ordering");
      const items = (formatSuggestion as { orderingItems?: string[] }).orderingItems || [];
      setOrderingItem1(items[0] || "");
      setOrderingItem2(items[1] || "");
      setOrderingItem3(items[2] || "");
      setOrderingItem4(items[3] || "");
      setShowFourthItem(items.length >= 4);
      setOrderingDirection((formatSuggestion as { orderingDirection?: string }).orderingDirection || "");
    }
    setFormatSuggestion(null);
  };

  const canCheckDifficulty = category && questionText.trim().length > 10;

  return (
    <div className="space-y-4">
      <div className="card p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-bold text-[#e94560]">
              You&apos;re Up!
            </h2>
            <p className="text-sm text-[#a0a0b8]">Submit today&apos;s question</p>
          </div>
          <button
            onClick={() => setShowWorkshop(!showWorkshop)}
            className="btn-secondary text-sm"
          >
            {showWorkshop ? "Hide Workshop" : "Question Workshop"}
          </button>
        </div>

        {/* AI Workshop */}
        {showWorkshop && (
          <div className="mb-6">
            <WorkshopEmbed
              onSelectQuestion={(q) => {
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
                  const qOrdering = q as typeof q & { orderingItems?: string[]; orderingDirection?: string };
                  const items = qOrdering.orderingItems || [];
                  setOrderingItem1(items[0] || "");
                  setOrderingItem2(items[1] || "");
                  setOrderingItem3(items[2] || "");
                  setOrderingItem4(items[3] || "");
                  setShowFourthItem(items.length >= 4);
                  setOrderingDirection(qOrdering.orderingDirection || "");
                } else {
                  setCorrectAnswer(q.correctAnswer || "");
                  if (q.acceptableAnswers?.length) {
                    setAcceptableAnswers(q.acceptableAnswers.join(", "));
                  }
                }
                const qWithImage = q as typeof q & { imageUrl?: string; imageSource?: string; imageAttribution?: string };
                if (qWithImage.imageUrl) {
                  setImageUrl(qWithImage.imageUrl);
                  setImageSource(qWithImage.imageSource || "");
                  setImageAttribution(qWithImage.imageAttribution || "");
                }
                setShowWorkshop(false);
              }}
            />
          </div>
        )}

        {/* Category */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-[#a0a0b8] mb-1.5">
            Category *
          </label>
          <div className="grid grid-cols-2 gap-2">
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setCategory(cat)}
                className={`text-sm py-2 px-3 rounded-lg border transition-all text-left ${
                  category === cat
                    ? "border-[#e94560] bg-[#e94560]/10 text-white"
                    : "border-[#1e3a5f] text-[#a0a0b8] hover:border-[#2a5a8f]"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Custom Categories */}
          {(customCategories.length > 0 || showNewCategoryInput || (category && !isDefaultCategory(category))) && (
            <div className="mt-3 pt-3 border-t border-[#1e3a5f]">
              <p className="text-xs text-[#666680] mb-2">Custom Categories</p>
              <div className="flex flex-wrap gap-2">
                {customCategories.map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setCategory(cat.name)}
                    className={`text-sm py-1.5 px-3 rounded-lg border border-dashed transition-all ${
                      category === cat.name
                        ? "border-[#e94560] bg-[#e94560]/10 text-white"
                        : "border-[#2a5a8f] text-[#a0a0b8] hover:border-[#4a7abf]"
                    }`}
                  >
                    {cat.name}
                  </button>
                ))}
                {/* Show selected custom category that isn't in the list yet */}
                {category && !isDefaultCategory(category) && !customCategories.some((c) => c.name === category) && (
                  <span className="text-sm py-1.5 px-3 rounded-lg border border-dashed border-[#e94560] bg-[#e94560]/10 text-white">
                    {category}
                  </span>
                )}
              </div>
            </div>
          )}

          {/* New custom category input */}
          {!showNewCategoryInput ? (
            <button
              type="button"
              onClick={() => setShowNewCategoryInput(true)}
              className="mt-3 text-sm text-[#4fc3f7] hover:text-white transition-colors font-medium"
            >
              + Create new category
            </button>
          ) : (
            <div className="mt-2 flex gap-2">
              <input
                type="text"
                value={newCategoryInput}
                onChange={(e) => setNewCategoryInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleNewCategorySubmit();
                  }
                  if (e.key === "Escape") {
                    setShowNewCategoryInput(false);
                    setNewCategoryInput("");
                  }
                }}
                className="input-field flex-1 text-sm"
                placeholder="Category name (max 50 chars)"
                maxLength={50}
                autoFocus
              />
              <button
                type="button"
                onClick={handleNewCategorySubmit}
                className="btn-secondary text-sm px-3"
              >
                Add
              </button>
            </div>
          )}
        </div>

        {/* Question Text */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-[#a0a0b8] mb-1.5">
            Question *
          </label>
          <textarea
            value={questionText}
            onChange={(e) => setQuestionText(e.target.value)}
            className="input-field min-h-[80px]"
            placeholder="Enter your trivia question..."
          />
        </div>

        {/* Image Attachment */}
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

        {/* Answer Format */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-[#a0a0b8] mb-1.5">
            Answer Format
          </label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => { setAnswerFormat("multiple_choice"); setFormatSuggestion(null); setFormatSuggestionDismissed(false); }}
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
              onClick={() => { setAnswerFormat("free_text"); setFormatSuggestion(null); setFormatSuggestionDismissed(false); }}
              className={`flex-1 py-2 px-3 rounded-lg border text-sm ${
                answerFormat === "free_text"
                  ? "border-[#e94560] bg-[#e94560]/10 text-white"
                  : "border-[#1e3a5f] text-[#a0a0b8]"
              }`}
            >
              Free Text
            </button>
            <button
              type="button"
              onClick={() => { setAnswerFormat("price_is_right"); setFormatSuggestion(null); setFormatSuggestionDismissed(false); }}
              className={`flex-1 py-2 px-3 rounded-lg border text-sm ${
                answerFormat === "price_is_right"
                  ? "border-[#e94560] bg-[#e94560]/10 text-white"
                  : "border-[#1e3a5f] text-[#a0a0b8]"
              }`}
            >
              Price is Right
            </button>
            <button
              type="button"
              onClick={() => { setAnswerFormat("ordering"); setFormatSuggestion(null); setFormatSuggestionDismissed(false); }}
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

        {/* Free Text Answer */}
        {answerFormat === "free_text" && (
          <div className="space-y-3 mb-4">
            <div>
              <label className="block text-sm font-medium text-[#a0a0b8] mb-1">
                Correct Answer *
              </label>
              <input
                type="text"
                value={correctAnswer}
                onChange={(e) => setCorrectAnswer(e.target.value)}
                className="input-field"
                placeholder="The exact correct answer"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#a0a0b8] mb-1">
                Also Acceptable (comma-separated)
              </label>
              <input
                type="text"
                value={acceptableAnswers}
                onChange={(e) => setAcceptableAnswers(e.target.value)}
                className="input-field"
                placeholder="alt answer 1, alt answer 2"
              />
            </div>
          </div>
        )}

        {/* Format Suggestion */}
        {answerFormat === "free_text" && correctAnswer.trim() && questionText.trim() && (
          <div className="mb-4">
            {!formatSuggestion && !formatSuggestionDismissed && (
              <button
                type="button"
                onClick={fetchFormatSuggestion}
                disabled={formatSuggestionLoading}
                className="btn-secondary text-sm w-full"
              >
                {formatSuggestionLoading ? "Checking..." : "Suggest Better Format"}
              </button>
            )}
            {formatSuggestion && !formatSuggestionDismissed && (
              <div className="p-3 rounded-lg border border-[#4fc3f7]/30 bg-[#4fc3f7]/10 text-sm">
                <p className="text-[#4fc3f7] font-medium mb-2">
                  {formatSuggestion.message}
                </p>
                {formatSuggestion.suggestedFormat === "multiple_choice" && formatSuggestion.options && (
                  <div className="text-[#a0a0b8] text-xs mb-2 space-y-1">
                    <p>A: {formatSuggestion.options.optionA}</p>
                    <p>B: {formatSuggestion.options.optionB}</p>
                    <p>C: {formatSuggestion.options.optionC}</p>
                    <p>D: {formatSuggestion.options.optionD}</p>
                  </div>
                )}
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={applyFormatSuggestion}
                    className="btn-primary text-sm flex-1"
                  >
                    Convert to {formatSuggestion.suggestedFormat === "multiple_choice" ? "Multiple Choice" : formatSuggestion.suggestedFormat === "ordering" ? "Ordering" : "Price is Right"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormatSuggestionDismissed(true)}
                    className="btn-secondary text-sm"
                  >
                    Keep Free Text
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Price is Right Answer */}
        {answerFormat === "price_is_right" && (
          <div className="space-y-3 mb-4">
            <div>
              <label className="block text-sm font-medium text-[#a0a0b8] mb-1">
                Correct Answer (number) *
              </label>
              <input
                type="number"
                value={correctAnswer}
                onChange={(e) => setCorrectAnswer(e.target.value)}
                className="input-field"
                placeholder="e.g. 116 or 116.5"
                step="any"
              />
            </div>
            <p className="text-xs text-[#666680]">
              Players guess a number — closest without going over wins. If everyone goes over, nobody wins.
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
              Enter items in the correct order (1st = position 1).
            </p>
            {[
              { n: 1, value: orderingItem1, setter: setOrderingItem1 },
              { n: 2, value: orderingItem2, setter: setOrderingItem2 },
              { n: 3, value: orderingItem3, setter: setOrderingItem3 },
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

        {/* Difficulty Check */}
        {canCheckDifficulty && (
          <div className="mb-4">
            <button
              type="button"
              onClick={checkDifficulty}
              disabled={difficultyLoading}
              className="btn-secondary text-sm w-full"
            >
              {difficultyLoading ? "Checking..." : "Check Difficulty"}
            </button>
            {difficultyResult && (
              <div
                className={`mt-2 p-3 rounded-lg border text-sm ${
                  difficultyResult.difficulty === "easy"
                    ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                    : difficultyResult.difficulty === "hard"
                      ? "bg-red-500/10 border-red-500/30 text-red-400"
                      : "bg-amber-500/10 border-amber-500/30 text-amber-400"
                }`}
              >
                <span className="font-bold uppercase">
                  {difficultyResult.difficulty}
                </span>
                <span className="text-[#a0a0b8] ml-2">
                  {difficultyResult.reasoning}
                </span>
              </div>
            )}
          </div>
        )}

        {error && (
          <div className="text-red-400 text-sm bg-red-500/10 rounded-lg p-3 mb-4">
            {error}
          </div>
        )}

        <button
          onClick={handleSubmit}
          disabled={submitting}
          className="btn-primary w-full"
        >
          {submitting ? "Submitting..." : "Submit Question"}
        </button>
      </div>
    </div>
  );
}

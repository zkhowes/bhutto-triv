"use client";

import { useState, useEffect } from "react";
import { CATEGORIES, isDefaultCategory } from "@/lib/constants";
import WorkshopEmbed from "./WorkshopEmbed";

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
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [draftLoaded, setDraftLoaded] = useState(false);
  const [autoSubmitDraftId, setAutoSubmitDraftId] = useState<string | null>(null);

  // AI Workshop
  const [showWorkshop, setShowWorkshop] = useState(false);

  // Difficulty check
  const [difficultyResult, setDifficultyResult] = useState<{
    difficulty: "easy" | "medium" | "hard";
    reasoning: string;
  } | null>(null);
  const [difficultyLoading, setDifficultyLoading] = useState(false);

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
          } else {
            setCorrectAnswer(autoSubmitDraft.correctAnswer || "");
          }
          // price_is_right uses correctAnswer field same as free_text
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

      if (answerFormat === "multiple_choice") {
        body.optionA = optionA;
        body.optionB = optionB;
        body.optionC = optionC;
        body.optionD = optionD;
        body.correctOption = correctOption;
      } else if (answerFormat === "price_is_right") {
        body.correctAnswer = correctAnswer.trim();
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
            {showWorkshop ? "Hide Workshop" : "AI Workshop"}
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
                } else {
                  setCorrectAnswer(q.correctAnswer || "");
                  if (q.acceptableAnswers?.length) {
                    setAcceptableAnswers(q.acceptableAnswers.join(", "));
                  }
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

        {/* Answer Format */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-[#a0a0b8] mb-1.5">
            Answer Format
          </label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setAnswerFormat("multiple_choice")}
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
              onClick={() => setAnswerFormat("free_text")}
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
              onClick={() => setAnswerFormat("price_is_right")}
              className={`flex-1 py-2 px-3 rounded-lg border text-sm ${
                answerFormat === "price_is_right"
                  ? "border-[#e94560] bg-[#e94560]/10 text-white"
                  : "border-[#1e3a5f] text-[#a0a0b8]"
              }`}
            >
              Price is Right
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

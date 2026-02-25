"use client";

import { useState, useEffect } from "react";
import { CATEGORIES } from "@/lib/constants";

interface QuestionSubmitFormProps {
  roundId: string;
  leaguePlayerId: string;
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

export default function QuestionSubmitForm({
  roundId,
  leaguePlayerId,
  onSubmitted,
}: QuestionSubmitFormProps) {
  const [category, setCategory] = useState("");
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

  // AI Workshop
  const [showWorkshop, setShowWorkshop] = useState(false);
  const [chatMessages, setChatMessages] = useState<
    Array<{ role: "user" | "assistant"; content: string }>
  >([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);

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

      onSubmitted();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit");
    } finally {
      setSubmitting(false);
    }
  };

  const sendChatMessage = async () => {
    if (!chatInput.trim()) return;
    setChatLoading(true);
    const newMessages = [
      ...chatMessages,
      { role: "user" as const, content: chatInput },
    ];
    setChatMessages(newMessages);
    setChatInput("");

    try {
      const res = await fetch("/api/questions/workshop", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: newMessages }),
      });
      const data = await res.json();
      setChatMessages([
        ...newMessages,
        { role: "assistant", content: data.response },
      ]);
    } catch {
      setChatMessages([
        ...newMessages,
        {
          role: "assistant",
          content: "Sorry, I couldn't process that. Try again.",
        },
      ]);
    } finally {
      setChatLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="card p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-bold text-[#e94560]">
              You&apos;re At Bat!
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
          <div className="mb-6 card p-4 bg-[#0f0f23]">
            <h3 className="text-sm font-semibold text-[#a0a0b8] mb-3">
              AI Question Workshop
            </h3>
            <div className="max-h-60 overflow-y-auto space-y-3 mb-3">
              {chatMessages.length === 0 && (
                <p className="text-xs text-[#666680]">
                  Ask the AI for help brainstorming questions, generating options,
                  or refining ideas.
                </p>
              )}
              {chatMessages.map((msg, i) => (
                <div
                  key={i}
                  className={`text-sm p-3 rounded-lg ${
                    msg.role === "user"
                      ? "bg-[#e94560]/10 text-white ml-8"
                      : "bg-[#1e3a5f] text-[#a0a0b8] mr-8"
                  }`}
                >
                  {msg.content}
                </div>
              ))}
              {chatLoading && (
                <div className="text-xs text-[#666680] animate-pulse">
                  Thinking...
                </div>
              )}
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                className="input-field flex-1 text-sm"
                placeholder="Ask for question ideas..."
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !chatLoading) sendChatMessage();
                }}
              />
              <button
                onClick={sendChatMessage}
                disabled={chatLoading}
                className="btn-primary text-sm"
              >
                Send
              </button>
            </div>
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

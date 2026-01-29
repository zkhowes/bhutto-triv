"use client";

import { useState } from "react";

interface AnswerInterfaceProps {
  roundId: string;
  leaguePlayerId: string;
  question: {
    questionText: string;
    answerFormat: string;
    category: string;
    optionA: string | null;
    optionB: string | null;
    optionC: string | null;
    optionD: string | null;
  };
  betAmount: number;
  onAnswered: () => void;
}

export default function AnswerInterface({
  roundId,
  leaguePlayerId,
  question,
  betAmount,
  onAnswered,
}: AnswerInterfaceProps) {
  const [selectedOption, setSelectedOption] = useState("");
  const [freeTextAnswer, setFreeTextAnswer] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const isMultipleChoice = question.answerFormat === "multiple_choice";
  const options = [
    { key: "A", text: question.optionA },
    { key: "B", text: question.optionB },
    { key: "C", text: question.optionC },
    { key: "D", text: question.optionD },
  ].filter((o) => o.text);

  const handleSubmit = async () => {
    if (isMultipleChoice && !selectedOption) {
      setError("Please select an answer");
      return;
    }
    if (!isMultipleChoice && !freeTextAnswer.trim()) {
      setError("Please enter an answer");
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      const res = await fetch(`/api/rounds/${roundId}/answer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leaguePlayerId,
          selectedOption: isMultipleChoice ? selectedOption : undefined,
          freeTextAnswer: !isMultipleChoice ? freeTextAnswer.trim() : undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to submit answer");
      }

      onAnswered();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="card p-6">
      {/* Bet reminder */}
      <div className="flex items-center justify-between mb-4 pb-4 border-b border-[#1e3a5f]">
        <div>
          <p className="text-xs text-[#a0a0b8] uppercase tracking-wider">
            {question.category}
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs text-[#a0a0b8]">Your Bet</p>
          <p className="text-lg font-bold text-[#fbbf24]">{betAmount} pts</p>
        </div>
      </div>

      {/* Question */}
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-white leading-relaxed">
          {question.questionText}
        </h2>
      </div>

      {/* Answer input */}
      {isMultipleChoice ? (
        <div className="space-y-2 mb-6">
          {options.map((opt) => (
            <button
              key={opt.key}
              onClick={() => setSelectedOption(opt.key)}
              className={`w-full text-left p-4 rounded-lg border transition-all ${
                selectedOption === opt.key
                  ? "border-[#e94560] bg-[#e94560]/10 text-white"
                  : "border-[#1e3a5f] bg-[#0f0f23] text-[#a0a0b8] hover:border-[#2a5a8f]"
              }`}
            >
              <span className="font-bold mr-3">{opt.key}.</span>
              {opt.text}
            </button>
          ))}
        </div>
      ) : (
        <div className="mb-6">
          <input
            type="text"
            value={freeTextAnswer}
            onChange={(e) => setFreeTextAnswer(e.target.value)}
            className="input-field text-lg"
            placeholder="Type your answer..."
            onKeyDown={(e) => {
              if (e.key === "Enter" && !submitting) handleSubmit();
            }}
          />
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
        className="btn-primary w-full text-lg"
      >
        {submitting ? "Submitting..." : "Submit Answer"}
      </button>
    </div>
  );
}

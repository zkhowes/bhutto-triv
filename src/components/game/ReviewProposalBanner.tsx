"use client";

import { useState } from "react";

interface ReviewablePayload {
  category?: string;
  questionText?: string;
  answerFormat?: string;
  optionA?: string;
  optionB?: string;
  optionC?: string;
  optionD?: string;
  correctOption?: string;
  correctAnswer?: string;
  correctAnswerUnit?: string;
  acceptableAnswers?: string[];
}

interface QuestionLite {
  id: string;
  answerFormat: string;
  optionA: string | null;
  optionB: string | null;
  optionC: string | null;
  optionD: string | null;
  correctOption: string | null;
  correctAnswer: string | null;
  pendingReviewProposal?: string | null;
  pendingReviewNotes?: string | null;
  pendingReviewConfidence?: number | null;
}

interface Props {
  question: QuestionLite;
  onDecided: () => void; // called after a successful accept/reject; parent should refetch
}

/**
 * Sticky banner shown to the at-bat submitter when the at-submit reviewer
 * has a high-confidence correction it wants to apply. Submitter must
 * explicitly accept or reject — no silent auto-apply on this format.
 */
export default function ReviewProposalBanner({ question, onDecided }: Props) {
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState<"accepted" | "rejected" | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!question.pendingReviewProposal) return null;

  let proposed: ReviewablePayload;
  try {
    proposed = JSON.parse(question.pendingReviewProposal) as ReviewablePayload;
  } catch {
    return null;
  }

  const confidencePct = question.pendingReviewConfidence
    ? Math.round(question.pendingReviewConfidence * 100)
    : null;

  async function decide(decision: "accepted" | "rejected") {
    setSubmitting(decision);
    setError(null);
    try {
      const res = await fetch(`/api/questions/${question.id}/review-decision`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      setOpen(false);
      onDecided();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save decision");
      setSubmitting(null);
    }
  }

  // Build the diff rows. For MC we show option-letter + text; for free-text
  // we show the correct answer string.
  const diffRows: Array<{ label: string; current: string; proposed: string }> = [];
  if (question.answerFormat === "multiple_choice") {
    const letterToText = (q: QuestionLite | ReviewablePayload, letter: string | undefined | null) => {
      if (!letter) return "—";
      const opts = {
        A: ("optionA" in q ? q.optionA : null) ?? "",
        B: ("optionB" in q ? q.optionB : null) ?? "",
        C: ("optionC" in q ? q.optionC : null) ?? "",
        D: ("optionD" in q ? q.optionD : null) ?? "",
      } as Record<string, string>;
      return `${letter} — ${opts[letter] || "?"}`;
    };
    diffRows.push({
      label: "Correct option",
      current: letterToText(question, question.correctOption),
      proposed: letterToText(proposed, proposed.correctOption),
    });
  } else {
    diffRows.push({
      label: "Correct answer",
      current: question.correctAnswer ?? "—",
      proposed: proposed.correctAnswer ?? "—",
    });
    if (proposed.acceptableAnswers && proposed.acceptableAnswers.length > 0) {
      diffRows.push({
        label: "Acceptable variations",
        current: "(unchanged)",
        proposed: proposed.acceptableAnswers.join(", "),
      });
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full mb-4 px-4 py-3 rounded-lg border border-amber-500/50 bg-amber-500/10 text-left hover:bg-amber-500/15 transition"
      >
        <div className="flex items-center gap-2">
          <span className="text-amber-400 text-lg">⚠</span>
          <span className="font-semibold text-amber-300">Reviewer suggests a change to your answer key</span>
        </div>
        <p className="text-sm text-[#a0a0b8] mt-1">
          The fact-checker thinks your answer might be wrong
          {confidencePct !== null && ` (${confidencePct}% confident)`}. Tap to review and decide.
          Until you decide, your original answer ships.
        </p>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={() => submitting === null && setOpen(false)}
        >
          <div
            className="card max-w-lg w-full p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-xl font-bold mb-1">Reviewer wants to change your answer key</h3>
            <p className="text-sm text-[#a0a0b8] mb-4">
              The at-submit fact-checker (Sonnet 4.6) flagged your question. It only proposes a change when
              it&apos;s highly confident, but it can be wrong on pop-culture and sports questions in particular.
              You decide.
            </p>

            {question.pendingReviewNotes && (
              <div className="mb-4 p-3 rounded bg-[#1a1a2e] border border-[#2a2a4a]">
                <div className="text-xs uppercase text-[#8a8aa8] mb-1">Reviewer&apos;s reasoning</div>
                <div className="text-sm text-white">{question.pendingReviewNotes}</div>
                {confidencePct !== null && (
                  <div className="text-xs text-[#8a8aa8] mt-2">Confidence: {confidencePct}%</div>
                )}
              </div>
            )}

            <div className="space-y-3 mb-5">
              {diffRows.map((row) => (
                <div key={row.label} className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <div className="text-xs uppercase text-[#8a8aa8] mb-1">Your answer (current)</div>
                    <div className="p-2 rounded bg-[#1a1a2e] border border-[#2a2a4a] text-white">{row.current}</div>
                  </div>
                  <div>
                    <div className="text-xs uppercase text-amber-400 mb-1">Reviewer proposes</div>
                    <div className="p-2 rounded bg-amber-500/10 border border-amber-500/40 text-white">{row.proposed}</div>
                  </div>
                </div>
              ))}
            </div>

            {error && (
              <div className="mb-3 p-2 rounded bg-red-500/10 border border-red-500/40 text-sm text-red-300">
                {error}
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-2">
              <button
                type="button"
                disabled={submitting !== null}
                onClick={() => decide("rejected")}
                className="btn-secondary flex-1"
              >
                {submitting === "rejected" ? "Saving..." : "Keep my answer"}
              </button>
              <button
                type="button"
                disabled={submitting !== null}
                onClick={() => decide("accepted")}
                className="btn-primary flex-1"
              >
                {submitting === "accepted" ? "Applying..." : "Apply reviewer's change"}
              </button>
            </div>
            <button
              type="button"
              disabled={submitting !== null}
              onClick={() => setOpen(false)}
              className="mt-3 w-full text-xs text-[#8a8aa8] hover:text-white"
            >
              Close (decide later)
            </button>
          </div>
        </div>
      )}
    </>
  );
}

"use client";

import { useState } from "react";

interface QuestionShape {
  id: string;
  category: string;
  questionText: string;
  answerFormat: string;
  optionA: string | null;
  optionB: string | null;
  optionC: string | null;
  optionD: string | null;
  correctOption: string | null;
  correctAnswer: string | null;
  acceptableAnswers: string | null;
  correctAnswerUnit: string | null;
  orderingItems: string | null;
  orderingCorrectOrder: string | null;
  orderingItemValues: string | null;
  orderingDirection: string | null;
}

interface AnswerShape {
  id: string;
  leaguePlayerId: string;
  selectedOption: string | null;
  freeTextAnswer: string | null;
  isAbsent: boolean;
  leaguePlayer: {
    fakeNickname: string | null;
    user: { nickname: string | null };
  };
}

interface ProjectionAnswerRow {
  answerId: string;
  leaguePlayerId: string;
  nickname: string;
  before: { isCorrect: boolean | null; pointsWon: number; f1Points: number; placement: number | null; fastestLap: boolean };
  after: { isCorrect: boolean; pointsWon: number; f1Points: number; placement: number | null; fastestLap: boolean };
}

interface ProjectionPlayerRow {
  leaguePlayerId: string;
  nickname: string;
  before: { points: number; isEliminated: boolean };
  after: { points: number; isEliminated: boolean };
}

interface FixAndRegradeModalProps {
  roundId: string;
  roundNumber: number;
  gameNumber: number;
  hasFlag: boolean;
  question: QuestionShape;
  answers: AnswerShape[];
  isOpen: boolean;
  onClose: () => void;
  onApplied: () => void;
}

export default function FixAndRegradeModal({
  roundId,
  roundNumber,
  gameNumber,
  hasFlag,
  question,
  answers,
  isOpen,
  onClose,
  onApplied,
}: FixAndRegradeModalProps) {
  const format = question.answerFormat;

  const [correctOption, setCorrectOption] = useState(question.correctOption || "A");
  const [correctAnswer, setCorrectAnswer] = useState(question.correctAnswer || "");
  const [acceptableAnswers, setAcceptableAnswers] = useState(
    question.acceptableAnswers
      ? (JSON.parse(question.acceptableAnswers) as string[]).join(", ")
      : ""
  );
  const [correctAnswerUnit, setCorrectAnswerUnit] = useState(question.correctAnswerUnit || "");
  const [reason, setReason] = useState("");
  const [resolveFlag, setResolveFlag] = useState<"agreed" | "disagreed" | "leave">("agreed");
  const [notifySms, setNotifySms] = useState(true);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [projection, setProjection] = useState<{
    answers: ProjectionAnswerRow[];
    players: ProjectionPlayerRow[];
    previewNote: string | null;
  } | null>(null);

  if (!isOpen) return null;

  const buildPatch = () => {
    if (format === "multiple_choice") return { correctOption };
    if (format === "free_text") {
      const acceptable = acceptableAnswers
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      return {
        correctAnswer,
        acceptableAnswers: acceptable.length > 0 ? JSON.stringify(acceptable) : null,
      };
    }
    if (format === "price_is_right") return { correctAnswer, correctAnswerUnit };
    return {};
  };

  const validate = (): string | null => {
    if (!reason.trim()) return "Reason is required.";
    if (reason.length > 500) return "Reason must be under 500 characters.";
    if (format === "multiple_choice" && !["A", "B", "C", "D"].includes(correctOption)) {
      return "Pick a valid option (A–D).";
    }
    if (format === "free_text" && !correctAnswer.trim()) {
      return "Correct answer is required.";
    }
    if (format === "price_is_right" && isNaN(parseFloat(correctAnswer))) {
      return "Correct answer must be a number.";
    }
    if (format === "ordering") {
      return "Ordering-question regrade is not supported in the UI. Use a script — see /investigateQ.";
    }
    return null;
  };

  const runPreview = async () => {
    setError(null);
    const v = validate();
    if (v) {
      setError(v);
      return;
    }
    setPreviewLoading(true);
    try {
      const res = await fetch(`/api/rounds/${roundId}/regrade`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: buildPatch(),
          reason,
          preview: true,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Preview failed");
      setProjection({
        answers: data.projection.answers,
        players: data.projection.players,
        previewNote: data.previewNote,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Preview failed");
    } finally {
      setPreviewLoading(false);
    }
  };

  const apply = async () => {
    setError(null);
    if (!projection) {
      setError("Run preview first.");
      return;
    }
    setApplying(true);
    try {
      const res = await fetch(`/api/rounds/${roundId}/regrade`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: buildPatch(),
          reason,
          notifySms,
          resolveFlag: hasFlag ? resolveFlag : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Apply failed");
      onApplied();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Apply failed");
    } finally {
      setApplying(false);
    }
  };

  // Map A/B/C/D to option text for the editor.
  const optionsByLetter: Record<string, string | null> = {
    A: question.optionA,
    B: question.optionB,
    C: question.optionC,
    D: question.optionD,
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-[#0f0f23] border border-[#1e3a5f] rounded-xl max-w-3xl w-full p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex justify-between items-start mb-4">
          <div>
            <h2 className="text-lg font-bold text-white">Fix answer key & regrade</h2>
            <p className="text-xs text-[#a0a0b8] mt-1">
              Game {gameNumber} · Round {roundNumber} · {question.category}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-[#a0a0b8] hover:text-white text-xl leading-none"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {/* Question */}
        <div className="bg-[#1a1a2e] rounded-lg p-3 mb-4">
          <p className="text-xs text-[#666680] uppercase tracking-wider mb-1">Question</p>
          <p className="text-sm text-white">{question.questionText}</p>
        </div>

        {/* Editor */}
        <div className="mb-4">
          <p className="text-xs text-[#666680] uppercase tracking-wider mb-2">Correct answer</p>

          {format === "multiple_choice" && (
            <div className="space-y-2">
              {(["A", "B", "C", "D"] as const).map((letter) => (
                <label key={letter} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="correctOption"
                    value={letter}
                    checked={correctOption === letter}
                    onChange={(e) => setCorrectOption(e.target.value)}
                  />
                  <span className="text-sm text-white">
                    {letter}. {optionsByLetter[letter] ?? <em className="text-[#666680]">empty</em>}
                  </span>
                </label>
              ))}
            </div>
          )}

          {format === "free_text" && (
            <div className="space-y-2">
              <input
                type="text"
                value={correctAnswer}
                onChange={(e) => setCorrectAnswer(e.target.value)}
                className="w-full bg-[#1a1a2e] border border-[#1e3a5f] rounded px-3 py-2 text-sm text-white"
                placeholder="Correct answer"
              />
              <input
                type="text"
                value={acceptableAnswers}
                onChange={(e) => setAcceptableAnswers(e.target.value)}
                className="w-full bg-[#1a1a2e] border border-[#1e3a5f] rounded px-3 py-2 text-sm text-white"
                placeholder="Acceptable variations (comma-separated)"
              />
              <p className="text-xs text-amber-400/80">
                Free-text regrade re-runs the AI grader on every answer at commit time.
                Preview shows current grades only.
              </p>
            </div>
          )}

          {format === "price_is_right" && (
            <div className="flex gap-2">
              <input
                type="text"
                inputMode="decimal"
                value={correctAnswer}
                onChange={(e) => setCorrectAnswer(e.target.value)}
                className="flex-1 bg-[#1a1a2e] border border-[#1e3a5f] rounded px-3 py-2 text-sm text-white"
                placeholder="Target value"
              />
              <input
                type="text"
                value={correctAnswerUnit}
                onChange={(e) => setCorrectAnswerUnit(e.target.value)}
                className="w-32 bg-[#1a1a2e] border border-[#1e3a5f] rounded px-3 py-2 text-sm text-white"
                placeholder="Unit"
              />
            </div>
          )}

          {format === "ordering" && (
            <p className="text-xs text-red-400">
              Ordering questions need a script-based fix — see the /investigateQ skill.
            </p>
          )}
        </div>

        {/* Reason */}
        <div className="mb-4">
          <label className="block text-xs text-[#666680] uppercase tracking-wider mb-2">
            Reason (sent to players)
          </label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            maxLength={500}
            rows={2}
            className="w-full bg-[#1a1a2e] border border-[#1e3a5f] rounded px-3 py-2 text-sm text-white"
            placeholder="e.g. The largest SB margin was 49ers-Broncos 45 pts, not Seahawks-Broncos 35 pts."
          />
          <p className="text-xs text-[#666680] mt-1">{reason.length}/500</p>
        </div>

        {/* Flag resolution + SMS */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          {hasFlag && (
            <div>
              <label className="block text-xs text-[#666680] uppercase tracking-wider mb-2">
                Flag resolution
              </label>
              <select
                value={resolveFlag}
                onChange={(e) => setResolveFlag(e.target.value as "agreed" | "disagreed" | "leave")}
                className="w-full bg-[#1a1a2e] border border-[#1e3a5f] rounded px-3 py-2 text-sm text-white"
              >
                <option value="agreed">Mark flag agreed</option>
                <option value="disagreed">Mark flag disagreed</option>
                <option value="leave">Leave pending</option>
              </select>
            </div>
          )}
          <div className={hasFlag ? "" : "col-span-2"}>
            <label className="flex items-center gap-2 mt-6 cursor-pointer">
              <input
                type="checkbox"
                checked={notifySms}
                onChange={(e) => setNotifySms(e.target.checked)}
              />
              <span className="text-sm text-white">Send SMS notification</span>
            </label>
          </div>
        </div>

        {/* Preview button */}
        {!projection && (
          <button
            onClick={runPreview}
            disabled={previewLoading || !reason.trim()}
            className="w-full py-2.5 rounded-lg bg-amber-500/20 border border-amber-500/30 text-amber-400 text-sm font-medium hover:bg-amber-500/30 transition-colors disabled:opacity-50 mb-3"
          >
            {previewLoading ? "Computing..." : "Preview standings diff"}
          </button>
        )}

        {/* Projection */}
        {projection && (
          <div className="mb-4">
            {projection.previewNote && (
              <p className="text-xs text-amber-400/80 mb-2">{projection.previewNote}</p>
            )}
            <p className="text-xs text-[#666680] uppercase tracking-wider mb-2">
              Per-answer change
            </p>
            <div className="bg-[#1a1a2e] rounded-lg overflow-hidden mb-3">
              <table className="w-full text-xs">
                <thead className="bg-[#0f0f23]">
                  <tr className="text-[#a0a0b8]">
                    <th className="text-left px-2 py-1.5">Player</th>
                    <th className="text-right px-2 py-1.5">Before</th>
                    <th className="text-right px-2 py-1.5">After</th>
                  </tr>
                </thead>
                <tbody>
                  {projection.answers.map((r) => {
                    const delta = r.after.pointsWon - r.before.pointsWon;
                    const moved = r.before.placement !== r.after.placement;
                    return (
                      <tr key={r.answerId} className="border-t border-[#1e3a5f]">
                        <td className="px-2 py-1.5 text-white">{r.nickname}</td>
                        <td className="px-2 py-1.5 text-right text-[#a0a0b8]">
                          {r.before.isCorrect ? "✓" : r.before.isCorrect === false ? "✗" : "—"}{" "}
                          {r.before.pointsWon >= 0 ? "+" : ""}
                          {r.before.pointsWon} · P{r.before.placement ?? "-"}
                          {r.before.fastestLap ? " ⚡" : ""}
                        </td>
                        <td className="px-2 py-1.5 text-right">
                          <span className={r.after.isCorrect ? "text-emerald-400" : "text-red-400"}>
                            {r.after.isCorrect ? "✓" : "✗"}{" "}
                            {r.after.pointsWon >= 0 ? "+" : ""}
                            {r.after.pointsWon}
                          </span>{" "}
                          <span className={moved ? "text-amber-400" : "text-[#a0a0b8]"}>
                            P{r.after.placement ?? "-"}
                          </span>
                          {r.after.fastestLap ? " ⚡" : ""}
                          {delta !== 0 && (
                            <span className={`ml-1 text-xs ${delta > 0 ? "text-emerald-400" : "text-red-400"}`}>
                              ({delta > 0 ? "+" : ""}
                              {delta})
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <p className="text-xs text-[#666680] uppercase tracking-wider mb-2">
              Game-points after
            </p>
            <div className="bg-[#1a1a2e] rounded-lg overflow-hidden">
              <table className="w-full text-xs">
                <thead className="bg-[#0f0f23]">
                  <tr className="text-[#a0a0b8]">
                    <th className="text-left px-2 py-1.5">Player</th>
                    <th className="text-right px-2 py-1.5">Before</th>
                    <th className="text-right px-2 py-1.5">After</th>
                  </tr>
                </thead>
                <tbody>
                  {projection.players.map((p) => {
                    const delta = p.after.points - p.before.points;
                    return (
                      <tr key={p.leaguePlayerId} className="border-t border-[#1e3a5f]">
                        <td className="px-2 py-1.5 text-white">{p.nickname}</td>
                        <td className="px-2 py-1.5 text-right text-[#a0a0b8]">
                          {p.before.points}
                          {p.before.isEliminated ? " 🪦" : ""}
                        </td>
                        <td className="px-2 py-1.5 text-right">
                          <span className={delta === 0 ? "text-[#a0a0b8]" : delta > 0 ? "text-emerald-400" : "text-red-400"}>
                            {p.after.points}
                          </span>
                          {p.after.isEliminated ? " 🪦" : ""}
                          {delta !== 0 && (
                            <span className={`ml-1 text-xs ${delta > 0 ? "text-emerald-400" : "text-red-400"}`}>
                              ({delta > 0 ? "+" : ""}
                              {delta})
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {error && <p className="text-xs text-red-400 mb-3 text-center">{error}</p>}

        {/* Action buttons */}
        <div className="flex gap-2 pt-3 border-t border-[#1e3a5f]">
          <button
            onClick={onClose}
            className="flex-1 py-2 rounded-lg bg-[#1a1a2e] border border-[#1e3a5f] text-[#a0a0b8] text-sm hover:bg-[#1e3a5f]/30 transition-colors"
          >
            Cancel
          </button>
          {projection && (
            <button
              onClick={() => {
                setProjection(null);
                setError(null);
              }}
              className="px-3 py-2 rounded-lg bg-[#1a1a2e] border border-[#1e3a5f] text-[#a0a0b8] text-sm hover:bg-[#1e3a5f]/30 transition-colors"
            >
              Re-preview
            </button>
          )}
          <button
            onClick={apply}
            disabled={!projection || applying || format === "ordering"}
            className="flex-1 py-2 rounded-lg bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 text-sm font-medium hover:bg-emerald-500/30 transition-colors disabled:opacity-50"
          >
            {applying ? "Applying..." : "Apply regrade"}
          </button>
        </div>

        {/* Stash answers reference for clarity */}
        {answers.length === 0 && (
          <p className="text-xs text-[#666680] mt-3">No answers found for this round.</p>
        )}
      </div>
    </div>
  );
}

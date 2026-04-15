"use client";

import { useState, useEffect, useRef } from "react";
import CountdownTimer from "./CountdownTimer";
import StarRating from "@/components/ui/StarRating";
import Spinner from "@/components/ui/Spinner";
import { computePowerUpCost } from "@/lib/scoring";

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
    imageUrl?: string | null;
    imageAttribution?: string | null;
    orderingItems?: string | null;
    orderingDirection?: string | null;
  };
  betAmount: number;
  playerPoints: number; // current points before the bet
  allActivePoints: number[]; // points of all active (non-eliminated) players
  answerDeadline?: string | null;
  roundStatus: string;
  powerUpType?: string | null; // already-purchased power-up this round
  actAsPlayerId?: string | null;
  onAnswered: () => void;
}

export default function AnswerInterface({
  roundId,
  leaguePlayerId,
  question,
  betAmount,
  playerPoints,
  allActivePoints,
  answerDeadline,
  roundStatus,
  powerUpType,
  actAsPlayerId,
  onAnswered,
}: AnswerInterfaceProps) {
  const [selectedOption, setSelectedOption] = useState("");
  const [freeTextAnswer, setFreeTextAnswer] = useState("");
  const [priceAnswer, setPriceAnswer] = useState("");
  const [eliminatedOption, setEliminatedOption] = useState<string | null>(null);
  const [highLowResult, setHighLowResult] = useState<string | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  const [firstPlaceItem, setFirstPlaceItem] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [buyingPowerUp, setBuyingPowerUp] = useState(false);
  const [powerUpUsed, setPowerUpUsed] = useState(!!powerUpType);
  const [questionRating, setQuestionRating] = useState(0);
  const [error, setError] = useState("");

  const isMultipleChoice = question.answerFormat === "multiple_choice";
  const isPriceIsRight = question.answerFormat === "price_is_right";
  const isOrdering = question.answerFormat === "ordering";
  const isFreeText = !isMultipleChoice && !isPriceIsRight && !isOrdering;

  // Ordering state: parse items and shuffle on mount
  const orderingItemsParsed: string[] = (() => {
    if (!isOrdering || !question.orderingItems) return [];
    try { return JSON.parse(question.orderingItems); } catch { return []; }
  })();
  const orderingDirection = isOrdering && question.orderingDirection ? question.orderingDirection : "";

  // Shuffled ordering for the player (stable across renders)
  const [playerOrder, setPlayerOrder] = useState<number[]>([]);
  useEffect(() => {
    if (!isOrdering || orderingItemsParsed.length === 0) return;
    // Create shuffled indices on mount
    const indices = orderingItemsParsed.map((_, i) => i);
    for (let i = indices.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [indices[i], indices[j]] = [indices[j], indices[i]];
    }
    setPlayerOrder(indices);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOrdering, question.orderingItems]);

  const options = [
    { key: "A", text: question.optionA },
    { key: "B", text: question.optionB },
    { key: "C", text: question.optionC },
    { key: "D", text: question.optionD },
  ].filter((o) => o.text);

  const availableAfterBet = playerPoints - betAmount;
  const powerUpCost = computePowerUpCost(playerPoints, allActivePoints);
  const canAffordPowerUp = availableAfterBet >= powerUpCost;
  const isAnswerPhase = roundStatus === "category_revealed" || roundStatus === "question_submitted";

  // Cheat Seeker tracking
  const tabSwitches = useRef(0);
  const blurCount = useRef(0);
  const timeAway = useRef(0);
  const hiddenAt = useRef<number | null>(null);
  const pasteDetected = useRef(false);

  useEffect(() => {
    if (!isAnswerPhase) return;

    const onVisChange = () => {
      if (document.hidden) {
        tabSwitches.current++;
        hiddenAt.current = Date.now();
      } else if (hiddenAt.current) {
        timeAway.current += Date.now() - hiddenAt.current;
        hiddenAt.current = null;
      }
    };
    const onBlur = () => { blurCount.current++; };
    const onPaste = () => { pasteDetected.current = true; };

    document.addEventListener("visibilitychange", onVisChange);
    window.addEventListener("blur", onBlur);
    document.addEventListener("paste", onPaste);

    return () => {
      document.removeEventListener("visibilitychange", onVisChange);
      window.removeEventListener("blur", onBlur);
      document.removeEventListener("paste", onPaste);
    };
  }, [isAnswerPhase]);

  const moveItem = (fromIdx: number, toIdx: number) => {
    if (toIdx < 0 || toIdx >= playerOrder.length) return;
    setPlayerOrder((prev) => {
      const next = [...prev];
      [next[fromIdx], next[toIdx]] = [next[toIdx], next[fromIdx]];
      return next;
    });
  };

  const handleSubmit = async () => {
    if (isMultipleChoice && !selectedOption) {
      setError("Please select an answer");
      return;
    }
    if (isFreeText && !freeTextAnswer.trim()) {
      setError("Please enter an answer");
      return;
    }
    if (isPriceIsRight) {
      if (!priceAnswer.trim() || isNaN(parseFloat(priceAnswer))) {
        setError("Please enter a valid number");
        return;
      }
    }
    if (isOrdering && playerOrder.length === 0) {
      setError("Please arrange the items");
      return;
    }
    if (questionRating === 0) {
      setError("Please rate the question before submitting");
      return;
    }

    setSubmitting(true);
    setError("");

    // For ordering: convert playerOrder (array of original indices) to position array
    // playerOrder[i] = original index of item at position i
    // We need to send: for each original item, what position did the player put it in?
    // positionArray[originalIndex] = position (1-based)
    let orderingAnswer: string | undefined;
    if (isOrdering) {
      const positionArray = new Array(playerOrder.length);
      for (let pos = 0; pos < playerOrder.length; pos++) {
        positionArray[playerOrder[pos]] = pos + 1;
      }
      orderingAnswer = JSON.stringify(positionArray);
    }

    try {
      const actAsParam = actAsPlayerId ? `?actAs=${actAsPlayerId}` : "";
      const res = await fetch(`/api/rounds/${roundId}/answer${actAsParam}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leaguePlayerId,
          selectedOption: isMultipleChoice ? selectedOption : undefined,
          freeTextAnswer: isFreeText
            ? freeTextAnswer.trim()
            : isPriceIsRight
              ? priceAnswer.trim()
              : isOrdering
                ? orderingAnswer
                : undefined,
          questionRating,
          cheatSeekerData: {
            tabSwitches: tabSwitches.current,
            timeAway: timeAway.current,
            pasteDetected: pasteDetected.current,
            blurCount: blurCount.current,
          },
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

  const handleBuyPowerUp = async () => {
    setBuyingPowerUp(true);
    setError("");

    try {
      const powerUpTypeForFormat: Record<string, string> = {
        multiple_choice: "elimination",
        free_text: "hint",
        price_is_right: "highlow",
        ordering: "first_place",
      };
      const type = powerUpTypeForFormat[question.answerFormat];
      if (!type) {
        setError("No power-up available for this question type");
        return;
      }

      const body: Record<string, unknown> = { leaguePlayerId, type };
      if (type === "highlow") {
        const probe = parseFloat(priceAnswer);
        if (isNaN(probe)) {
          setError("Enter a number first to check High/Low");
          return;
        }
        body.probeValue = probe;
      }

      const actAsParam = actAsPlayerId ? `?actAs=${actAsPlayerId}` : "";
      const res = await fetch(`/api/rounds/${roundId}/powerup${actAsParam}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to purchase power-up");
      }

      const data = await res.json();
      const result = data.result as Record<string, unknown>;

      if (result.hint) setHint(result.hint as string);
      if (result.eliminatedOption)
        setEliminatedOption(result.eliminatedOption as string);
      if (result.direction)
        setHighLowResult(result.direction as string);
      if (result.item) setFirstPlaceItem(result.item as string);

      setPowerUpUsed(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to buy power-up");
    } finally {
      setBuyingPowerUp(false);
    }
  };

  const powerUpLabel: Record<string, string> = {
    multiple_choice: "Eliminate a Wrong Answer",
    free_text: "Buy a Hint",
    price_is_right: "Check High/Low",
    ordering: "Reveal 1st Position",
  };

  return (
    <div className="card p-6">
      {/* Bet reminder & timer */}
      <div className="flex items-center justify-between mb-4 pb-4 border-b border-[#1e3a5f]">
        <div>
          <p className="text-xs text-[#a0a0b8] uppercase tracking-wider">
            {question.category}
          </p>
          {answerDeadline && (
            <div className="mt-1">
              <CountdownTimer deadlineTime={answerDeadline} />
            </div>
          )}
        </div>
        <div className="text-right">
          <p className="text-xs text-[#a0a0b8]">Your Bet</p>
          <p className="text-lg font-bold text-[#fbbf24]">{betAmount} pts</p>
        </div>
      </div>

      {/* Question */}
      <div className="mb-6">
        {question.imageUrl && (
          <div className="mb-4">
            <img
              src={question.imageUrl}
              alt="Question image"
              className="rounded-xl w-full max-h-64 object-cover"
              onError={(e) => {
                (e.target as HTMLImageElement).parentElement!.style.display = "none";
              }}
            />
            {question.imageAttribution && (() => {
              try {
                const attr = JSON.parse(question.imageAttribution);
                return (
                  <p className="text-xs text-[#a0a0b8] mt-1">
                    Photo by{" "}
                    <a href={attr.profileUrl} target="_blank" rel="noopener noreferrer" className="underline">
                      {attr.name}
                    </a>
                  </p>
                );
              } catch { return null; }
            })()}
          </div>
        )}
        <h2 className="text-lg sm:text-xl font-semibold text-white leading-relaxed">
          {question.questionText}
        </h2>
        {isPriceIsRight && (
          <div className="mt-3 flex items-center gap-2">
            <span className="text-xs font-bold text-amber-400 bg-amber-400/15 rounded px-2 py-1 uppercase tracking-wide">
              Price is Right
            </span>
            <span className="text-xs text-[#a0a0b8]">Closest without going over wins</span>
          </div>
        )}
        {isOrdering && (
          <div className="mt-3 flex items-center gap-2">
            <span className="text-xs font-bold text-purple-400 bg-purple-400/15 rounded px-2 py-1 uppercase tracking-wide">
              Ordering
            </span>
            <span className="text-xs text-[#a0a0b8]">Arrange items in the correct order</span>
          </div>
        )}
      </div>

      {/* Answer input */}
      {isMultipleChoice ? (
        <div className="space-y-2 mb-4">
          {options.map((opt) => {
            const isEliminated = eliminatedOption === opt.key;
            return (
              <button
                key={opt.key}
                onClick={() => !isEliminated && setSelectedOption(opt.key)}
                disabled={isEliminated}
                className={`w-full text-left p-4 rounded-lg border transition-all text-base ${
                  isEliminated
                    ? "border-[#1e3a5f] bg-[#0a0a1a] text-[#444460] line-through opacity-50 cursor-not-allowed"
                    : selectedOption === opt.key
                      ? "border-[#e94560] bg-[#e94560]/10 text-white"
                      : "border-[#1e3a5f] bg-[#0f0f23] text-[#a0a0b8] hover:border-[#2a5a8f]"
                }`}
              >
                <span className="font-bold mr-3">{opt.key}.</span>
                {opt.text}
                {isEliminated && (
                  <span className="ml-2 text-xs text-[#e94560]">eliminated</span>
                )}
              </button>
            );
          })}
        </div>
      ) : isPriceIsRight ? (
        <div className="mb-4">
          <label className="block text-sm font-medium text-amber-400 mb-2">Your guess (closest without going over wins)</label>
          <input
            type="number"
            value={priceAnswer}
            onChange={(e) => setPriceAnswer(e.target.value)}
            className="input-field text-lg"
            placeholder="Enter your number..."
            step="any"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !submitting) handleSubmit();
            }}
          />
          {highLowResult && (
            <div
              className={`mt-2 p-2 rounded-lg text-sm font-semibold text-center ${
                highLowResult === "high"
                  ? "bg-red-500/10 text-red-400"
                  : highLowResult === "low"
                    ? "bg-blue-500/10 text-blue-400"
                    : "bg-emerald-500/10 text-emerald-400"
              }`}
            >
              {highLowResult === "high"
                ? "Too High — adjust your guess down"
                : highLowResult === "low"
                  ? "Too Low — adjust your guess up"
                  : "Exact match!"}
            </div>
          )}
        </div>
      ) : isOrdering ? (
        <div className="mb-4">
          <p className="text-sm text-[#a0a0b8] mb-3 font-medium">
            Order these {orderingDirection ? `from ${orderingDirection}` : ""}:
          </p>
          {firstPlaceItem && (
            <div className="mb-3 p-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 text-sm text-emerald-300">
              <span className="font-semibold">1st position: </span>{firstPlaceItem}
            </div>
          )}
          <div className="space-y-2">
            {playerOrder.map((originalIdx, posIdx) => {
              const isPinned = firstPlaceItem && orderingItemsParsed[originalIdx] === firstPlaceItem && posIdx === 0;
              return (
                <div
                  key={originalIdx}
                  className={`flex items-center gap-2 p-3 rounded-lg border transition-all ${
                    isPinned
                      ? "border-emerald-500/40 bg-emerald-500/10"
                      : "border-[#1e3a5f] bg-[#0f0f23]"
                  }`}
                >
                  <span className="w-6 h-6 rounded-full bg-[#1e3a5f] text-[#a0a0b8] flex items-center justify-center text-xs font-bold flex-shrink-0">
                    {posIdx + 1}
                  </span>
                  <span className="flex-1 text-white text-sm">
                    {orderingItemsParsed[originalIdx]}
                  </span>
                  <div className="flex flex-col gap-0.5 flex-shrink-0">
                    <button
                      type="button"
                      onClick={() => moveItem(posIdx, posIdx - 1)}
                      disabled={posIdx === 0}
                      className={`w-7 h-7 flex items-center justify-center rounded text-xs ${
                        posIdx === 0
                          ? "text-[#444460] cursor-not-allowed"
                          : "text-[#a0a0b8] hover:bg-[#1e3a5f] hover:text-white"
                      }`}
                    >
                      ▲
                    </button>
                    <button
                      type="button"
                      onClick={() => moveItem(posIdx, posIdx + 1)}
                      disabled={posIdx === playerOrder.length - 1}
                      className={`w-7 h-7 flex items-center justify-center rounded text-xs ${
                        posIdx === playerOrder.length - 1
                          ? "text-[#444460] cursor-not-allowed"
                          : "text-[#a0a0b8] hover:bg-[#1e3a5f] hover:text-white"
                      }`}
                    >
                      ▼
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="mb-4">
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

      {/* Hint display */}
      {hint && (
        <div className="mb-4 p-3 rounded-lg border border-amber-500/30 bg-amber-500/5 text-sm text-amber-300">
          <span className="font-semibold">Hint: </span>{hint}
        </div>
      )}

      {/* Power-up section */}
      {!powerUpUsed && isAnswerPhase && canAffordPowerUp && (
        <div className="mb-4 p-3 rounded-lg border border-[#1e3a5f] bg-[#0a0a1a]">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-[#a0a0b8] font-medium">
                Power-Up Available
              </p>
              <p className="text-sm text-white">
                {powerUpLabel[question.answerFormat] ?? "Power-Up"}
              </p>
              <p className="text-xs text-[#666680] mt-0.5">
                Cost: {powerUpCost} pt{powerUpCost !== 1 ? "s" : ""}
              </p>
            </div>
            <button
              onClick={handleBuyPowerUp}
              disabled={buyingPowerUp || (isPriceIsRight && !priceAnswer.trim())}
              className="btn-secondary text-sm"
            >
              {buyingPowerUp ? "..." : "Buy"}
            </button>
          </div>
        </div>
      )}

      {powerUpUsed && !hint && !eliminatedOption && !highLowResult && !firstPlaceItem && (
        <div className="mb-4 text-xs text-[#666680] text-center">
          Power-up used this round
        </div>
      )}

      {/* Question rating (required) */}
      <div className={`mb-4 p-3 rounded-lg border bg-[#0a0a1a] text-center ${
        questionRating === 0 && error ? "border-red-500/50" : "border-[#1e3a5f]"
      }`}>
        <p className="text-xs text-[#a0a0b8] uppercase tracking-wider mb-2">
          Rate this question <span className="text-[#e94560]">*</span>
        </p>
        <StarRating value={questionRating} onChange={setQuestionRating} />
      </div>

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
        {submitting ? <span className="inline-flex items-center justify-center gap-2"><Spinner /> Submitting...</span> : "Submit Answer"}
      </button>
    </div>
  );
}

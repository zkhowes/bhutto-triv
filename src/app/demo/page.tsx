"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import {
  MOCK_QUESTION,
  MOCK_RESULTS,
  MOCK_FUN_FACT,
  DEMO_CATEGORIES,
  WORKSHOP_CHIPS,
  WORKSHOP_VARIATIONS,
} from "./mock-data";

const TOTAL_STEPS = 6;

function StepIndicator({ step }: { step: number }) {
  return (
    <div className="flex items-center gap-2">
      {Array.from({ length: TOTAL_STEPS }, (_, i) => (
        <div
          key={i}
          className={`w-2 h-2 rounded-full transition-colors ${
            i + 1 === step
              ? "bg-[#fbbf24]"
              : i + 1 < step
              ? "bg-[#e94560]"
              : "bg-[#1e3a5f]"
          }`}
        />
      ))}
    </div>
  );
}

function DemoHeader({ step }: { step: number }) {
  return (
    <div className="sticky top-0 z-10 bg-[#0f0f23]/95 backdrop-blur border-b border-[#1e3a5f] px-4 py-3">
      <div className="max-w-2xl mx-auto flex items-center justify-between">
        <a
          href="/"
          className="text-sm text-[#a0a0b8] hover:text-white transition-colors"
        >
          &larr; Back
        </a>
        <div className="flex items-center gap-3">
          <span className="text-xs font-bold text-[#fbbf24] bg-[#fbbf24]/10 px-2 py-1 rounded">
            DEMO
          </span>
          <StepIndicator step={step} />
        </div>
        <button
          onClick={() => signIn("google", { callbackUrl: "/profile" })}
          className="text-sm font-semibold text-[#e94560] hover:text-white transition-colors"
        >
          Sign Up
        </button>
      </div>
    </div>
  );
}

// Step 1: AI Question Workshop
function StepWorkshop({ onNext }: { onNext: () => void }) {
  const [phase, setPhase] = useState<"idle" | "loading" | "cards" | "selected">("idle");
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [input, setInput] = useState("");

  const handleGenerate = (prompt: string) => {
    if (!prompt.trim()) return;
    setInput("");
    setPhase("loading");
    setTimeout(() => setPhase("cards"), 1500);
  };

  const handleSelect = (idx: number) => {
    setSelectedIdx(idx);
    setPhase("selected");
  };

  const difficultyColor = (d: string) => {
    if (d === "Easy") return "text-[#10b981]";
    if (d === "Hard") return "text-[#e94560]";
    return "text-[#fbbf24]";
  };

  return (
    <div className="animate-fade-in">
      <div className="text-center mb-8">
        <div className="text-xs text-[#fbbf24] font-bold mb-2">
          ROUND 3 OF 4
        </div>
        <h2 className="text-2xl font-bold text-white mb-2">
          AI Question Workshop
        </h2>
        <p className="text-[#a0a0b8] text-sm">
          Need help coming up with a question? AI generates three variations for
          you to choose from.
        </p>
      </div>

      <div className="card p-5 bg-[#0f0f23] space-y-4">
        {/* Idle: Input + Chips */}
        {phase === "idle" && (
          <>
            <div className="flex gap-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleGenerate(input);
                }}
                className="input-field flex-1 text-sm"
                placeholder="What kind of question?"
              />
              <button
                onClick={() => handleGenerate(input)}
                disabled={!input.trim()}
                className="btn-primary text-sm disabled:opacity-50"
              >
                Go
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {WORKSHOP_CHIPS.map((chip) => (
                <button
                  key={chip}
                  onClick={() => handleGenerate(chip)}
                  className="text-xs px-2.5 py-1 rounded-full bg-[#1e3a5f] text-[#a0a0b8] hover:text-white hover:bg-[#254a73] transition-all"
                >
                  {chip}
                </button>
              ))}
            </div>
          </>
        )}

        {/* Loading: Skeleton cards */}
        {phase === "loading" && (
          <div className="grid grid-cols-3 gap-2">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="rounded-lg border border-[#1e3a5f] bg-[#16162a] p-3 animate-pulse"
              >
                <div className="h-2 w-12 bg-[#1e3a5f] rounded mb-3" />
                <div className="h-3 w-full bg-[#1e3a5f] rounded mb-2" />
                <div className="h-3 w-3/4 bg-[#1e3a5f] rounded mb-2" />
                <div className="h-3 w-1/2 bg-[#1e3a5f] rounded" />
              </div>
            ))}
          </div>
        )}

        {/* Cards: 3 variations */}
        {phase === "cards" && (
          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {WORKSHOP_VARIATIONS.map((v, i) => (
                <button
                  key={i}
                  onClick={() => handleSelect(i)}
                  className="text-left rounded-lg border border-[#1e3a5f] bg-[#16162a] p-3 hover:border-[#e94560] transition-all"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] text-[#666680] uppercase">
                      {v.category}
                    </span>
                    <span className={`text-[10px] font-medium ${difficultyColor(v.difficulty)}`}>
                      {v.difficulty}
                    </span>
                  </div>
                  <p className="text-xs text-white leading-relaxed">
                    {v.questionText}
                  </p>
                </button>
              ))}
            </div>
            <div className="flex gap-2 justify-center">
              <button
                onClick={() => {
                  setPhase("loading");
                  setTimeout(() => setPhase("cards"), 1500);
                }}
                className="text-xs px-2 py-1 rounded-full bg-[#1e3a5f] text-[#a0a0b8] hover:text-white transition-all"
              >
                New set
              </button>
              <button
                onClick={() => {
                  setPhase("idle");
                  setSelectedIdx(null);
                }}
                className="text-xs px-2 py-1 text-[#666680] hover:text-[#a0a0b8]"
              >
                Start Over
              </button>
            </div>
          </div>
        )}

        {/* Selected: Confirm */}
        {phase === "selected" && selectedIdx !== null && (
          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {WORKSHOP_VARIATIONS.map((v, i) => (
                <div
                  key={i}
                  className={`rounded-lg border p-3 transition-all ${
                    i === selectedIdx
                      ? "border-[#e94560] bg-[#e94560]/10"
                      : "border-[#1e3a5f] bg-[#16162a] opacity-40"
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] text-[#666680] uppercase">
                      {v.category}
                    </span>
                    <span className={`text-[10px] font-medium ${difficultyColor(v.difficulty)}`}>
                      {v.difficulty}
                    </span>
                  </div>
                  <p className="text-xs text-white leading-relaxed">
                    {v.questionText}
                  </p>
                </div>
              ))}
            </div>
            <div className="flex gap-2 justify-center">
              <button onClick={onNext} className="btn-primary text-sm">
                Use This Question
              </button>
              <button
                onClick={() => {
                  setSelectedIdx(null);
                  setPhase("cards");
                }}
                className="text-xs px-2 py-1 rounded-full bg-[#1e3a5f] text-[#a0a0b8] hover:text-white transition-all"
              >
                Pick Another
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="mt-4 text-center">
        <button
          onClick={onNext}
          className="text-xs text-[#666680] hover:text-[#a0a0b8] transition-colors"
        >
          Skip — I&apos;ll write my own
        </button>
      </div>
    </div>
  );
}

// Step 2: Question Submission
function StepSubmitQuestion({ onNext }: { onNext: () => void }) {
  const [category, setCategory] = useState("Geography");

  return (
    <div className="animate-fade-in">
      <div className="text-center mb-8">
        <div className="text-xs text-[#fbbf24] font-bold mb-2">
          ROUND 3 OF 4
        </div>
        <h2 className="text-2xl font-bold text-white mb-2">
          You&apos;re At Bat
        </h2>
        <p className="text-[#a0a0b8] text-sm">
          Submit a trivia question for the other players to answer.
        </p>
      </div>

      <div className="card p-6 space-y-5">
        <div>
          <label className="block text-sm font-medium text-[#a0a0b8] mb-2">
            Category
          </label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="input-field"
          >
            {DEMO_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-[#a0a0b8] mb-2">
            Question
          </label>
          <div className="input-field bg-[#0f0f23] cursor-default">
            {MOCK_QUESTION.text}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-[#a0a0b8] mb-2">
            Answer Options
          </label>
          <div className="grid grid-cols-2 gap-2">
            {MOCK_QUESTION.options.map((opt) => (
              <div
                key={opt.label}
                className={`input-field text-sm flex items-center gap-2 ${
                  opt.label === MOCK_QUESTION.correctAnswer
                    ? "border-[#10b981]"
                    : ""
                }`}
              >
                <span className="font-bold text-[#a0a0b8]">{opt.label}.</span>
                {opt.value}
                {opt.label === MOCK_QUESTION.correctAnswer && (
                  <span className="ml-auto text-[#10b981] text-xs">
                    &#10003;
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>

        <button onClick={onNext} className="btn-primary w-full py-3 text-base">
          Submit Question
        </button>
      </div>
    </div>
  );
}

// Step 2: Betting
function StepBetting({ onNext }: { onNext: () => void }) {
  const [bet, setBet] = useState(10);

  return (
    <div className="animate-fade-in">
      <div className="text-center mb-8">
        <div className="text-xs text-[#fbbf24] font-bold mb-2">
          ROUND 3 OF 4
        </div>
        <h2 className="text-2xl font-bold text-white mb-2">Place Your Bet</h2>
        <p className="text-[#a0a0b8] text-sm">
          SageBhutto submitted a question. See the category, then wager your
          points.
        </p>
      </div>

      <div className="card p-6 space-y-6">
        <div className="text-center">
          <div className="text-sm text-[#a0a0b8] mb-1">Category</div>
          <div className="text-xl font-bold text-[#fbbf24]">
            {MOCK_QUESTION.category}
          </div>
        </div>

        <div className="border-t border-[#1e3a5f]" />

        <div>
          <div className="flex justify-between text-sm mb-3">
            <span className="text-[#a0a0b8]">Your Bet</span>
            <span className="text-white font-bold text-lg">{bet} pts</span>
          </div>
          <input
            type="range"
            min={1}
            max={20}
            value={bet}
            onChange={(e) => setBet(Number(e.target.value))}
            className="bet-slider w-full"
          />
          <div className="flex justify-between text-xs text-[#666680] mt-1">
            <span>1</span>
            <span>20</span>
          </div>
        </div>

        <div className="flex items-center justify-between text-sm text-[#a0a0b8]">
          <span>Available Points</span>
          <span className="text-white font-semibold">20</span>
        </div>

        {bet === 20 && (
          <div className="text-center text-sm font-bold text-[#fbbf24] animate-pulse">
            ALL IN
          </div>
        )}

        <button onClick={onNext} className="btn-primary w-full py-3 text-base">
          Place Bet &amp; See Question
        </button>
      </div>
    </div>
  );
}

// Step 3: Answering
function StepAnswer({ onNext }: { onNext: () => void }) {
  const [selected, setSelected] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = () => {
    setSubmitted(true);
    setTimeout(onNext, 1500);
  };

  return (
    <div className="animate-fade-in">
      <div className="text-center mb-8">
        <div className="text-xs text-[#fbbf24] font-bold mb-2">
          ROUND 3 OF 4
        </div>
        <h2 className="text-2xl font-bold text-white mb-2">
          Answer the Question
        </h2>
        <p className="text-[#a0a0b8] text-sm">
          You bet <span className="text-white font-semibold">15 pts</span>.
          Choose wisely.
        </p>
      </div>

      <div className="card p-6 space-y-5">
        <div className="text-white text-base font-medium">
          {MOCK_QUESTION.text}
        </div>

        <div className="space-y-2">
          {MOCK_QUESTION.options.map((opt) => {
            const isCorrect = opt.label === MOCK_QUESTION.correctAnswer;
            const isSelected = selected === opt.label;
            let className =
              "w-full text-left px-4 py-3 rounded-lg border transition-all text-sm font-medium ";

            if (submitted && isCorrect) {
              className +=
                "border-[#10b981] bg-[#10b981]/20 text-[#10b981]";
            } else if (submitted && isSelected && !isCorrect) {
              className += "border-red-500 bg-red-500/20 text-red-400";
            } else if (isSelected) {
              className += "border-[#e94560] bg-[#e94560]/10 text-white";
            } else {
              className +=
                "border-[#1e3a5f] bg-[#0f0f23] text-[#a0a0b8] hover:border-[#e94560]/50 hover:text-white";
            }

            return (
              <button
                key={opt.label}
                onClick={() => !submitted && setSelected(opt.label)}
                disabled={submitted}
                className={className}
              >
                <span className="font-bold mr-2">{opt.label}.</span>
                {opt.value}
              </button>
            );
          })}
        </div>

        {submitted ? (
          <div
            className={`text-center py-3 rounded-lg font-bold text-lg ${
              selected === MOCK_QUESTION.correctAnswer
                ? "text-[#10b981] bg-[#10b981]/10"
                : "text-red-400 bg-red-500/10"
            }`}
          >
            {selected === MOCK_QUESTION.correctAnswer
              ? "Correct! +15 pts"
              : `Wrong! The answer was ${MOCK_QUESTION.correctLabel}. -15 pts`}
          </div>
        ) : (
          <button
            onClick={handleSubmit}
            disabled={!selected}
            className="btn-primary w-full py-3 text-base disabled:opacity-50"
          >
            Submit Answer
          </button>
        )}
      </div>
    </div>
  );
}

// Step 4: Results
function StepResults({ onNext }: { onNext: () => void }) {
  const rankEmojis = ["", "1st", "2nd", "3rd", "4th"];

  return (
    <div className="animate-fade-in">
      <div className="text-center mb-8">
        <div className="text-xs text-[#fbbf24] font-bold mb-2">
          ROUND 3 COMPLETE
        </div>
        <h2 className="text-2xl font-bold text-white mb-2">Round Results</h2>
        <p className="text-[#a0a0b8] text-sm">
          Scoring inspired by F1: higher bets with correct answers earn more points.
        </p>
      </div>

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#1e3a5f]">
              <th className="text-left py-3 px-4 text-[#666680] font-medium">
                #
              </th>
              <th className="text-left py-3 px-4 text-[#666680] font-medium">
                Player
              </th>
              <th className="text-center py-3 px-4 text-[#666680] font-medium">
                Bet
              </th>
              <th className="text-center py-3 px-4 text-[#666680] font-medium">
                Result
              </th>
              <th className="text-right py-3 px-4 text-[#666680] font-medium">
                Pts
              </th>
            </tr>
          </thead>
          <tbody>
            {MOCK_RESULTS.map((r) => (
              <tr
                key={r.nickname}
                className={`border-b border-[#1e3a5f]/50 ${
                  r.nickname === "You" ? "bg-[#e94560]/5" : ""
                }`}
              >
                <td className="py-3 px-4 font-bold text-[#a0a0b8]">
                  {rankEmojis[r.rank]}
                </td>
                <td className="py-3 px-4">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white"
                      style={{ backgroundColor: r.color }}
                    >
                      {r.nickname[0]}
                    </div>
                    <span
                      className={`font-medium ${
                        r.nickname === "You" ? "text-white" : "text-[#a0a0b8]"
                      }`}
                    >
                      {r.nickname}
                    </span>
                    {r.fastestLap && (
                      <span className="text-[10px] text-[#fbbf24]" title="Fastest Lap">
                        FL
                      </span>
                    )}
                  </div>
                </td>
                <td className="py-3 px-4 text-center text-[#a0a0b8]">
                  {r.bet}
                </td>
                <td className="py-3 px-4 text-center">
                  <span
                    className={`font-semibold ${
                      r.correct ? "text-[#10b981]" : "text-red-400"
                    }`}
                  >
                    {r.pointsWon > 0 ? "+" : ""}
                    {r.pointsWon}
                  </span>
                </td>
                <td className="py-3 px-4 text-right font-bold text-white">
                  {r.f1Points}
                  {r.fastestLap && (
                    <span className="text-[#fbbf24]">+1</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card p-4 mt-4">
        <div className="text-xs text-[#666680] mb-1">Fun Fact</div>
        <p className="text-sm text-[#a0a0b8]">{MOCK_FUN_FACT}</p>
      </div>

      <button
        onClick={onNext}
        className="btn-primary w-full py-3 text-base mt-6"
      >
        Next
      </button>
    </div>
  );
}

// Step 5: CTA
function StepCTA() {
  return (
    <div className="animate-fade-in text-center">
      <div className="mb-8">
        <div className="text-5xl sm:text-6xl font-black tracking-tighter mb-4">
          <span className="text-[#e94560]">BHUTTO</span>
          <br />
          <span className="text-[#fbbf24]">WISDOM</span>
        </div>
      </div>

      <h2 className="text-2xl font-bold text-white mb-3">Ready to Play?</h2>
      <p className="text-[#a0a0b8] text-sm max-w-md mx-auto mb-8">
        Create a league, invite your friends, and prove your wisdom. Each season
        brings new questions, fierce wagering, and a Hall of Fame for the
        sharpest minds.
      </p>

      <div className="flex flex-col gap-3 max-w-xs mx-auto">
        <button
          onClick={() => signIn("google", { callbackUrl: "/profile" })}
          className="btn-primary text-lg px-8 py-3 flex items-center justify-center gap-3"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path
              fill="currentColor"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
            />
            <path
              fill="currentColor"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="currentColor"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
            />
            <path
              fill="currentColor"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
            />
          </svg>
          Sign in with Google
        </button>

        <button
          onClick={() => signIn("apple", { callbackUrl: "/profile" })}
          className="text-lg px-8 py-3 flex items-center justify-center gap-3 rounded-lg font-semibold bg-white text-black hover:bg-gray-100 transition-colors"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path
              fill="currentColor"
              d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"
            />
          </svg>
          Sign in with Apple
        </button>
      </div>

      <a
        href="/"
        className="inline-block mt-6 text-sm text-[#a0a0b8] hover:text-white transition-colors"
      >
        Back to home
      </a>
    </div>
  );
}

export default function DemoPage() {
  const [step, setStep] = useState(1);

  const next = () => setStep((s) => Math.min(s + 1, TOTAL_STEPS));
  const back = () => setStep((s) => Math.max(s - 1, 1));

  return (
    <div className="min-h-screen flex flex-col">
      <DemoHeader step={step} />

      <div className="flex-1 flex flex-col items-center justify-center px-4 py-10">
        <div className="w-full max-w-lg">
          {step === 1 && <StepWorkshop onNext={next} />}
          {step === 2 && <StepSubmitQuestion onNext={next} />}
          {step === 3 && <StepBetting onNext={next} />}
          {step === 4 && <StepAnswer onNext={next} />}
          {step === 5 && <StepResults onNext={next} />}
          {step === 6 && <StepCTA />}
        </div>
      </div>

      {step > 1 && step < 6 && (
        <div className="px-4 py-4 border-t border-[#1e3a5f]">
          <div className="max-w-lg mx-auto">
            <button
              onClick={back}
              className="text-sm text-[#a0a0b8] hover:text-white transition-colors"
            >
              &larr; Back
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

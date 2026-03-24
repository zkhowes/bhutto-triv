# Plain Text Question Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Soft-deprecate free text questions by defaulting to MC, adding AI format suggestions, biasing the workshop, and boosting MC/PiR quality ratings.

**Architecture:** Four independent changes: (1) UI default to MC (already done in current code), (2) workshop system prompt bias, (3) new AI format suggestion endpoint + inline UI, (4) quality composite scoring boost. Changes 1-2 are trivial, 3 is the main work, 4 is a one-liner.

**Tech Stack:** Next.js App Router, TypeScript, Anthropic SDK (Haiku), Tailwind CSS

---

### Task 1: Bias Workshop System Prompt Toward MC/PiR

**Files:**
- Modify: `src/lib/ai.ts:115-170` (WORKSHOP_SYSTEM_PROMPT)

- [ ] **Step 1: Update the workshop system prompt**

In `src/lib/ai.ts`, replace line 166:
```
- Mix up the answer formats across the 3 variations
```
with:
```
- STRONGLY prefer multiple_choice and price_is_right formats. Only use free_text when the question genuinely requires an open-ended answer (e.g., "Name the country...", "Who said..."). At least 2 of the 3 variations should be multiple_choice or price_is_right.
```

- [ ] **Step 2: Verify build passes**

Run: `./node_modules/.bin/next build`
Expected: Build succeeds

- [ ] **Step 3: Commit**

```bash
git add src/lib/ai.ts
git commit -m "feat: bias AI workshop toward MC and PiR formats"
```

---

### Task 2: Add `suggestFormat()` AI Function

**Files:**
- Modify: `src/lib/ai.ts` (add new export after `generateHint`)

- [ ] **Step 1: Add the suggestFormat function to ai.ts**

Add after the `generateHint` function (after line 435):

```typescript
/**
 * Suggest a better answer format for a free-text question.
 * Returns null if free text is the best fit.
 */
export interface FormatSuggestion {
  suggestedFormat: "multiple_choice" | "price_is_right";
  message: string;
  options?: {
    optionA: string;
    optionB: string;
    optionC: string;
    optionD: string;
    correctOption: "A" | "B" | "C" | "D";
  };
}

export async function suggestFormat(
  questionText: string,
  correctAnswer: string,
  acceptableAnswers: string[]
): Promise<FormatSuggestion | null> {
  if (!process.env.ANTHROPIC_API_KEY) return null;

  try {
    const anthropic = getClient();
    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 500,
      messages: [
        {
          role: "user",
          content: `You are helping a trivia game question submitter pick the best answer format.

The submitter wrote a free-text question. Analyze whether it would work better as multiple choice or Price is Right.

Question: ${questionText}
Correct answer: ${correctAnswer}
${acceptableAnswers.length > 0 ? `Also acceptable: ${acceptableAnswers.join(", ")}` : ""}

Rules:
- If the answer is a number (year, count, measurement, price, distance, etc.), suggest "price_is_right"
- If the answer is one of a clear set of options (a person, place, thing where you can generate 3 plausible wrong answers), suggest "multiple_choice" and provide 4 options (A-D) with the correct one marked
- If the question genuinely needs an open-ended text answer (the answer space is too large for MC, and is not numeric), return null

Respond with JSON only. Either:
{"suggestedFormat": "multiple_choice", "message": "This would work great as multiple choice!", "options": {"optionA": "...", "optionB": "...", "optionC": "...", "optionD": "...", "correctOption": "A"}}
or:
{"suggestedFormat": "price_is_right", "message": "That number would make a great Price is Right question!"}
or:
null`,
        },
      ],
    });

    const text = response.content[0].type === "text" ? response.content[0].text : "";
    const trimmed = text.trim();
    if (trimmed === "null" || trimmed === "") return null;
    const parsed = JSON.parse(trimmed);
    if (!parsed || !parsed.suggestedFormat) return null;
    return parsed as FormatSuggestion;
  } catch {
    return null;
  }
}
```

- [ ] **Step 2: Verify build passes**

Run: `./node_modules/.bin/next build`
Expected: Build succeeds

- [ ] **Step 3: Commit**

```bash
git add src/lib/ai.ts
git commit -m "feat: add suggestFormat AI function for format recommendations"
```

---

### Task 3: Add API Endpoint for Format Suggestion

**Files:**
- Create: `src/app/api/questions/suggest-format/route.ts`

- [ ] **Step 1: Create the API route**

Create `src/app/api/questions/suggest-format/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { suggestFormat } from "@/lib/ai";
import { checkRateLimit } from "@/lib/rate-limit";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const limited = checkRateLimit(`suggest-format:${session.user.id}`, 10, 60000);
  if (!limited.allowed) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const { questionText, correctAnswer, acceptableAnswers } = await req.json();

  if (!questionText || !correctAnswer) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const suggestion = await suggestFormat(
    questionText,
    correctAnswer,
    acceptableAnswers || []
  );

  return NextResponse.json({ suggestion });
}
```

- [ ] **Step 2: Verify build passes**

Run: `./node_modules/.bin/next build`
Expected: Build succeeds

- [ ] **Step 3: Commit**

```bash
git add src/app/api/questions/suggest-format/route.ts
git commit -m "feat: add suggest-format API endpoint"
```

---

### Task 4: Add Format Suggestion UI to QuestionSubmitForm

**Files:**
- Modify: `src/components/question/QuestionSubmitForm.tsx`

- [ ] **Step 1: Add state variables for format suggestion**

After the `difficultyLoading` state (line 69), add:

```typescript
// Format suggestion
const [formatSuggestion, setFormatSuggestion] = useState<{
  suggestedFormat: "multiple_choice" | "price_is_right";
  message: string;
  options?: {
    optionA: string;
    optionB: string;
    optionC: string;
    optionD: string;
    correctOption: string;
  };
} | null>(null);
const [formatSuggestionLoading, setFormatSuggestionLoading] = useState(false);
const [formatSuggestionDismissed, setFormatSuggestionDismissed] = useState(false);
```

- [ ] **Step 2: Add the suggestion fetch function**

After the `checkDifficulty` function (after line 257), add:

```typescript
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
```

- [ ] **Step 3: Add the convert handler**

After `fetchFormatSuggestion`, add:

```typescript
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
    // correctAnswer is already set
  }
  setFormatSuggestion(null);
};
```

- [ ] **Step 4: Clear suggestion state when format changes**

In each format button's `onClick` handler (lines 443, 456, 465), add after the `setAnswerFormat` call:

```typescript
setFormatSuggestion(null);
setFormatSuggestionDismissed(false);
```

- [ ] **Step 5: Add the suggestion UI below the free text answer fields**

After the free text answer section closing `</div>` (after line 541, inside the `answerFormat === "free_text"` block), add a "Check Format" button and suggestion display:

```tsx
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
            Convert to {formatSuggestion.suggestedFormat === "multiple_choice" ? "Multiple Choice" : "Price is Right"}
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
```

- [ ] **Step 6: Verify build passes**

Run: `./node_modules/.bin/next build`
Expected: Build succeeds

- [ ] **Step 7: Commit**

```bash
git add src/components/question/QuestionSubmitForm.tsx
git commit -m "feat: add format suggestion UI to question submission form"
```

---

### Task 5: Add Quality Rating Boost for MC/PiR

**Files:**
- Modify: `src/lib/scoring.ts:220-252` (computeQuestionComposite)

- [ ] **Step 1: Add format boost to computeQuestionComposite**

In `computeQuestionComposite` (line 226), after the null check `if (avgRating === null) return null;`, add:

```typescript
// Slight quality boost for MC and PiR formats to incentivize structured questions
const formatBoost = answerFormat !== "free_text" ? 0.5 : 0;
```

Then update the two return paths:

At line 249 (the composite return), change:
```typescript
return Math.round((avgRating * 0.7 + Math.max(0, difficultyScore) * 0.3) * 10) / 10;
```
to:
```typescript
const raw = avgRating * 0.7 + Math.max(0, difficultyScore) * 0.3 + formatBoost;
return Math.round(Math.min(5, raw) * 10) / 10;
```

At line 251 (the fallback return), change:
```typescript
return avgRating;
```
to:
```typescript
return Math.round(Math.min(5, avgRating + formatBoost) * 10) / 10;
```

- [ ] **Step 2: Update existing scoring tests**

Check if any existing tests for `computeQuestionComposite` need updating to account for the new boost. Run:

```bash
./node_modules/.bin/vitest run src/lib/scoring.test.ts
```

Fix any failures caused by the new +0.5 boost.

- [ ] **Step 3: Verify build passes**

Run: `./node_modules/.bin/next build`
Expected: Build succeeds

- [ ] **Step 4: Commit**

```bash
git add src/lib/scoring.ts src/lib/scoring.test.ts
git commit -m "feat: add +0.5 quality rating boost for MC and PiR questions"
```

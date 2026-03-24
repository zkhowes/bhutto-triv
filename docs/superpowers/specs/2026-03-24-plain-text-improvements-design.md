# Plain Text Question Improvements

Soft-deprecate free text answer format by steering question submitters toward MC/PiR through UI defaults, AI suggestions, and a subtle quality rating boost.

## Problem

Plain text (free text) questions create worse gameplay:
- Submitters write questions poorly suited to free text (numeric answers, questions with obvious MC structure)
- Players write ambiguous answers that feel unsatisfying to grade
- Free text rounds feel less engaging than MC and PiR — less tension, less strategy

## Design

### 1. Default Format to Multiple Choice

**Format selector defaults to MC** instead of the current equal-weight three-button layout.

- MC is pre-selected when the question form loads
- Free Text and PiR remain visible as single-tap options — not buried or gated
- No warning labels or "advanced" markers on free text

### 2. Workshop Bias Toward MC/PiR

Update the AI workshop system prompt to strongly prefer MC and PiR variations.

- Current behavior: "mix up answer formats across 3 variations"
- New behavior: prefer MC and PiR; only generate free text when the question genuinely requires open-ended recall (e.g., "Name the...")
- No changes to workshop UI or card structure

### 3. AI Format Advisor on Submission

When a player selects free text and fills in both question text and answer, a lightweight AI call (Haiku) analyzes the question and suggests a better format:

- **Numeric answer** -> suggests PiR: "That number would make a great Price is Right question" + one-click "Convert to PiR" button
- **Answer with obvious wrong options** -> suggests MC: generates 3 plausible wrong answers + one-click "Convert to MC" button that pre-fills options A-D
- **Free text is the right fit** -> no suggestion shown

**UX details:**
- Suggestion appears inline below the answer field (not a modal, not blocking)
- Trigger: debounced, fires when player has entered both question text and a free text answer (on blur of answer field or after typing pause)
- Player can ignore the suggestion entirely
- Single AI call per trigger (Haiku — cheap, fast)

**AI response schema:**
```json
{
  "shouldConvert": boolean,
  "suggestedFormat": "multiple_choice" | "price_is_right" | null,
  "message": string,
  "options": {  // only when suggestedFormat is "multiple_choice"
    "optionA": string,
    "optionB": string,
    "optionC": string,
    "optionD": string,
    "correctOption": "A" | "B" | "C" | "D"
  },
  "pirValue": string | null  // only when suggestedFormat is "price_is_right"
}
```

### 4. Quality Rating Boost for MC/PiR

In the question quality composite calculation (`scoring.ts`), MC and PiR questions get a small additive boost.

- Boost: +0.5 on the 1-5 scale (before clamping to 1-5 range)
- Affects: quality stats, hall of fame rankings, workshop feedback
- Does NOT affect: F1 points, placement, game scoring, or any gameplay outcome
- Free text questions are not penalized — they just don't receive the bump

## Files to Modify

- `src/components/question/QuestionSubmitForm.tsx` — default format to MC, add AI advisor UI
- `src/lib/ai.ts` — new `suggestFormat()` function, update workshop system prompt
- `src/app/api/questions/suggest-format/route.ts` — new API endpoint for format suggestion
- `src/lib/scoring.ts` — quality composite boost for MC/PiR

## Out of Scope

- Removing free text as an option
- Changing game points or F1 scoring based on format
- Blocking free text submission
- Changes to answer grading logic

import Anthropic from "@anthropic-ai/sdk";
import { classifyOrderingDirection } from "./scoring";

let client: Anthropic | null = null;

function getClient(): Anthropic {
  if (!client) {
    client = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY || "",
    });
  }
  return client;
}

/**
 * Grade a free-text answer using AI fuzzy matching
 */
export async function gradeAnswer(
  question: string,
  correctAnswer: string,
  acceptableAnswers: string[],
  playerAnswer: string
): Promise<{ isCorrect: boolean; confidence: number; reasoning: string }> {
  if (!process.env.ANTHROPIC_API_KEY) {
    // Fallback: simple string matching
    return fallbackGrading(correctAnswer, acceptableAnswers, playerAnswer);
  }

  try {
    const anthropic = getClient();
    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 300,
      messages: [
        {
          role: "user",
          content: `You are grading a trivia answer. Determine if the player's answer is correct.

Question: ${question}
Correct answer: ${correctAnswer}
Also acceptable: ${acceptableAnswers.join(", ") || "none specified"}
Player's answer: ${playerAnswer}

Consider common variations, abbreviations, and spelling differences.
For example, "Barack Obama" = "Obama" = "President Obama" should all be correct.

Respond with JSON only:
{"isCorrect": true/false, "confidence": 0.0-1.0, "reasoning": "brief explanation"}`,
        },
      ],
    });

    const text =
      response.content[0].type === "text" ? response.content[0].text : "";
    const parsed = JSON.parse(text);
    return {
      isCorrect: parsed.isCorrect,
      confidence: parsed.confidence,
      reasoning: parsed.reasoning,
    };
  } catch {
    return fallbackGrading(correctAnswer, acceptableAnswers, playerAnswer);
  }
}

function fallbackGrading(
  correctAnswer: string,
  acceptableAnswers: string[],
  playerAnswer: string
): { isCorrect: boolean; confidence: number; reasoning: string } {
  const normalize = (s: string) =>
    s
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s]/g, "");
  const normalizedPlayer = normalize(playerAnswer);
  const allAcceptable = [correctAnswer, ...acceptableAnswers].map(normalize);
  const isCorrect = allAcceptable.some(
    (a) =>
      a === normalizedPlayer ||
      normalizedPlayer.includes(a) ||
      a.includes(normalizedPlayer)
  );
  return {
    isCorrect,
    confidence: isCorrect ? 0.8 : 0.7,
    reasoning: "Graded by text matching (AI unavailable)",
  };
}

/**
 * Workshop question variation returned by AI
 */
export interface WorkshopVariation {
  category: string;
  questionText: string;
  answerFormat: "multiple_choice" | "free_text" | "price_is_right" | "ordering";
  optionA?: string;
  optionB?: string;
  optionC?: string;
  optionD?: string;
  correctOption?: string;
  correctAnswer?: string;
  correctAnswerUnit?: string;
  acceptableAnswers?: string[];
  orderingItems?: string[];
  orderingCorrectOrder?: number[];
  orderingDirection?: string;
  orderingItemValues?: Array<string | number | null>;
  difficulty: "easy" | "medium" | "hard";
  hook: string;
  imageSearchTerm?: string;
}

export interface WorkshopResponse {
  type: "questions" | "conversation";
  variations?: WorkshopVariation[];
  text?: string;
}

const WORKSHOP_SYSTEM_PROMPT = `You are a trivia question workshop for "Bhutto Wisdom", a competitive trivia game.

When the user asks you to create a question or gives you a topic, return EXACTLY a JSON object with 3 creative question variations. Each variation should explore a DIFFERENT angle, difficulty level, and answer format. Be creative — don't just reformat the same question 3 times.

Answer formats:
- "multiple_choice": 4 options (optionA-D), one correctOption (A/B/C/D)
- "price_is_right" (Closest Guess): numeric correctAnswer (as string). Closest guess by absolute distance wins — going over does NOT lose. ALWAYS include correctAnswerUnit when the answer has a natural unit (miles, tons, years, °F, %, dollars, etc.); use a short noun phrase. Omit only when the number is truly unitless (a count). Never embed the unit in correctAnswer itself.
- "ordering": 3-4 items in orderingItems array, orderingCorrectOrder MUST be [1,2,3,4] in strictly ascending order — that is, list orderingItems IN THE CORRECT ORDER (position 1 first). orderingDirection is REQUIRED (e.g. "most to least", "earliest to latest", "least to most", "latest to earliest"). orderingItemValues is REQUIRED: a parallel array of the comparable scalar each item is being ordered by (year, population, GDP, etc.) — same length and index alignment as orderingItems, every entry non-null. CRITICAL self-check: sort orderingItemValues according to orderingDirection; the resulting order MUST match orderingItems. If "earliest to latest", orderingItems[0]'s value must be the smallest (earliest year); if "largest to smallest", orderingItems[0]'s value must be the largest. If you cannot produce comparable scalars for every item, do NOT use ordering — pick a different format.

DO NOT generate "free_text" variations. Only multiple_choice, price_is_right, and ordering are accepted. If a topic seems to call for an open-ended answer, reframe it as multiple_choice instead.

Default categories: Geography, Sports, Politics, Science, History, Entertainment, Arts & Literature, Food & Drink, Technology, General Knowledge

Players can also create custom categories (e.g., "Historical Bad Asses", "Every Man Should Know"). Feel free to suggest custom categories when they fit the topic better than a default.

Return this exact JSON structure:
{
  "type": "questions",
  "variations": [
    {
      "category": "History",
      "questionText": "...",
      "answerFormat": "multiple_choice",
      "optionA": "...", "optionB": "...", "optionC": "...", "optionD": "...",
      "correctOption": "A",
      "difficulty": "medium",
      "hook": "A tricky one about..."
    },
    {
      "category": "History",
      "questionText": "...",
      "answerFormat": "ordering",
      "orderingItems": ["earliest item", "next item", "later item", "latest item"],
      "orderingCorrectOrder": [1, 2, 3, 4],
      "orderingDirection": "earliest to latest",
      "orderingItemValues": [1977, 1990, 2001, 2008],
      "difficulty": "hard",
      "hook": "Put these in order...",
      "imageSearchTerm": null
    },
    {
      "category": "Geography",
      "questionText": "...",
      "answerFormat": "price_is_right",
      "correctAnswer": "1907",
      "correctAnswerUnit": "miles",
      "difficulty": "easy",
      "hook": "How well do you know...",
      "imageSearchTerm": "a short search query for an accompanying image, or null if the question doesn't benefit from one"
    }
  ]
}

Rules:
- "hook" is a short 5-8 word teaser for each card
- "imageSearchTerm": a concise, specific search query for an image that enhances the question, or null if no image would add value
- All variations must use multiple_choice, price_is_right, or ordering. Never free_text.
- Each variation should feel genuinely different, not a rewrite
- Return ONLY valid JSON, no markdown fences, no extra text
- If the user is having a conversation (not asking for a question), return: {"type": "conversation", "text": "your response here"}
- Actively look for opportunities to suggest image-based questions. Visual identification questions ("Who is this?", "Name this landmark", "What flag is this?") are high-joy and engaging. When a question would benefit from an image, populate imageSearchTerm with a concise, specific search query. Not every question needs an image — only suggest when it genuinely adds to the experience.`;

/**
 * AI-assisted question workshop — returns structured JSON with 3 variations
 */
export async function workshopQuestion(
  prompt: string
): Promise<WorkshopResponse> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return { type: "conversation", text: "AI assistance is not available. Please configure your ANTHROPIC_API_KEY to use the question workshop." };
  }

  try {
    const anthropic = getClient();
    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1500,
      system: WORKSHOP_SYSTEM_PROMPT,
      messages: [{ role: "user", content: prompt }],
    });

    const text = response.content[0].type === "text" ? response.content[0].text : "";
    return await enforceOrderingValidation(parseWorkshopResponse(text));
  } catch {
    return { type: "conversation", text: "AI workshop is temporarily unavailable. Please try again later." };
  }
}

/**
 * Edit a workshop question — takes a selected question + instruction, returns 3 new variations
 */
export async function editWorkshopQuestion(
  currentQuestion: WorkshopVariation,
  instruction: string
): Promise<WorkshopResponse> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return { type: "conversation", text: "AI assistance is not available." };
  }

  try {
    const anthropic = getClient();
    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1500,
      system: WORKSHOP_SYSTEM_PROMPT,
      messages: [{
        role: "user",
        content: `Here is an existing trivia question I want to modify:

${JSON.stringify(currentQuestion, null, 2)}

Modification request: ${instruction}

Return 3 new variations. The first should be the edited version incorporating my feedback. The other two should be creative alternatives inspired by the modification.`,
      }],
    });

    const text = response.content[0].type === "text" ? response.content[0].text : "";
    return await enforceOrderingValidation(parseWorkshopResponse(text));
  } catch {
    return { type: "conversation", text: "AI workshop is temporarily unavailable. Please try again later." };
  }
}

function parseWorkshopResponse(text: string): WorkshopResponse {
  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return { type: "conversation", text };
    const parsed = JSON.parse(jsonMatch[0]);
    if (parsed.type === "questions" && Array.isArray(parsed.variations)) {
      return parsed as WorkshopResponse;
    }
    if (parsed.type === "conversation" && parsed.text) {
      return parsed as WorkshopResponse;
    }
    return { type: "conversation", text };
  } catch {
    return { type: "conversation", text };
  }
}

/**
 * Compare two ordering values. Numeric strings are compared numerically.
 */
function compareOrderingValues(a: string | number, b: string | number): number {
  const aNum = typeof a === "number" ? a : Number(a);
  const bNum = typeof b === "number" ? b : Number(b);
  if (!isNaN(aNum) && !isNaN(bNum)) return aNum - bNum;
  return String(a).localeCompare(String(b));
}

/**
 * Validate an ordering variation. Returns null when valid, or a string
 * describing the first problem when invalid. Equal values are treated as ties
 * (any relative order between them is OK).
 */
export function validateOrderingPayload(v: WorkshopVariation): string | null {
  if (v.answerFormat !== "ordering") return null;

  const items = v.orderingItems;
  const order = v.orderingCorrectOrder;
  const direction = v.orderingDirection;
  const values = v.orderingItemValues;

  if (!Array.isArray(items) || items.length < 3 || items.length > 4) {
    return "orderingItems must contain 3-4 items";
  }
  if (!Array.isArray(order) || order.length !== items.length) {
    return "orderingCorrectOrder length must match orderingItems length";
  }
  // Contract: items are listed in correct order, so orderingCorrectOrder must be [1..n].
  for (let i = 0; i < order.length; i++) {
    if (order[i] !== i + 1) {
      return `orderingCorrectOrder must be ascending [1..n] (items listed in correct order); got ${JSON.stringify(order)}`;
    }
  }
  if (!direction || direction.trim().length === 0) {
    return "orderingDirection is required";
  }

  // orderingItemValues is required: without comparable scalars per item we
  // can't verify that orderingItems actually align with orderingDirection,
  // and a silently-inverted question would grade the wrong way (see Yap
  // S4G2R1, 2026-04-30).
  if (!Array.isArray(values)) {
    return "orderingItemValues is required (parallel array of comparable scalars per item)";
  }
  if (values.length !== items.length) {
    return "orderingItemValues length must match orderingItems length";
  }
  if (!values.every((x) => x !== null && x !== undefined && x !== "")) {
    return "orderingItemValues must have a value for every item";
  }

  const sense = classifyOrderingDirection(direction);
  // Recognized direction → enforce values align with it. Unrecognized direction
  // phrasings (e.g. "by alphabet") still pass — values are just opaque.
  if (sense) {
    const typed = values as Array<string | number>;
    for (let i = 0; i < typed.length - 1; i++) {
      const cmp = compareOrderingValues(typed[i], typed[i + 1]);
      if (sense === "ascending" && cmp > 0) {
        return `orderingItemValues not in '${direction}' order at index ${i}: ${typed[i]} > ${typed[i + 1]}`;
      }
      if (sense === "descending" && cmp < 0) {
        return `orderingItemValues not in '${direction}' order at index ${i}: ${typed[i]} < ${typed[i + 1]}`;
      }
    }
  }

  return null;
}

/**
 * Ask the model to fix an ordering variation that failed validation. One retry only.
 * Returns the corrected variation or null if the retry still fails.
 */
async function repairOrderingVariation(
  v: WorkshopVariation,
  problem: string
): Promise<WorkshopVariation | null> {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  try {
    const anthropic = getClient();
    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 800,
      system: WORKSHOP_SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: `The following ordering variation failed validation: ${problem}

Original variation:
${JSON.stringify(v, null, 2)}

Return EXACTLY ONE corrected variation as JSON (not wrapped in {"variations": [...]}). Fix the order of orderingItems and/or orderingItemValues so they are consistent with orderingDirection. orderingCorrectOrder MUST be [1..n]. Return ONLY the JSON object, no commentary.`,
        },
      ],
    });
    const text = response.content[0].type === "text" ? response.content[0].text : "";
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return null;
    const fixed = JSON.parse(match[0]) as WorkshopVariation;
    if (validateOrderingPayload(fixed) === null) return fixed;
    return null;
  } catch {
    return null;
  }
}

/**
 * Walk variations: drop any free_text (deprecated for new questions),
 * validate ordering ones, attempt one repair pass, drop on second failure.
 * Mutates the response in place. Logs how many variations were dropped.
 */
async function enforceOrderingValidation(resp: WorkshopResponse): Promise<WorkshopResponse> {
  if (resp.type !== "questions" || !Array.isArray(resp.variations)) return resp;
  const kept: WorkshopVariation[] = [];
  let dropped = 0;
  for (const v of resp.variations) {
    if (v.answerFormat === "free_text") {
      dropped++;
      console.warn("[workshop] dropped free_text variation (no longer supported for new questions)");
      continue;
    }
    if (v.answerFormat !== "ordering") {
      kept.push(v);
      continue;
    }
    const problem = validateOrderingPayload(v);
    if (problem === null) {
      kept.push(v);
      continue;
    }
    const fixed = await repairOrderingVariation(v, problem);
    if (fixed) {
      kept.push(fixed);
    } else {
      dropped++;
      console.warn("[workshop] dropped invalid ordering variation:", problem);
    }
  }
  resp.variations = kept;
  if (dropped > 0) {
    console.warn(`[workshop] dropped ${dropped} variation(s) after filtering`);
  }
  return resp;
}

/**
 * Generate a fun fact related to a trivia question
 */
export async function generateFunFact(
  question: string,
  answer: string,
  category: string
): Promise<string> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return "";
  }

  try {
    const anthropic = getClient();
    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 200,
      messages: [
        {
          role: "user",
          content: `Given this trivia question and answer, share one interesting "Did You Know?" fact related to the topic. Keep it to 1-2 sentences, fun and educational.

Category: ${category}
Question: ${question}
Answer: ${answer}

Respond with just the fact, no prefix.`,
        },
      ],
    });

    return response.content[0].type === "text" ? response.content[0].text : "";
  } catch {
    return "";
  }
}

/**
 * Generate an AI SVG avatar based on a description
 */
export async function generateAvatarSvg(description: string): Promise<string> {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("AI is not configured");
  }

  const anthropic = getClient();
  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 2000,
    messages: [
      {
        role: "user",
        content: `Generate a simple, clean SVG avatar image (64x64 pixels) based on this description: "${description}"

Requirements:
- Must be valid SVG markup starting with <svg> and ending with </svg>
- 64x64 viewBox
- Use simple shapes (circles, rects, paths) - keep it minimal
- Use bright, fun colors on a colored background
- Make it look like a stylized avatar/icon
- No text in the SVG
- Return ONLY the SVG markup, nothing else`,
      },
    ],
  });

  const text = response.content[0].type === "text" ? response.content[0].text : "";
  // Extract SVG from response
  const svgMatch = text.match(/<svg[\s\S]*?<\/svg>/i);
  if (!svgMatch) throw new Error("Failed to generate SVG");

  const svg = svgMatch[0];
  const base64 = Buffer.from(svg).toString("base64");
  return `data:image/svg+xml;base64,${base64}`;
}

/**
 * Parse AI workshop text into structured question fields with both MC and free text formats
 */
export async function parseQuestionFromText(text: string): Promise<{
  category: string;
  questionText: string;
  multipleChoice: {
    optionA: string;
    optionB: string;
    optionC: string;
    optionD: string;
    correctOption: string;
  };
  freeText: {
    correctAnswer: string;
    acceptableAnswers: string[];
  };
} | null> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return null;
  }

  try {
    const anthropic = getClient();
    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 600,
      messages: [
        {
          role: "user",
          content: `Parse this text into a structured trivia question and provide BOTH multiple choice and free text formats.

Default categories: Geography, Sports, Politics, Science, History, Entertainment, Arts & Literature, Food & Drink, Technology, General Knowledge
Custom categories are also allowed — use one if it fits the question better than a default.

Text to parse:
${text}

Respond with JSON only:
{
  "category": "one of the categories above",
  "questionText": "the question text",
  "multipleChoice": {
    "optionA": "first option",
    "optionB": "second option",
    "optionC": "third option",
    "optionD": "fourth option",
    "correctOption": "A"
  },
  "freeText": {
    "correctAnswer": "the exact correct answer",
    "acceptableAnswers": ["variation1", "variation2"]
  }
}

If the text doesn't contain a clear question, return null.`,
        },
      ],
    });

    const responseText =
      response.content[0].type === "text" ? response.content[0].text : "";
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;
    const parsed = JSON.parse(jsonMatch[0]);
    if (!parsed || parsed === "null" || !parsed.questionText) return null;
    return parsed;
  } catch {
    return null;
  }
}

/**
 * Generate a hint for a free-text question without revealing the answer
 */
export async function generateHint(
  questionText: string,
  correctAnswer: string,
  acceptableAnswers: string[]
): Promise<string> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return "No hint available (AI not configured).";
  }

  try {
    const anthropic = getClient();
    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 150,
      messages: [
        {
          role: "user",
          content: `You are giving a helpful hint for a trivia question. Give a hint that narrows down the answer WITHOUT revealing it directly.

Question: ${questionText}
Correct answer: ${correctAnswer}
${acceptableAnswers.length > 0 ? `Also acceptable: ${acceptableAnswers.join(", ")}` : ""}

Respond with a single helpful hint sentence only, no preamble.`,
        },
      ],
    });
    return response.content[0].type === "text"
      ? response.content[0].text.trim()
      : "Think carefully about the category and context.";
  } catch {
    return "Think carefully about the category and context.";
  }
}

/**
 * Suggest a better answer format for a free-text question.
 * Returns null if free text is the best fit.
 */
export interface FormatSuggestion {
  suggestedFormat: "multiple_choice" | "price_is_right" | "ordering";
  message: string;
  options?: {
    optionA: string;
    optionB: string;
    optionC: string;
    optionD: string;
    correctOption: "A" | "B" | "C" | "D";
  };
  correctAnswerUnit?: string;
  orderingItems?: string[];
  orderingDirection?: string;
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

The submitter wrote a free-text question. Analyze whether it would work better as multiple choice or Closest Guess (numeric, closest by absolute distance wins).

Question: ${questionText}
Correct answer: ${correctAnswer}
${acceptableAnswers.length > 0 ? `Also acceptable: ${acceptableAnswers.join(", ")}` : ""}

Rules:
- If the answer is a number (year, count, measurement, price, distance, etc.), suggest "price_is_right" and ALWAYS include a correctAnswerUnit (e.g. "miles", "tons", "years", "%", "$") unless the number is truly unitless. Strip any unit out of the number itself.
- If the answer is one of a clear set of options (a person, place, thing where you can generate 3 plausible wrong answers), suggest "multiple_choice" and provide 4 options (A-D) with the correct one marked
- If the question involves ranking, ordering, chronology, or sequencing (e.g. "which came first", "rank these", "order from biggest to smallest"), suggest "ordering" with 3-4 items and a direction
- If the question genuinely needs an open-ended text answer (the answer space is too large for MC, and is not numeric), return null

Respond with JSON only. Either:
{"suggestedFormat": "multiple_choice", "message": "This would work great as multiple choice!", "options": {"optionA": "...", "optionB": "...", "optionC": "...", "optionD": "...", "correctOption": "A"}}
or:
{"suggestedFormat": "price_is_right", "message": "That number would make a great Closest Guess question!", "correctAnswerUnit": "miles"}
or:
{"suggestedFormat": "ordering", "message": "This would make a great ordering question!", "orderingItems": ["item1", "item2", "item3"], "orderingDirection": "earliest to latest"}
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

/**
 * For a multiple choice question, identify a wrong option to eliminate as a helpful hint
 */
export async function eliminateWrongOption(
  questionText: string,
  optionA: string,
  optionB: string,
  optionC: string,
  optionD: string,
  correctOption: string
): Promise<"A" | "B" | "C" | "D"> {
  if (!process.env.ANTHROPIC_API_KEY) {
    // Fallback: return first non-correct option
    const wrong = (["A", "B", "C", "D"] as const).find(
      (o) => o !== correctOption
    );
    return wrong || "A";
  }

  try {
    const anthropic = getClient();
    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 50,
      messages: [
        {
          role: "user",
          content: `For this trivia question, pick one WRONG answer option to eliminate. Choose the one that is most clearly wrong, to give players a useful hint. Do NOT eliminate the correct answer (${correctOption}).

Question: ${questionText}
A: ${optionA}
B: ${optionB}
C: ${optionC}
D: ${optionD}
Correct: ${correctOption}

Respond with a single letter only: A, B, C, or D (must NOT be ${correctOption}).`,
        },
      ],
    });

    const text =
      response.content[0].type === "text"
        ? response.content[0].text.trim().toUpperCase()
        : "";
    if (["A", "B", "C", "D"].includes(text) && text !== correctOption) {
      return text as "A" | "B" | "C" | "D";
    }
    // Fallback: first non-correct option
    const wrong = (["A", "B", "C", "D"] as const).find(
      (o) => o !== correctOption
    );
    return wrong || "A";
  } catch {
    const wrong = (["A", "B", "C", "D"] as const).find(
      (o) => o !== correctOption
    );
    return wrong || "A";
  }
}

/**
 * Assess question difficulty based on the question content and league historical stats
 */
export async function assessQuestionDifficulty(
  question: string,
  leagueStats: {
    overallCorrectRate: number;
    categoryCorrectRates: Record<string, number>;
    category: string;
    answerFormat?: string;
    correctAnswer?: string;
    correctOption?: string;
    options?: { optionA?: string; optionB?: string; optionC?: string; optionD?: string };
  }
): Promise<{ difficulty: "easy" | "medium" | "hard"; reasoning: string; categoryMismatch: boolean; categoryNote: string }> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return { difficulty: "medium", reasoning: "AI not configured", categoryMismatch: false, categoryNote: "" };
  }

  try {
    const anthropic = getClient();
    const categoryRate = leagueStats.categoryCorrectRates[leagueStats.category];

    // Build answer context so the AI can assess difficulty properly
    let answerContext = "";
    if (leagueStats.answerFormat) {
      answerContext += `\nAnswer format: ${leagueStats.answerFormat}`;
    }
    if (leagueStats.answerFormat === "multiple_choice" && leagueStats.options) {
      const opts = leagueStats.options;
      answerContext += `\nOptions: A) ${opts.optionA} B) ${opts.optionB} C) ${opts.optionC} D) ${opts.optionD}`;
      if (leagueStats.correctOption) answerContext += `\nCorrect: ${leagueStats.correctOption}`;
    } else if (leagueStats.answerFormat === "price_is_right" && leagueStats.correctAnswer) {
      answerContext += `\nCorrect answer (numeric): ${leagueStats.correctAnswer}`;
      answerContext += `\nPlayers must guess closest by absolute distance (over or under both fine) — consider how guessable the number is`;
    } else if (leagueStats.correctAnswer) {
      answerContext += `\nCorrect answer: ${leagueStats.correctAnswer}`;
    }

    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 300,
      messages: [
        {
          role: "user",
          content: `You are assessing the difficulty of a trivia question for a competitive trivia game.

Question: ${question}
Category: ${leagueStats.category}${answerContext}

League stats:
- Overall correct answer rate: ${Math.round(leagueStats.overallCorrectRate * 100)}%
${categoryRate !== undefined ? `- Correct rate for ${leagueStats.category}: ${Math.round(categoryRate * 100)}%` : "- No history for this category yet"}

Assess whether this question is easy, medium, or hard relative to typical trivia questions. Consider:
- How obscure or specialized the knowledge is
- Whether there are common misconceptions that might trip people up
- The league's historical performance in this category
- For numeric/price-is-right questions: how likely players are to know the right ballpark

Also check if the stated category fits the question content. If the question doesn't match the category (e.g. a beer question categorized as "Geography"), flag it.

Respond with ONLY a JSON object, no other text:
{"difficulty": "easy"|"medium"|"hard", "reasoning": "...", "categoryMismatch": false, "categoryNote": ""}`,
        },
      ],
    });

    const text =
      response.content[0].type === "text" ? response.content[0].text : "";
    // Extract JSON from response (handle potential markdown wrapping)
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return { difficulty: "medium", reasoning: "Could not parse AI response", categoryMismatch: false, categoryNote: "" };
    }
    const parsed = JSON.parse(jsonMatch[0]);
    let reasoning = parsed.reasoning || "";
    if (parsed.categoryMismatch && parsed.categoryNote) {
      reasoning = `Category check: ${parsed.categoryNote}. ${reasoning}`;
    }
    return {
      difficulty: parsed.difficulty,
      reasoning,
      categoryMismatch: !!parsed.categoryMismatch,
      categoryNote: parsed.categoryNote || "",
    };
  } catch (e) {
    console.error("Difficulty assessment error:", e);
    return { difficulty: "medium", reasoning: "Could not assess difficulty", categoryMismatch: false, categoryNote: "" };
  }
}

/**
 * Generate AI league name suggestions
 */
export async function suggestLeagueNames(): Promise<string[]> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return [
      "Trivia Titans",
      "Quiz Champions",
      "Brain Trust",
      "The Think Tank",
      "Knowledge Knights",
    ];
  }

  try {
    const anthropic = getClient();
    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 200,
      messages: [
        {
          role: "user",
          content:
            'Generate 5 creative, fun league names for a competitive trivia game called "Bhutto Wisdom". Mix sports and knowledge themes. Return as JSON array of strings only.',
        },
      ],
    });

    const text =
      response.content[0].type === "text" ? response.content[0].text : "[]";
    return JSON.parse(text);
  } catch {
    return [
      "Trivia Titans",
      "Quiz Champions",
      "Brain Trust",
      "The Think Tank",
      "Knowledge Knights",
    ];
  }
}

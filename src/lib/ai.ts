import Anthropic from "@anthropic-ai/sdk";

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
      model: "claude-sonnet-4-20250514",
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
  answerFormat: "multiple_choice" | "free_text" | "price_is_right";
  optionA?: string;
  optionB?: string;
  optionC?: string;
  optionD?: string;
  correctOption?: string;
  correctAnswer?: string;
  acceptableAnswers?: string[];
  difficulty: "easy" | "medium" | "hard";
  hook: string;
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
- "free_text": correctAnswer string + acceptableAnswers array of alternate phrasings
- "price_is_right": numeric correctAnswer (as string), no acceptableAnswers needed

Categories: Geography, Sports, Politics, Science, History, Entertainment, Arts & Literature, Food & Drink, Technology, General Knowledge

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
      "category": "Science",
      "questionText": "...",
      "answerFormat": "free_text",
      "correctAnswer": "...",
      "acceptableAnswers": ["alt1", "alt2"],
      "difficulty": "hard",
      "hook": "Test your knowledge of..."
    },
    {
      "category": "Geography",
      "questionText": "...",
      "answerFormat": "price_is_right",
      "correctAnswer": "42",
      "difficulty": "easy",
      "hook": "How well do you know..."
    }
  ]
}

Rules:
- "hook" is a short 5-8 word teaser for each card
- Mix up the answer formats across the 3 variations
- Each variation should feel genuinely different, not a rewrite
- Return ONLY valid JSON, no markdown fences, no extra text
- If the user is having a conversation (not asking for a question), return: {"type": "conversation", "text": "your response here"}`;

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
      model: "claude-sonnet-4-20250514",
      max_tokens: 1500,
      system: WORKSHOP_SYSTEM_PROMPT,
      messages: [{ role: "user", content: prompt }],
    });

    const text = response.content[0].type === "text" ? response.content[0].text : "";
    return parseWorkshopResponse(text);
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
      model: "claude-sonnet-4-20250514",
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
    return parseWorkshopResponse(text);
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
      model: "claude-sonnet-4-20250514",
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
      model: "claude-sonnet-4-20250514",
      max_tokens: 600,
      messages: [
        {
          role: "user",
          content: `Parse this text into a structured trivia question and provide BOTH multiple choice and free text formats.

Categories: Geography, Sports, Politics, Science, History, Entertainment, Arts & Literature, Food & Drink, Technology, General Knowledge

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
      model: "claude-sonnet-4-20250514",
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
      model: "claude-sonnet-4-20250514",
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
  }
): Promise<{ difficulty: "easy" | "medium" | "hard"; reasoning: string }> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return { difficulty: "medium", reasoning: "AI not configured" };
  }

  try {
    const anthropic = getClient();
    const categoryRate = leagueStats.categoryCorrectRates[leagueStats.category];
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 300,
      messages: [
        {
          role: "user",
          content: `You are assessing the difficulty of a trivia question for a competitive trivia game.

Question: ${question}
Category: ${leagueStats.category}

League stats:
- Overall correct answer rate: ${Math.round(leagueStats.overallCorrectRate * 100)}%
${categoryRate !== undefined ? `- Correct rate for ${leagueStats.category}: ${Math.round(categoryRate * 100)}%` : "- No history for this category yet"}

Assess whether this question is easy, medium, or hard relative to typical trivia questions. Consider:
- How obscure or specialized the knowledge is
- Whether there are common misconceptions that might trip people up
- The league's historical performance in this category

Respond with JSON only:
{"difficulty": "easy"|"medium"|"hard", "reasoning": "1-2 sentence explanation"}`,
        },
      ],
    });

    const text =
      response.content[0].type === "text" ? response.content[0].text : "";
    const parsed = JSON.parse(text);
    return {
      difficulty: parsed.difficulty,
      reasoning: parsed.reasoning,
    };
  } catch {
    return { difficulty: "medium", reasoning: "Could not assess difficulty" };
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
      model: "claude-sonnet-4-20250514",
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

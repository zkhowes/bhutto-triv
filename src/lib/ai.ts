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
 * AI-assisted question workshop
 */
export async function workshopQuestion(
  messages: { role: "user" | "assistant"; content: string }[]
): Promise<string> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return "AI assistance is not available. Please configure your ANTHROPIC_API_KEY to use the question workshop.";
  }

  try {
    const anthropic = getClient();
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1000,
      system: `You are a trivia question workshop assistant for "Bhutto Wisdom", a competitive trivia game. Help players create engaging, clear, and fair trivia questions.

Your role:
- Help brainstorm question ideas
- Suggest whether a question works better as multiple choice or free text
- Generate multiple choice options when requested
- Validate question difficulty and clarity
- Ensure questions have clear, unambiguous correct answers

Categories: Geography, Sports, Politics, Science, History, Entertainment, Arts & Literature, Food & Drink, Technology, General Knowledge

Be concise, helpful, and enthusiastic about trivia. When suggesting questions, format them clearly.`,
      messages: messages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
    });

    return response.content[0].type === "text"
      ? response.content[0].text
      : "I couldn't generate a response. Please try again.";
  } catch {
    return "AI workshop is temporarily unavailable. Please try again later.";
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
 * Parse AI workshop text into structured question fields
 */
export async function parseQuestionFromText(text: string): Promise<{
  category: string;
  questionText: string;
  answerFormat: string;
  optionA?: string;
  optionB?: string;
  optionC?: string;
  optionD?: string;
  correctOption?: string;
  correctAnswer?: string;
} | null> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return null;
  }

  try {
    const anthropic = getClient();
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 500,
      messages: [
        {
          role: "user",
          content: `Parse this text into a structured trivia question. Extract the category, question, answer format, and answer details.

Categories: Geography, Sports, Politics, Science, History, Entertainment, Arts & Literature, Food & Drink, Technology, General Knowledge

Text to parse:
${text}

Respond with JSON only:
{
  "category": "one of the categories above",
  "questionText": "the question",
  "answerFormat": "multiple_choice" or "free_text",
  "optionA": "option A (if multiple choice)",
  "optionB": "option B (if multiple choice)",
  "optionC": "option C (if multiple choice)",
  "optionD": "option D (if multiple choice)",
  "correctOption": "A", "B", "C", or "D" (if multiple choice),
  "correctAnswer": "the correct answer text (if free text)"
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

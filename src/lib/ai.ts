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

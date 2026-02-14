import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { submitQuestion, placeBet, submitAnswer, closeRound, revealCategory } from "@/lib/game-engine";
import { CATEGORIES, ROUND_STATUS } from "@/lib/constants";

const TEST_QUESTIONS = [
  { q: "What is the capital of France?", a: "Paris", options: ["Paris", "London", "Berlin", "Madrid"], correct: "A" },
  { q: "Which planet is known as the Red Planet?", a: "Mars", options: ["Venus", "Mars", "Jupiter", "Saturn"], correct: "B" },
  { q: "What year did World War II end?", a: "1945", options: ["1943", "1944", "1945", "1946"], correct: "C" },
  { q: "Who wrote Romeo and Juliet?", a: "Shakespeare", options: ["Dickens", "Austen", "Hemingway", "Shakespeare"], correct: "D" },
  { q: "What is the largest ocean?", a: "Pacific", options: ["Pacific", "Atlantic", "Indian", "Arctic"], correct: "A" },
  { q: "Which element has the symbol 'O'?", a: "Oxygen", options: ["Gold", "Oxygen", "Osmium", "Oganesson"], correct: "B" },
  { q: "What sport uses a shuttlecock?", a: "Badminton", options: ["Tennis", "Cricket", "Badminton", "Squash"], correct: "C" },
  { q: "Which country has the most people?", a: "India", options: ["USA", "China", "Brazil", "India"], correct: "D" },
  { q: "What is 12 x 12?", a: "144", options: ["144", "132", "156", "128"], correct: "A" },
  { q: "Who painted the Mona Lisa?", a: "Da Vinci", options: ["Picasso", "Da Vinci", "Van Gogh", "Monet"], correct: "B" },
];

interface RoundInfo {
  id: string;
  number: number;
  status: string;
  atBatPlayerId: string | null;
}

interface PlayerInfo {
  id: string;
  userId: string;
  fakeNickname: string | null;
  user: { nickname: string | null };
}

interface PlayerStateInfo {
  leaguePlayerId: string;
  points: number;
  isEliminated: boolean;
}

// Advance a single round by one stage. Returns the new status.
async function advanceSingleStage(
  round: RoundInfo,
  players: PlayerInfo[],
  playerStates: PlayerStateInfo[],
): Promise<{ from: string; to: string; message: string }> {
  const atBatPlayer = players.find((p) => p.id === round.atBatPlayerId);
  const otherPlayers = players.filter((p) => p.id !== round.atBatPlayerId);
  const testQ = TEST_QUESTIONS[round.number % TEST_QUESTIONS.length];
  const category = CATEGORIES[round.number % CATEGORIES.length];

  switch (round.status) {
    case ROUND_STATUS.AWAITING_QUESTION: {
      if (!atBatPlayer) throw new Error("No at-bat player found");
      await submitQuestion(round.id, {
        category,
        questionText: testQ.q,
        answerFormat: "multiple_choice",
        optionA: testQ.options[0],
        optionB: testQ.options[1],
        optionC: testQ.options[2],
        optionD: testQ.options[3],
        correctOption: testQ.correct,
        correctAnswer: testQ.a,
        leaguePlayerId: atBatPlayer.id,
        creatorUserId: atBatPlayer.userId,
      });
      return {
        from: "awaiting_question",
        to: "question_submitted",
        message: `Question submitted by ${atBatPlayer.fakeNickname || atBatPlayer.user.nickname || "player"}`,
      };
    }

    case ROUND_STATUS.QUESTION_SUBMITTED: {
      await revealCategory(round.id);
      return {
        from: "question_submitted",
        to: "category_revealed",
        message: `Category "${category}" revealed`,
      };
    }

    case ROUND_STATUS.CATEGORY_REVEALED: {
      let betCount = 0;
      let answerCount = 0;
      for (const player of otherPlayers) {
        const playerState = playerStates.find((ps) => ps.leaguePlayerId === player.id);
        if (!playerState || playerState.isEliminated) continue;

        const betAmount = Math.max(1, Math.floor(Math.random() * playerState.points) + 1);
        try {
          await placeBet(round.id, player.id, player.userId, Math.min(betAmount, playerState.points));
          betCount++;
        } catch {
          continue;
        }

        const isCorrectAnswer = Math.random() < 0.6;
        const options = ["A", "B", "C", "D"];
        const selectedOption = isCorrectAnswer
          ? testQ.correct
          : options.filter((o) => o !== testQ.correct)[Math.floor(Math.random() * 3)];
        try {
          await submitAnswer(round.id, player.id, { selectedOption });
          answerCount++;
        } catch {
          // Already answered
        }
      }

      // submitAnswer auto-sets status to "closed" when all players have answered.
      // If not all answered (some eliminated), manually set to closed.
      const currentRound = await prisma.round.findUnique({ where: { id: round.id } });
      if (currentRound && currentRound.status !== ROUND_STATUS.CLOSED) {
        await prisma.round.update({
          where: { id: round.id },
          data: { status: ROUND_STATUS.CLOSED },
        });
      }

      return {
        from: "category_revealed",
        to: "closed",
        message: `${betCount} bets, ${answerCount} answers, awaiting grading review`,
      };
    }

    case ROUND_STATUS.CLOSED: {
      // Auto-confirm all grades and close the round
      await closeRound(round.id);
      return {
        from: "closed",
        to: "graded",
        message: "Grades confirmed, round graded",
      };
    }

    default:
      throw new Error(`Cannot advance from status: ${round.status}`);
  }
}

// Complete an entire round from its current status to graded
async function completeRound(
  round: RoundInfo,
  players: PlayerInfo[],
  playerStates: PlayerStateInfo[],
): Promise<string[]> {
  const messages: string[] = [];
  const stageOrder: string[] = [ROUND_STATUS.AWAITING_QUESTION, ROUND_STATUS.QUESTION_SUBMITTED, ROUND_STATUS.CATEGORY_REVEALED, ROUND_STATUS.CLOSED];
  let currentStatus: string = round.status;

  for (const stage of stageOrder) {
    if (currentStatus === ROUND_STATUS.GRADED) break;
    if (stageOrder.indexOf(currentStatus) > stageOrder.indexOf(stage)) continue;
    if (currentStatus !== stage) continue;

    // Refresh player states between stages (points may have changed)
    const result = await advanceSingleStage(
      { ...round, status: currentStatus },
      players,
      playerStates,
    );
    messages.push(result.message);
    currentStatus = result.to;
  }

  return messages;
}

// POST - Advance the current round to the next stage, auto-generating test data
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json({ error: "Test mode only available in development" }, { status: 400 });
  }

  let body: { action?: string } = {};
  try {
    body = await req.json();
  } catch {
    // No body = default advance
  }
  const action = body.action || "advance";

  const leagueId = params.id;
  const league = await prisma.league.findUnique({
    where: { id: leagueId },
    include: {
      players: { where: { isActive: true }, include: { user: true } },
      seasons: {
        where: { status: "active" },
        include: {
          games: {
            where: { status: "active" },
            include: {
              rounds: { orderBy: { number: "asc" } },
              playerStates: true,
              battingOrder: { orderBy: { position: "asc" } },
            },
          },
        },
      },
    },
  });

  if (!league || league.type !== "test") {
    return NextResponse.json({ error: "Test mode not enabled" }, { status: 400 });
  }

  const season = league.seasons[0];
  const game = season?.games[0];
  if (!game) {
    return NextResponse.json({ error: "No active game found" }, { status: 400 });
  }

  const players = league.players.map((p) => ({
    id: p.id,
    userId: p.userId,
    fakeNickname: p.fakeNickname,
    user: { nickname: p.user.nickname },
  }));

  try {
    if (action === "advance") {
      // Single step advance
      const currentRound = game.rounds.find((r) => r.status !== "graded");
      if (!currentRound) {
        return NextResponse.json({ error: "All rounds are graded. Start next game." }, { status: 400 });
      }

      const result = await advanceSingleStage(
        currentRound,
        players,
        game.playerStates,
      );
      return NextResponse.json({ advanced: true, ...result });
    }

    if (action === "complete_round") {
      const currentRound = game.rounds.find((r) => r.status !== "graded");
      if (!currentRound) {
        return NextResponse.json({ error: "All rounds are graded." }, { status: 400 });
      }

      const messages = await completeRound(currentRound, players, game.playerStates);
      return NextResponse.json({
        advanced: true,
        message: `Round ${currentRound.number} completed: ${messages.join(" → ")}`,
      });
    }

    if (action === "complete_game") {
      const allMessages: string[] = [];
      const pendingRounds = game.rounds.filter((r) => r.status !== "graded");

      if (pendingRounds.length === 0) {
        return NextResponse.json({ error: "All rounds are already graded." }, { status: 400 });
      }

      for (const round of pendingRounds) {
        // Re-fetch player states for each round since points change
        const freshGame = await prisma.game.findUnique({
          where: { id: game.id },
          include: { playerStates: true },
        });
        if (!freshGame) break;

        // Re-fetch round status since it may have changed
        const freshRound = await prisma.round.findUnique({ where: { id: round.id } });
        if (!freshRound || freshRound.status === "graded") continue;

        const messages = await completeRound(
          { id: freshRound.id, number: freshRound.number, status: freshRound.status, atBatPlayerId: freshRound.atBatPlayerId },
          players,
          freshGame.playerStates,
        );
        allMessages.push(`Round ${round.number}: ${messages.join(" → ")}`);
      }

      return NextResponse.json({
        advanced: true,
        message: `Game completed!\n${allMessages.join("\n")}`,
      });
    }

    return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: `Advance failed: ${message}` }, { status: 500 });
  }
}

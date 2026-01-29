import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { submitQuestion } from "@/lib/game-engine";

// POST - Submit a question for a round
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const {
    roundId,
    leaguePlayerId,
    category,
    questionText,
    answerFormat,
    optionA,
    optionB,
    optionC,
    optionD,
    correctOption,
    correctAnswer,
    acceptableAnswers,
  } = body;

  if (!roundId || !leaguePlayerId || !category || !questionText || !answerFormat) {
    return NextResponse.json(
      { error: "Missing required fields" },
      { status: 400 }
    );
  }

  // Verify player belongs to user
  const player = await prisma.leaguePlayer.findFirst({
    where: {
      id: leaguePlayerId,
      userId: session.user.id,
    },
  });

  if (!player) {
    return NextResponse.json(
      { error: "Player not found" },
      { status: 404 }
    );
  }

  // Verify player is at bat for this round
  const round = await prisma.round.findUnique({
    where: { id: roundId },
  });

  if (!round) {
    return NextResponse.json(
      { error: "Round not found" },
      { status: 404 }
    );
  }

  if (round.atBatPlayerId !== leaguePlayerId) {
    return NextResponse.json(
      { error: "It's not your turn at bat" },
      { status: 400 }
    );
  }

  try {
    const questionId = await submitQuestion(roundId, {
      category,
      questionText,
      answerFormat,
      optionA,
      optionB,
      optionC,
      optionD,
      correctOption,
      correctAnswer,
      acceptableAnswers,
      leaguePlayerId,
      creatorUserId: session.user.id,
    });
    return NextResponse.json({ questionId }, { status: 201 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to submit question";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

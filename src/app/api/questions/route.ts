import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { submitQuestion } from "@/lib/game-engine";
import { resolveTestPlayer } from "@/lib/test-mode";

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
    imageUrl,
    imageSource,
    imageAttribution,
    orderingItems,
    orderingCorrectOrder,
    orderingDirection,
    orderingItemValues,
    originalQuestionId,
  } = body;

  if (!roundId || !leaguePlayerId || !category || !questionText || !answerFormat) {
    return NextResponse.json(
      { error: "Missing required fields" },
      { status: 400 }
    );
  }

  // Verify player belongs to user (or commissioner acting as test player)
  let player = await prisma.leaguePlayer.findFirst({
    where: {
      id: leaguePlayerId,
      userId: session.user.id,
    },
  });

  let actingUserId = session.user.id;

  if (!player) {
    const testPlayer = await resolveTestPlayer(leaguePlayerId, session.user.id, session.user.isSuperAdmin);
    if (!testPlayer) {
      return NextResponse.json(
        { error: "Player not found" },
        { status: 404 }
      );
    }
    player = { ...testPlayer } as unknown as typeof player;
    actingUserId = testPlayer.userId;
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
      imageUrl,
      imageSource,
      imageAttribution,
      orderingItems,
      orderingCorrectOrder,
      orderingDirection,
      orderingItemValues,
      leaguePlayerId,
      creatorUserId: actingUserId,
      originalQuestionId,
    });
    return NextResponse.json({ questionId }, { status: 201 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to submit question";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

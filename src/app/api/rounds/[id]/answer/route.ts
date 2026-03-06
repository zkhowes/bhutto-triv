import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { submitAnswer } from "@/lib/game-engine";
import { resolveTestPlayer } from "@/lib/test-mode";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { leaguePlayerId, selectedOption, freeTextAnswer, cheatSeekerData, questionRating } = await req.json();

  // Validate questionRating if provided
  if (questionRating !== undefined && questionRating !== null) {
    if (typeof questionRating !== "number" || questionRating < 1 || questionRating > 5 || !Number.isInteger(questionRating)) {
      return NextResponse.json({ error: "Rating must be integer 1-5" }, { status: 400 });
    }
  }
  const roundId = params.id;

  // Verify player belongs to user (or commissioner acting as test player)
  let player = await prisma.leaguePlayer.findFirst({
    where: {
      id: leaguePlayerId,
      userId: session.user.id,
    },
  });

  if (!player) {
    const testPlayer = await resolveTestPlayer(leaguePlayerId, session.user.id, session.user.isSuperAdmin);
    if (!testPlayer) {
      return NextResponse.json({ error: "Player not found" }, { status: 404 });
    }
    player = { ...testPlayer } as unknown as typeof player;
  }

  try {
    const result = await submitAnswer(roundId, leaguePlayerId, {
      selectedOption,
      freeTextAnswer,
      cheatSeekerData: cheatSeekerData ? JSON.stringify(cheatSeekerData) : undefined,
      questionRating: questionRating || undefined,
    });
    return NextResponse.json(result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to submit answer";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

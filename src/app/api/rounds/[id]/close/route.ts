import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { closeRound } from "@/lib/game-engine";

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const roundId = params.id;

  // Verify user is commissioner or at-bat player (question creator) of the league
  const round = await prisma.round.findUnique({
    where: { id: roundId },
    include: {
      question: true,
      game: {
        include: {
          season: {
            include: {
              league: {
                include: {
                  players: {
                    where: {
                      userId: session.user.id,
                      isActive: true,
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  });

  if (!round) {
    return NextResponse.json({ error: "Round not found" }, { status: 404 });
  }

  const myPlayer = round.game.season.league.players[0];
  const isCommissioner = myPlayer?.role === "commissioner";
  const isCreator = round.question?.creatorUserId === session.user.id;
  const isTestMode = round.game.season.league.type === "test";

  if (!isCommissioner && !isCreator && !isTestMode) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  // Allow closing from "closed" (awaiting review) or "graded" (re-grading) status
  // Re-grading is only allowed for commissioners
  if (round.status === "graded" && !isCommissioner) {
    return NextResponse.json({ error: "Only commissioners can re-grade completed rounds" }, { status: 403 });
  }

  if (round.status !== "closed" && round.status !== "graded") {
    return NextResponse.json({ error: "Round is not in a gradable state" }, { status: 400 });
  }

  try {
    await closeRound(roundId);
    return NextResponse.json({ success: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to close round";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

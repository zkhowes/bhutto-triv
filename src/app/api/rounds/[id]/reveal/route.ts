import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { revealCategory } from "@/lib/game-engine";

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const roundId = params.id;

  const round = await prisma.round.findUnique({
    where: { id: roundId },
    include: {
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

  const isInLeague = round.game.season.league.players.length > 0;
  if (!isInLeague) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  if (round.status !== "question_submitted") {
    return NextResponse.json(
      { error: "Question must be submitted before revealing category" },
      { status: 400 }
    );
  }

  try {
    await revealCategory(roundId);
    return NextResponse.json({ success: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to reveal category";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

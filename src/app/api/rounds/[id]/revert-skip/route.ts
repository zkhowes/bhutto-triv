import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { revertSkip } from "@/lib/game-engine";

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
                      role: "commissioner",
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

  if (round.game.season.league.players.length === 0) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  if (!round.skippedPlayerId) {
    return NextResponse.json(
      { error: "No skip to revert on this round" },
      { status: 400 }
    );
  }

  try {
    await revertSkip(roundId);
    return NextResponse.json({ success: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to revert skip";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

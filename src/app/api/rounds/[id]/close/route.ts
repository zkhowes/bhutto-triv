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

  // Verify user is commissioner of the league
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

  const isCommissioner =
    round.game.season.league.players.length > 0;

  // In test mode or commissioner can close rounds
  const isTestMode = round.game.season.league.type === "test";
  if (!isCommissioner && !isTestMode) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
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

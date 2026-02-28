import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { closeRound } from "@/lib/game-engine";
import { notifyRoundClosedByCommissioner } from "@/lib/notifications";

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
      answers: {
        include: {
          leaguePlayer: {
            include: { user: { select: { nickname: true } } },
          },
        },
      },
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

  if (round.status !== "category_revealed") {
    return NextResponse.json(
      { error: "Round must be in category_revealed status to force close" },
      { status: 400 }
    );
  }

  try {
    // Identify players who haven't answered (will be marked absent by closeRound)
    const absentAnswers = round.answers.filter(
      (a) =>
        a.leaguePlayerId !== round.atBatPlayerId &&
        !a.answeredAt &&
        !a.isAbsent
    );
    const absentPlayerNames = absentAnswers.map(
      (a) => a.leaguePlayer.user.nickname ?? "Unknown"
    );

    await closeRound(roundId);
    await notifyRoundClosedByCommissioner(roundId, absentPlayerNames);

    return NextResponse.json({
      success: true,
      absentPlayers: absentPlayerNames,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to force close round";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

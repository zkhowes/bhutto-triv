import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ROUND_STATUS } from "@/lib/constants";
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
      question: true,
      answers: {
        include: {
          leaguePlayer: {
            include: { user: { select: { nickname: true } } },
          },
        },
      },
      game: {
        include: {
          playerStates: true,
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

  const forceCloseable = ["question_submitted", "category_revealed"];
  if (!forceCloseable.includes(round.status)) {
    return NextResponse.json(
      { error: "Round must be in question_submitted or category_revealed status to force close" },
      { status: 400 }
    );
  }

  try {
    // Identify players who haven't answered and mark them absent
    const allPlayerIds = round.game.playerStates.map((ps) => ps.leaguePlayerId);
    const answeredPlayerIds = round.answers.map((a) => a.leaguePlayerId);
    const absentPlayerIds = allPlayerIds.filter(
      (id) => !answeredPlayerIds.includes(id) && id !== round.atBatPlayerId
    );

    const absentPlayerNames: string[] = [];
    for (const playerId of absentPlayerIds) {
      const lp = await prisma.leaguePlayer.findUnique({
        where: { id: playerId },
        include: { user: { select: { id: true, nickname: true } } },
      });
      if (!lp) continue;
      absentPlayerNames.push(lp.user.nickname ?? "Unknown");

      await prisma.roundAnswer.upsert({
        where: {
          roundId_leaguePlayerId: { roundId, leaguePlayerId: playerId },
        },
        update: { isAbsent: true },
        create: {
          roundId,
          questionId: round.question?.id || "",
          leaguePlayerId: playerId,
          userId: lp.user.id,
          isAbsent: true,
        },
      });
    }

    // Stop at "closed" — commissioner will see grading interface on the round page
    await prisma.round.update({
      where: { id: roundId },
      data: { status: ROUND_STATUS.CLOSED },
    });

    await notifyRoundClosedByCommissioner(roundId, absentPlayerNames);

    return NextResponse.json({
      success: true,
      roundId,
      absentPlayers: absentPlayerNames,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to force close round";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

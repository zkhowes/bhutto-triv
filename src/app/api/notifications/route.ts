import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET - List notifications and pending actions
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Get all league players for this user
  const leaguePlayers = await prisma.leaguePlayer.findMany({
    where: {
      userId: session.user.id,
      isActive: true,
      isFake: false,
    },
    select: { id: true, leagueId: true },
  });

  const playerIds = leaguePlayers.map((lp) => lp.id);

  if (playerIds.length === 0) {
    return NextResponse.json({ notifications: [], unreadCount: 0 });
  }

  let pendingCount = 0;

  // Check for active rounds where player has pending actions
  const activeRounds = await prisma.round.findMany({
    where: {
      status: { in: ["awaiting_question", "question_submitted", "category_revealed"] },
      game: {
        status: "in_progress",
        playerStates: {
          some: {
            leaguePlayerId: { in: playerIds },
          },
        },
      },
    },
    include: {
      answers: {
        where: { leaguePlayerId: { in: playerIds } },
      },
      game: {
        include: {
          playerStates: {
            where: { leaguePlayerId: { in: playerIds } },
          },
        },
      },
    },
  });

  for (const round of activeRounds) {
    const myAnswer = round.answers[0];
    const myPlayerState = round.game.playerStates[0];

    // At bat and needs to submit question
    if (round.status === "awaiting_question" && playerIds.includes(round.atBatPlayerId || "")) {
      pendingCount++;
      continue;
    }

    // Not at bat and not eliminated
    if (round.atBatPlayerId && !playerIds.includes(round.atBatPlayerId) && myPlayerState && !myPlayerState.isEliminated) {
      // Question submitted, need to place bet
      if ((round.status === "question_submitted" || round.status === "category_revealed") && (!myAnswer || !myAnswer.betPlacedAt)) {
        pendingCount++;
        continue;
      }

      // Category revealed, bet placed, need to answer
      if (round.status === "category_revealed" && myAnswer?.betPlacedAt && !myAnswer.answeredAt) {
        pendingCount++;
        continue;
      }
    }
  }

  // Check for recently completed rounds (within last 24 hours) that haven't been viewed
  const recentlyGradedRounds = await prisma.round.findMany({
    where: {
      status: "graded",
      updatedAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      answers: {
        some: {
          leaguePlayerId: { in: playerIds },
        },
      },
    },
    select: { id: true },
  });

  pendingCount += recentlyGradedRounds.length;

  return NextResponse.json({ notifications: [], unreadCount: pendingCount });
}

// PUT - Mark notifications as read
export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { ids } = await req.json();

  if (ids && Array.isArray(ids)) {
    await prisma.notification.updateMany({
      where: {
        id: { in: ids },
        userId: session.user.id,
      },
      data: { isRead: true },
    });
  } else {
    // Mark all as read
    await prisma.notification.updateMany({
      where: { userId: session.user.id },
      data: { isRead: true },
    });
  }

  return NextResponse.json({ success: true });
}

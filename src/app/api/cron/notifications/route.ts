import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { notifyAboutToBeSkipped } from "@/lib/notifications";

/**
 * Vercel Cron Job — runs every 15 minutes
 * Fires "You're about to be skipped" notification to the last player
 * without a bet+answer when a round's deadline is within 30–90 minutes.
 */
export async function GET(request: NextRequest) {
  // Authenticate cron requests — always require secret
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json({ error: "Cron secret not configured" }, { status: 500 });
  }
  const secret = request.headers.get("x-cron-secret") ?? request.nextUrl.searchParams.get("secret");
  if (secret !== cronSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const windowStart = new Date(now.getTime() + 30 * 60 * 1000);  // 30 min from now
  const windowEnd = new Date(now.getTime() + 90 * 60 * 1000);    // 90 min from now

  // Find active rounds in the category_revealed state approaching deadline
  const approachingRounds = await prisma.round.findMany({
    where: {
      status: "category_revealed",
      deadlineAt: {
        gte: windowStart,
        lte: windowEnd,
      },
    },
    include: {
      answers: {
        select: { leaguePlayerId: true, betPlacedAt: true, answeredAt: true },
      },
      game: {
        include: {
          playerStates: {
            where: { isEliminated: false },
            select: { leaguePlayerId: true },
          },
        },
      },
    },
  });

  let notificationsSent = 0;

  for (const round of approachingRounds) {
    // Find players who haven't completed both bet+answer
    const incompletePlayerIds = round.game.playerStates
      .filter((ps) => {
        // Skip at-bat player (they don't bet/answer their own question)
        if (ps.leaguePlayerId === round.atBatPlayerId) return false;

        const answer = round.answers.find((a) => a.leaguePlayerId === ps.leaguePlayerId);
        // Incomplete if: no answer record, or no bet, or no answer submitted
        return !answer || !answer.betPlacedAt || !answer.answeredAt;
      })
      .map((ps) => ps.leaguePlayerId);

    if (incompletePlayerIds.length === 0) continue;

    // Only notify the single last holdout (as per requirements)
    // If multiple players are incomplete, notify only the one who hasn't even bet
    // (the "furthest behind" player)
    const noBetIds = incompletePlayerIds.filter((id) => {
      const answer = round.answers.find((a) => a.leaguePlayerId === id);
      return !answer || !answer.betPlacedAt;
    });

    const targetId = noBetIds.length > 0 ? noBetIds[0] : incompletePlayerIds[0];

    await notifyAboutToBeSkipped(round.id, targetId);
    notificationsSent++;
  }

  return NextResponse.json({
    success: true,
    roundsChecked: approachingRounds.length,
    notificationsSent,
    timestamp: now.toISOString(),
  });
}

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { notifyAboutToBeSkipped, notifyActionReminder, notifyAutoSkipWarning, notifyAutoSkipped, notifyAutoCloseWarning, notifyAutoClosedRound } from "@/lib/notifications";
import { skipPlayerTurn, closeRound } from "@/lib/game-engine";

/**
 * Vercel Cron Job — runs every 15 minutes
 *
 * 1. "About to be skipped" — last player without bet+answer, deadline 30–90 min away
 * 2. "Action reminder" — round stale 24+ hours, reminds whoever is blocking progress
 * 3. "Auto-skip" — for leagues with autoSkipEnabled: warn at 24h, skip at 27h
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
  let notificationsSent = 0;

  // ─── 1. About to be skipped (existing) ──────────────────────────────────────

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

  // ─── 2. 24-hour action reminders ────────────────────────────────────────────

  const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  // 2a. Awaiting question — at-bat player hasn't submitted after 24h
  const staleAwaitingQuestion = await prisma.round.findMany({
    where: {
      status: "awaiting_question",
      updatedAt: { lte: twentyFourHoursAgo },
      game: { status: "active" },
    },
    select: { id: true, atBatPlayerId: true },
    take: 50,
  });

  for (const round of staleAwaitingQuestion) {
    if (!round.atBatPlayerId) continue;
    await notifyActionReminder(round.id, round.atBatPlayerId, "question");
    notificationsSent++;
  }

  // 2b. Question submitted / category revealed — players haven't answered after 24h
  const staleAwaitingAnswers = await prisma.round.findMany({
    where: {
      status: { in: ["question_submitted", "category_revealed"] },
      updatedAt: { lte: twentyFourHoursAgo },
      game: { status: "active" },
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
    take: 50,
  });

  for (const round of staleAwaitingAnswers) {
    const incompletePlayerIds = round.game.playerStates
      .filter((ps) => {
        if (ps.leaguePlayerId === round.atBatPlayerId) return false;
        const answer = round.answers.find((a) => a.leaguePlayerId === ps.leaguePlayerId);
        return !answer || !answer.betPlacedAt || !answer.answeredAt;
      })
      .map((ps) => ps.leaguePlayerId);

    for (const playerId of incompletePlayerIds) {
      await notifyActionReminder(round.id, playerId, "answer");
      notificationsSent++;
    }
  }

  // ─── 3. Auto-skip (leagues with autoSkipEnabled) ─────────────────────────────
  // Warn at-bat players at 24h, auto-skip at 27h (when warning was sent 3h+ ago)

  let autoSkipsPerformed = 0;

  const autoSkipStaleRounds = await prisma.round.findMany({
    where: {
      status: "awaiting_question",
      updatedAt: { lte: twentyFourHoursAgo },
      game: {
        status: "active",
        season: { league: { autoSkipEnabled: true } },
      },
    },
    select: {
      id: true,
      atBatPlayerId: true,
      game: {
        select: {
          season: { select: { league: { select: { id: true } } } },
        },
      },
    },
    take: 50,
  });

  const threeHoursAgo = new Date(now.getTime() - 3 * 60 * 60 * 1000);

  for (const round of autoSkipStaleRounds) {
    if (!round.atBatPlayerId) continue;

    // Look up the user ID for the at-bat player
    const atBatPlayer = await prisma.leaguePlayer.findUnique({
      where: { id: round.atBatPlayerId },
      select: { userId: true, isFake: true },
    });
    if (!atBatPlayer || atBatPlayer.isFake) continue;

    // Check if warning already sent
    const existingWarning = await prisma.notification.findFirst({
      where: {
        roundId: round.id,
        userId: atBatPlayer.userId,
        type: "auto_skip_warning",
      },
      select: { createdAt: true },
    });

    if (!existingWarning) {
      // Send 3-hour warning
      await notifyAutoSkipWarning(round.id, round.atBatPlayerId);
      notificationsSent++;
    } else if (existingWarning.createdAt <= threeHoursAgo) {
      // Warning was sent 3+ hours ago — auto-skip
      try {
        await skipPlayerTurn(round.id, round.atBatPlayerId);
        await notifyAutoSkipped(round.id, round.atBatPlayerId);
        autoSkipsPerformed++;
        notificationsSent++;
      } catch (err) {
        console.error("[AutoSkip] Failed to skip player:", err);
      }
    }
  }

  // ─── 3b. Auto-close stale answering rounds (leagues with autoSkipEnabled) ───
  // Warn answering players at 24h, auto-close round at 27h

  let autoClosesPerformed = 0;

  const autoCloseStaleRounds = await prisma.round.findMany({
    where: {
      status: { in: ["question_submitted", "category_revealed"] },
      updatedAt: { lte: twentyFourHoursAgo },
      game: {
        status: "active",
        season: { league: { autoSkipEnabled: true } },
      },
    },
    include: {
      question: { select: { id: true } },
      answers: {
        select: { leaguePlayerId: true, betPlacedAt: true, answeredAt: true },
      },
      game: {
        include: {
          playerStates: {
            where: { isEliminated: false },
            include: {
              leaguePlayer: { select: { isPaused: true, isFake: true } },
            },
          },
          season: { select: { league: { select: { id: true } } } },
        },
      },
    },
    take: 50,
  });

  for (const round of autoCloseStaleRounds) {
    // Find active, non-paused, non-eliminated, non-fake players who haven't answered
    const incompletePlayerIds = round.game.playerStates
      .filter((ps) => {
        if (ps.leaguePlayerId === round.atBatPlayerId) return false;
        if (ps.leaguePlayer.isPaused || ps.leaguePlayer.isFake) return false;
        const answer = round.answers.find((a) => a.leaguePlayerId === ps.leaguePlayerId);
        return !answer || !answer.betPlacedAt || !answer.answeredAt;
      })
      .map((ps) => ps.leaguePlayerId);

    if (incompletePlayerIds.length === 0) continue;

    // Check if warning already sent for this round (use first incomplete player as proxy)
    const existingWarning = await prisma.notification.findFirst({
      where: {
        roundId: round.id,
        type: "auto_close_warning",
      },
      select: { createdAt: true },
    });

    if (!existingWarning) {
      // Send 3-hour warning to each incomplete player
      for (const playerId of incompletePlayerIds) {
        await notifyAutoCloseWarning(round.id, playerId);
        notificationsSent++;
      }
    } else if (existingWarning.createdAt <= threeHoursAgo) {
      // Warning was sent 3+ hours ago — auto-close the round.
      // closeRound creates absent RoundAnswers with the correct penalty; don't
      // pre-create them here or the penalty branch will skip these players.
      try {
        await closeRound(round.id);
        await notifyAutoClosedRound(round.id);
        autoClosesPerformed++;
        notificationsSent++;
      } catch (err) {
        console.error("[AutoClose] Failed to auto-close round:", err);
      }
    }
  }

  return NextResponse.json({
    success: true,
    approachingRoundsChecked: approachingRounds.length,
    staleRoundsChecked:
      staleAwaitingQuestion.length + staleAwaitingAnswers.length,
    autoSkipRoundsChecked: autoSkipStaleRounds.length,
    autoSkipsPerformed,
    autoCloseRoundsChecked: autoCloseStaleRounds.length,
    autoClosesPerformed,
    notificationsSent,
    timestamp: now.toISOString(),
  });
}

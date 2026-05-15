import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { notifyAboutToBeSkipped, notifyActionReminder, notifyAutoSkipWarning, notifyAutoSkipped, notifyAutoCloseWarning, notifyAutoClosedRound } from "@/lib/notifications";
import { skipPlayerTurn, closeRound } from "@/lib/game-engine";
import { deferredSkipDeadline, isInQuietHours, type QuietHoursConfig } from "@/lib/quiet-hours";
import { sendSms } from "@/lib/sms";

const DEFAULT_TZ = "America/Los_Angeles";

interface LeagueQuietCtx {
  config: QuietHoursConfig;
  timezone: string;
}

/**
 * Vercel Cron Job — runs every 15 minutes
 *
 * 0. "Flush queued SMS" — sends notifications whose smsScheduledFor has passed
 *    AND whose league is no longer in quiet hours.
 * 1. "About to be skipped" — last player without bet+answer, deadline 30–90 min away
 * 2. "Action reminder" — round stale 24+ hours, reminds whoever is blocking progress
 * 3. "Auto-skip" — for leagues with autoSkipEnabled: skip at-bat players whose
 *    deferredSkipDeadline has passed (24h, deferred past quiet hours if needed)
 * 3b. "Auto-close" — for answering rounds: same logic
 *
 * Paused rounds (round.pausedAt != null) are excluded from sections 3 and 3b.
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
  let queuedFlushed = 0;

  // ─── 0. Flush queued SMS whose scheduledFor has passed ──────────────────────
  // Re-checks current quiet-hours state per league — if the commissioner extended
  // quiet hours after queueing, leave the message queued until the next sweep.
  const queued = await prisma.notification.findMany({
    where: {
      smsStatus: "queued",
      smsScheduledFor: { lte: now },
    },
    select: {
      id: true,
      title: true,
      leagueId: true,
      userId: true,
    },
    take: 100,
  });

  const leagueQuietCache = new Map<string, LeagueQuietCtx | null>();
  async function getLeagueQuietCtx(leagueId: string | null): Promise<LeagueQuietCtx | null> {
    if (!leagueId) return null;
    if (leagueQuietCache.has(leagueId)) return leagueQuietCache.get(leagueId)!;
    const league = await prisma.league.findUnique({
      where: { id: leagueId },
      select: { quietHoursEnabled: true, quietHoursStart: true, quietHoursEnd: true },
    });
    if (!league) {
      leagueQuietCache.set(leagueId, null);
      return null;
    }
    const comm = await prisma.leaguePlayer.findFirst({
      where: { leagueId, role: "commissioner", isActive: true },
      select: { user: { select: { timezone: true } } },
    });
    const ctx: LeagueQuietCtx = {
      config: league,
      timezone: comm?.user?.timezone ?? DEFAULT_TZ,
    };
    leagueQuietCache.set(leagueId, ctx);
    return ctx;
  }

  for (const n of queued) {
    const quietCtx = await getLeagueQuietCtx(n.leagueId);
    if (quietCtx && isInQuietHours(now, quietCtx.config, quietCtx.timezone)) {
      // Still in quiet hours (commissioner extended) — leave queued, next sweep will retry.
      continue;
    }
    const user = await prisma.user.findUnique({
      where: { id: n.userId },
      select: { phoneNumber: true },
    });
    if (!user?.phoneNumber) {
      await prisma.notification.update({
        where: { id: n.id },
        data: { smsStatus: "failed", smsScheduledFor: null },
      });
      continue;
    }
    const appUrl = process.env.NEXTAUTH_URL ?? "";
    const clickUrl = `${appUrl}/api/notifications/click/${n.id}`;
    const smsBody = `${n.title}\n${clickUrl}`;
    const result = await sendSms(user.phoneNumber, smsBody);
    await prisma.notification.update({
      where: { id: n.id },
      data: {
        smsStatus: result.success ? "sent" : "failed",
        smsSentAt: result.success ? new Date() : null,
        smsScheduledFor: null,
      },
    });
    if (result.success) queuedFlushed++;
  }

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
      pausedAt: null,
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
      pausedAt: null,
      game: { status: "active" },
    },
    include: {
      answers: {
        select: { leaguePlayerId: true, betPlacedAt: true, answeredAt: true },
      },
      game: {
        include: {
          playerStates: {
            select: { leaguePlayerId: true, isEliminated: true },
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
        // Busted players don't bet — they only need to answer to bank a +1 next-game bonus.
        if (ps.isEliminated) return !answer || !answer.answeredAt;
        return !answer || !answer.betPlacedAt || !answer.answeredAt;
      })
      .map((ps) => ps.leaguePlayerId);

    for (const playerId of incompletePlayerIds) {
      await notifyActionReminder(round.id, playerId, "answer");
      notificationsSent++;
    }
  }

  // ─── 3. Auto-skip (leagues with autoSkipEnabled) ─────────────────────────────
  // Skip at-bat players whose deferred skip deadline has passed.
  // Deadline = round.updatedAt + 24h, OR if that lands in quiet hours,
  // quiet-end + 1h so the player gets the morning ping AND an hour to act.

  let autoSkipsPerformed = 0;
  let autoSkipWarningsSent = 0;

  const autoSkipStaleRounds = await prisma.round.findMany({
    where: {
      status: "awaiting_question",
      updatedAt: { lte: twentyFourHoursAgo },
      pausedAt: null,
      game: {
        status: "active",
        season: { league: { autoSkipEnabled: true } },
      },
    },
    select: {
      id: true,
      updatedAt: true,
      atBatPlayerId: true,
      game: {
        select: {
          season: {
            select: {
              league: {
                select: { id: true, quietHoursEnabled: true, quietHoursStart: true, quietHoursEnd: true },
              },
            },
          },
        },
      },
    },
    take: 50,
  });

  for (const round of autoSkipStaleRounds) {
    if (!round.atBatPlayerId) continue;

    // Look up the user ID for the at-bat player
    const atBatPlayer = await prisma.leaguePlayer.findUnique({
      where: { id: round.atBatPlayerId },
      select: { userId: true, isFake: true },
    });
    if (!atBatPlayer || atBatPlayer.isFake) continue;

    const league = round.game.season.league;
    const quietCtx = await getLeagueQuietCtx(league.id);
    const tz = quietCtx?.timezone ?? DEFAULT_TZ;
    const cfg: QuietHoursConfig = {
      quietHoursEnabled: league.quietHoursEnabled,
      quietHoursStart: league.quietHoursStart,
      quietHoursEnd: league.quietHoursEnd,
    };

    const effectiveDeadline = deferredSkipDeadline(round.updatedAt, cfg, tz);

    if (now >= effectiveDeadline) {
      // Time to skip
      try {
        await skipPlayerTurn(round.id, round.atBatPlayerId);
        await notifyAutoSkipped(round.id, round.atBatPlayerId);
        autoSkipsPerformed++;
        notificationsSent++;
      } catch (err) {
        console.error("[AutoSkip] Failed to skip player:", err);
      }
    } else {
      // Not yet at deadline — send warning if not already sent
      const existingWarning = await prisma.notification.findFirst({
        where: {
          roundId: round.id,
          userId: atBatPlayer.userId,
          type: "auto_skip_warning",
        },
        select: { id: true },
      });
      if (!existingWarning) {
        await notifyAutoSkipWarning(round.id, round.atBatPlayerId);
        notificationsSent++;
        autoSkipWarningsSent++;
      }
    }
  }

  // ─── 3b. Auto-close stale answering rounds (leagues with autoSkipEnabled) ───
  // Same deferred-deadline logic for rounds in the answering phase.

  let autoClosesPerformed = 0;
  let autoCloseWarningsSent = 0;

  const autoCloseStaleRounds = await prisma.round.findMany({
    where: {
      status: { in: ["question_submitted", "category_revealed"] },
      updatedAt: { lte: twentyFourHoursAgo },
      pausedAt: null,
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
          season: {
            select: {
              league: {
                select: { id: true, quietHoursEnabled: true, quietHoursStart: true, quietHoursEnd: true },
              },
            },
          },
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

    const league = round.game.season.league;
    const quietCtx = await getLeagueQuietCtx(league.id);
    const tz = quietCtx?.timezone ?? DEFAULT_TZ;
    const cfg: QuietHoursConfig = {
      quietHoursEnabled: league.quietHoursEnabled,
      quietHoursStart: league.quietHoursStart,
      quietHoursEnd: league.quietHoursEnd,
    };

    const effectiveDeadline = deferredSkipDeadline(round.updatedAt, cfg, tz);

    if (now >= effectiveDeadline) {
      // closeRound creates absent RoundAnswers with the correct penalty
      try {
        await closeRound(round.id);
        await notifyAutoClosedRound(round.id);
        autoClosesPerformed++;
        notificationsSent++;
      } catch (err) {
        console.error("[AutoClose] Failed to auto-close round:", err);
      }
    } else {
      // Send warning to each incomplete player (if not already sent for this round)
      const existingWarning = await prisma.notification.findFirst({
        where: { roundId: round.id, type: "auto_close_warning" },
        select: { id: true },
      });
      if (!existingWarning) {
        for (const playerId of incompletePlayerIds) {
          await notifyAutoCloseWarning(round.id, playerId);
          notificationsSent++;
          autoCloseWarningsSent++;
        }
      }
    }
  }

  return NextResponse.json({
    success: true,
    queuedFlushed,
    approachingRoundsChecked: approachingRounds.length,
    staleRoundsChecked:
      staleAwaitingQuestion.length + staleAwaitingAnswers.length,
    autoSkipRoundsChecked: autoSkipStaleRounds.length,
    autoSkipsPerformed,
    autoSkipWarningsSent,
    autoCloseRoundsChecked: autoCloseStaleRounds.length,
    autoClosesPerformed,
    autoCloseWarningsSent,
    notificationsSent,
    timestamp: now.toISOString(),
  });
}

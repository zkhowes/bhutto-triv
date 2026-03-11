import { prisma } from "./prisma";
import { sendSms } from "./sms";

export type NotificationLevel = "none" | "low" | "high";
export type NotificationType =
  | "at_bat"
  | "new_question"
  | "all_answers_in"
  | "on_deck"
  | "round_results"
  | "about_to_be_skipped"
  | "round_closed_by_commissioner"
  | "flag_thrown"
  | "flag_resolved";

// Which levels each notification type gets sent at
const LEVEL_MAP: Record<NotificationType, NotificationLevel[]> = {
  at_bat: ["low", "high"],
  new_question: ["low", "high"],
  all_answers_in: ["low", "high"],
  on_deck: ["low"],
  round_results: ["high"],
  about_to_be_skipped: ["high"],
  round_closed_by_commissioner: ["low"],
  flag_thrown: ["low", "high"],
  flag_resolved: ["low", "high"],
};

// ─── Effective Level Resolution ───────────────────────────────────────────────

async function getGlobalOverride(): Promise<"none" | "commissioner"> {
  const settings = await prisma.globalSettings.findUnique({
    where: { id: "singleton" },
  });
  return (settings?.notificationOverride as "none" | "commissioner") ?? "commissioner";
}

async function getEffectiveLevel(
  userId: string,
  leagueId: string
): Promise<NotificationLevel> {
  const globalOverride = await getGlobalOverride();
  if (globalOverride === "none") return "none";

  const [user, league] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { notificationPreference: true } }),
    prisma.league.findUnique({ where: { id: leagueId }, select: { notificationMode: true } }),
  ]);

  // Player override takes precedence over league setting
  if (user?.notificationPreference) {
    return user.notificationPreference as NotificationLevel;
  }

  return (league?.notificationMode as NotificationLevel) ?? "low";
}

// ─── Core Create/Send ─────────────────────────────────────────────────────────

interface CreateNotificationParams {
  userId: string;
  leagueId?: string;
  gameId?: string;
  roundId?: string;
  type: NotificationType;
  title: string;
  message: string;
  destinationUrl?: string; // Final URL player lands on
  phoneNumber?: string;    // If provided and level warrants, send SMS
}

async function createNotification({
  userId,
  leagueId,
  gameId,
  roundId,
  type,
  title,
  message,
  destinationUrl,
  phoneNumber,
}: CreateNotificationParams): Promise<void> {
  // Determine effective level for this user+league
  const level = leagueId
    ? await getEffectiveLevel(userId, leagueId)
    : "low";

  // `link` stores the final destination URL (e.g., /rounds/abc123)
  // The click-tracking URL is computed as /api/notifications/click/{id}
  // and is only used in the SMS body — not stored in `link`
  const notification = await prisma.notification.create({
    data: {
      userId,
      leagueId: leagueId ?? null,
      gameId: gameId ?? null,
      roundId: roundId ?? null,
      type,
      title,
      message,
      link: destinationUrl ?? null,
      isRead: false,
    },
  });

  // SMS: only send if level allows this notification type
  const allowedLevels = LEVEL_MAP[type];
  const shouldSms = allowedLevels.includes(level) && phoneNumber;

  if (shouldSms) {
    const appUrl = process.env.NEXTAUTH_URL ?? "";
    // Click-tracking URL: redirect to destinationUrl and record the click
    const clickUrl = `${appUrl}/api/notifications/click/${notification.id}`;
    const smsBody = `${title}\n${clickUrl}`;
    const result = await sendSms(phoneNumber!, smsBody);
    await prisma.notification.update({
      where: { id: notification.id },
      data: {
        smsStatus: result.success ? "sent" : "failed",
        smsSentAt: result.success ? new Date() : null,
      },
    });
  }
}

// ─── Player Lookup Helpers ────────────────────────────────────────────────────

interface PlayerInfo {
  userId: string;
  phoneNumber?: string;
  leaguePlayerId: string;
  isActive: boolean;
  isFake: boolean;
}

async function getPlayerInfo(leaguePlayerId: string): Promise<PlayerInfo | null> {
  const lp = await prisma.leaguePlayer.findUnique({
    where: { id: leaguePlayerId },
    include: { user: { select: { id: true, phoneNumber: true } } },
  });
  if (!lp) return null;
  return {
    userId: lp.userId,
    phoneNumber: lp.user.phoneNumber ?? undefined,
    leaguePlayerId: lp.id,
    isActive: lp.isActive,
    isFake: lp.isFake,
  };
}

async function getRoundContext(roundId: string) {
  return prisma.round.findUnique({
    where: { id: roundId },
    include: {
      game: {
        include: {
          playerStates: { include: { leaguePlayer: { include: { user: { select: { id: true, phoneNumber: true } } } } } },
          season: { include: { league: { select: { id: true, notificationMode: true } } } },
        },
      },
    },
  });
}

// ─── Notification Triggers ────────────────────────────────────────────────────

/**
 * "You're up – time to submit a question"
 * Level: Low + High | Recipient: at-bat player
 * Trigger: Round becomes awaiting_question
 */
export async function notifyAtBat(roundId: string): Promise<void> {
  try {
    const round = await getRoundContext(roundId);
    if (!round?.atBatPlayerId) return;

    const leagueId = round.game.season.league.id;
    const player = await getPlayerInfo(round.atBatPlayerId);
    if (!player || !player.isActive || player.isFake) return;

    await createNotification({
      userId: player.userId,
      leagueId,
      gameId: round.gameId,
      roundId,
      type: "at_bat",
      title: "You're up – time to submit a question",
      message: "It's your turn to submit today's trivia question. Get creative!",
      destinationUrl: `/games/${round.gameId}?round=${roundId}`,
      phoneNumber: player.phoneNumber,
    });
  } catch (err) {
    console.error("[Notifications] notifyAtBat failed:", err);
  }
}

/**
 * "New question is ready – get your bets in"
 * Level: Low + High | Recipient: all players except at-bat
 * Trigger: Question submitted
 */
export async function notifyNewQuestion(roundId: string): Promise<void> {
  try {
    const round = await getRoundContext(roundId);
    if (!round) return;

    const leagueId = round.game.season.league.id;

    // All active, non-at-bat players
    const recipients = round.game.playerStates.filter(
      (ps) =>
        ps.leaguePlayerId !== round.atBatPlayerId &&
        !ps.leaguePlayer.isFake &&
        ps.leaguePlayer.isActive
    );

    for (const ps of recipients) {
      await createNotification({
        userId: ps.leaguePlayer.userId,
        leagueId,
        gameId: round.gameId,
        roundId,
        type: "new_question",
        title: "New question is ready – get your bets in",
        message: "A new trivia question has been submitted. Place your bet and answer before the deadline!",
        destinationUrl: `/games/${round.gameId}?round=${roundId}`,
        phoneNumber: ps.leaguePlayer.user.phoneNumber ?? undefined,
      });
    }
  } catch (err) {
    console.error("[Notifications] notifyNewQuestion failed:", err);
  }
}

/**
 * "All questions submitted – time to grade"
 * Level: Low + High | Recipient: at-bat player
 * Trigger: All eligible players have answered
 */
export async function notifyAllAnswersIn(roundId: string): Promise<void> {
  try {
    const round = await getRoundContext(roundId);
    if (!round?.atBatPlayerId) return;

    const leagueId = round.game.season.league.id;
    const player = await getPlayerInfo(round.atBatPlayerId);
    if (!player || !player.isActive || player.isFake) return;

    await createNotification({
      userId: player.userId,
      leagueId,
      gameId: round.gameId,
      roundId,
      type: "all_answers_in",
      title: "All questions submitted – time to grade",
      message: "All players have answered. Review and validate the AI grades for your question.",
      destinationUrl: `/games/${round.gameId}?round=${roundId}`,
      phoneNumber: player.phoneNumber,
    });
  } catch (err) {
    console.error("[Notifications] notifyAllAnswersIn failed:", err);
  }
}

/**
 * "You're on deck, start preparing a question"
 * Level: Low | Recipient: on-deck player
 * Trigger: New round becomes active
 */
export async function notifyOnDeck(roundId: string): Promise<void> {
  try {
    const round = await getRoundContext(roundId);
    if (!round?.onDeckPlayerId) return;

    const leagueId = round.game.season.league.id;
    const player = await getPlayerInfo(round.onDeckPlayerId);
    if (!player || !player.isActive || player.isFake) return;

    await createNotification({
      userId: player.userId,
      leagueId,
      gameId: round.gameId,
      roundId,
      type: "on_deck",
      title: "You're on deck – start preparing a question",
      message: "You're up next! Start working on your trivia question. You can queue one in advance if needed.",
      destinationUrl: `/games/${round.gameId}?round=${roundId}`,
      phoneNumber: player.phoneNumber,
    });
  } catch (err) {
    console.error("[Notifications] notifyOnDeck failed:", err);
  }
}

/**
 * "Round results"
 * Level: High | Recipient: all players
 * Trigger: Round closed and scored
 */
export async function notifyRoundResults(roundId: string): Promise<void> {
  try {
    const round = await getRoundContext(roundId);
    if (!round) return;

    const leagueId = round.game.season.league.id;

    const recipients = round.game.playerStates.filter(
      (ps) => !ps.leaguePlayer.isFake && ps.leaguePlayer.isActive
    );

    for (const ps of recipients) {
      await createNotification({
        userId: ps.leaguePlayer.userId,
        leagueId,
        gameId: round.gameId,
        roundId,
        type: "round_results",
        title: "Round results are in!",
        message: "The round has been scored. Check how you placed!",
        destinationUrl: `/games/${round.gameId}?round=${roundId}`,
        phoneNumber: ps.leaguePlayer.user.phoneNumber ?? undefined,
      });
    }
  } catch (err) {
    console.error("[Notifications] notifyRoundResults failed:", err);
  }
}

/**
 * "You're about to be skipped – get your bet in soon"
 * Level: High | Recipient: last player without bet+answer
 * Trigger: Vercel Cron job ~1hr before deadline
 */
export async function notifyAboutToBeSkipped(
  roundId: string,
  leaguePlayerId: string
): Promise<void> {
  try {
    const player = await getPlayerInfo(leaguePlayerId);
    if (!player || !player.isActive || player.isFake) return;

    // Deduplication: don't send if already notified this player for this round
    const alreadyNotified = await prisma.notification.findFirst({
      where: {
        roundId,
        userId: player.userId,
        type: "about_to_be_skipped",
      },
    });
    if (alreadyNotified) return;

    const round = await getRoundContext(roundId);
    if (!round) return;

    const leagueId = round.game.season.league.id;

    await createNotification({
      userId: player.userId,
      leagueId,
      gameId: round.gameId,
      roundId,
      type: "about_to_be_skipped",
      title: "You're about to be skipped – get your bet in soon",
      message: "The deadline is approaching! You're the last player without a bet and answer. Act now to avoid being skipped.",
      destinationUrl: `/games/${round.gameId}?round=${roundId}`,
      phoneNumber: player.phoneNumber,
    });
  } catch (err) {
    console.error("[Notifications] notifyAboutToBeSkipped failed:", err);
  }
}

/**
 * "Commissioner closed the round"
 * Level: Low | Recipient: all players except commissioner
 * Trigger: Commissioner force-closes a round
 */
export async function notifyRoundClosedByCommissioner(
  roundId: string,
  absentPlayerNames: string[]
): Promise<void> {
  try {
    const round = await getRoundContext(roundId);
    if (!round) return;

    const leagueId = round.game.season.league.id;

    // Find the commissioner's userId
    const commissioner = await prisma.leaguePlayer.findFirst({
      where: { leagueId, role: "commissioner", isActive: true },
      select: { userId: true },
    });
    const commissionerUserId = commissioner?.userId;

    // Find the next active round to link to
    const nextRound = await prisma.round.findFirst({
      where: {
        gameId: round.gameId,
        status: { in: ["awaiting_question", "question_submitted", "category_revealed"] },
      },
      orderBy: { number: "asc" },
    });

    const absentText = absentPlayerNames.length > 0
      ? ` ${absentPlayerNames.join(", ")} marked absent.`
      : "";
    const destinationUrl = nextRound
      ? `/games/${round.gameId}?round=${nextRound.id}`
      : `/games/${round.gameId}`;

    const recipients = round.game.playerStates.filter(
      (ps) =>
        ps.leaguePlayer.userId !== commissionerUserId &&
        !ps.leaguePlayer.isFake &&
        ps.leaguePlayer.isActive
    );

    for (const ps of recipients) {
      await createNotification({
        userId: ps.leaguePlayer.userId,
        leagueId,
        gameId: round.gameId,
        roundId,
        type: "round_closed_by_commissioner",
        title: `Commissioner closed round ${round.number}`,
        message: `Commissioner closed round ${round.number}.${absentText} New question time!`,
        destinationUrl,
        phoneNumber: ps.leaguePlayer.user.phoneNumber ?? undefined,
      });
    }
  } catch (err) {
    console.error("[Notifications] notifyRoundClosedByCommissioner failed:", err);
  }
}

/**
 * "Flag thrown on Round N!"
 * Level: Low + High | Recipient: all active players except flagger
 * Trigger: Player throws a challenge flag
 */
export async function notifyFlagThrown(
  roundId: string,
  flaggerPlayerId: string,
  flaggerName: string
): Promise<void> {
  try {
    const round = await getRoundContext(roundId);
    if (!round) return;

    const leagueId = round.game.season.league.id;

    const recipients = round.game.playerStates.filter(
      (ps) =>
        ps.leaguePlayerId !== flaggerPlayerId &&
        !ps.leaguePlayer.isFake &&
        ps.leaguePlayer.isActive
    );

    for (const ps of recipients) {
      await createNotification({
        userId: ps.leaguePlayer.userId,
        leagueId,
        gameId: round.gameId,
        roundId,
        type: "flag_thrown",
        title: `Flag thrown on Round ${round.number}!`,
        message: `${flaggerName} is contesting the round. Cast your vote!`,
        destinationUrl: `/games/${round.gameId}?round=${roundId}`,
        phoneNumber: ps.leaguePlayer.user.phoneNumber ?? undefined,
      });
    }
  } catch (err) {
    console.error("[Notifications] notifyFlagThrown failed:", err);
  }
}

/**
 * "Flag review resolved"
 * Level: Low + High | Recipient: all active players
 * Trigger: Flag review resolves (agreed or disagreed)
 */
export async function notifyFlagResolved(
  roundId: string,
  outcome: "agreed" | "disagreed",
  relevantPlayerName: string
): Promise<void> {
  try {
    const round = await getRoundContext(roundId);
    if (!round) return;

    const leagueId = round.game.season.league.id;

    const title = outcome === "agreed"
      ? `Round ${round.number} thrown out`
      : `Flag denied on Round ${round.number}`;
    const message = outcome === "agreed"
      ? `Round ${round.number} has been thrown out. Scores reversed.`
      : `${relevantPlayerName}'s flag was denied. They lose half their points.`;

    const recipients = round.game.playerStates.filter(
      (ps) => !ps.leaguePlayer.isFake && ps.leaguePlayer.isActive
    );

    for (const ps of recipients) {
      await createNotification({
        userId: ps.leaguePlayer.userId,
        leagueId,
        gameId: round.gameId,
        roundId,
        type: "flag_resolved",
        title,
        message,
        destinationUrl: `/games/${round.gameId}?round=${roundId}`,
        phoneNumber: ps.leaguePlayer.user.phoneNumber ?? undefined,
      });
    }
  } catch (err) {
    console.error("[Notifications] notifyFlagResolved failed:", err);
  }
}

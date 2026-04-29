/**
 * Revert a round that was auto-submitted from a player's question bank when
 * the question had already been played in that league.
 *
 * Action:
 *   - Find the league + season + game + round 1 by name/number
 *   - Verify Round 1 is in QUESTION_SUBMITTED or CATEGORY_REVEALED, not graded
 *     and has no flag review
 *   - Refund any blindBetUsed flags set by answers on this round
 *   - Delete RoundAnswer rows on this round (no point refund needed —
 *     bets only deduct at closeRound, which hasn't happened)
 *   - Delete the Question row, set the round back to AWAITING_QUESTION
 *   - Clear useOnNextRound on any of the at-bat player's drafts whose text
 *     matches the deleted question (so it doesn't auto-fire again)
 *   - Re-notify the at-bat player
 *
 * Usage (from bhutto-triv/):
 *   Dry run:  npx tsx scripts/revert-auto-submitted-round.ts
 *   Execute:  npx tsx scripts/revert-auto-submitted-round.ts --apply
 */
import { PrismaClient } from "@prisma/client";
import { ROUND_STATUS } from "../src/lib/constants";
import { notifyAtBat } from "../src/lib/notifications";

const prisma = new PrismaClient();

const LEAGUE_NAME_CONTAINS = "Bhutto";
const SEASON_NUMBER = 4;
const GAME_NUMBER = 2;
const ROUND_NUMBER = 1;

async function main() {
  const apply = process.argv.includes("--apply");
  console.log(`[revert] mode=${apply ? "APPLY" : "DRY-RUN"}`);

  const leagues = await prisma.league.findMany({
    where: { name: { contains: LEAGUE_NAME_CONTAINS, mode: "insensitive" } },
    select: { id: true, name: true },
  });
  if (leagues.length !== 1) {
    console.error(`[revert] expected 1 matching league, got ${leagues.length}:`, leagues);
    process.exit(1);
  }
  const league = leagues[0];
  console.log(`[revert] league: ${league.name} (${league.id})`);

  const season = await prisma.season.findFirst({
    where: { leagueId: league.id, number: SEASON_NUMBER },
    select: { id: true, number: true },
  });
  if (!season) throw new Error(`Season ${SEASON_NUMBER} not found`);

  const game = await prisma.game.findFirst({
    where: { seasonId: season.id, number: GAME_NUMBER },
    select: { id: true, number: true, status: true },
  });
  if (!game) throw new Error(`Game ${GAME_NUMBER} not found`);
  console.log(`[revert] season ${season.number}, game ${game.number} (${game.status})`);

  const round = await prisma.round.findFirst({
    where: { gameId: game.id, number: ROUND_NUMBER },
    include: {
      question: true,
      answers: true,
      flagReview: true,
    },
  });
  if (!round) throw new Error(`Round ${ROUND_NUMBER} not found`);

  console.log(`[revert] round ${round.number} status=${round.status}`);
  if (!round.question) {
    console.log("[revert] no question on this round — nothing to revert");
    return;
  }
  console.log(`[revert] question id=${round.question.id} creator=${round.question.creatorUserId}`);
  console.log(`[revert] question text: "${round.question.questionText}"`);

  if (round.flagReview) {
    throw new Error("refusing to revert — round has a flag review");
  }
  if (
    round.status !== ROUND_STATUS.QUESTION_SUBMITTED &&
    round.status !== ROUND_STATUS.CATEGORY_REVEALED
  ) {
    throw new Error(
      `refusing to revert — round status is "${round.status}", expected QUESTION_SUBMITTED or CATEGORY_REVEALED`
    );
  }
  console.log(`[revert] answers on round: ${round.answers.length}`);
  for (const a of round.answers) {
    console.log(
      `         - leaguePlayer=${a.leaguePlayerId} bet=${a.betAmount ?? "?"} blind=${a.isBlindBet} answered=${a.answeredAt ? "yes" : "no"} pointsWon=${a.pointsWon}`
    );
    if (a.pointsWon !== 0) {
      throw new Error(
        `refusing to revert — answer ${a.id} has pointsWon=${a.pointsWon}; round may have already been graded`
      );
    }
  }
  const blindAnswerers = round.answers.filter((a) => a.isBlindBet);
  console.log(`[revert] answers with blindBetUsed to refund: ${blindAnswerers.length}`);

  // Find the draft(s) the at-bat player had with useOnNextRound=true that
  // contain the same text — clear those flags.
  const creatorUserId = round.question.creatorUserId;
  const playedText = round.question.questionText.toLowerCase().trim();

  const matchingDrafts = await prisma.questionDraft.findMany({
    where: {
      userId: creatorUserId,
      useOnNextRound: true,
    },
  });
  const toClear = matchingDrafts.filter(
    (d) => (d.questionText ?? "").toLowerCase().trim() === playedText
  );
  console.log(`[revert] drafts with useOnNextRound matching this text: ${toClear.length}`);

  // Check whether the player has another auto-submit draft that hasn't been
  // played in this league — informational only.
  const playedTextsInLeague = await prisma.question.findMany({
    where: {
      creatorUserId,
      round: { game: { season: { leagueId: league.id } } },
    },
    select: { questionText: true },
  });
  const playedSet = new Set(
    playedTextsInLeague.map((q) => q.questionText.toLowerCase().trim())
  );
  // After we delete the current question, this set should not include the offending text.
  playedSet.delete(playedText);

  const otherCandidates = matchingDrafts.filter((d) => {
    const t = (d.questionText ?? "").toLowerCase().trim();
    return t && t !== playedText && !playedSet.has(t);
  });
  console.log(`[revert] other auto-submit drafts eligible to fire: ${otherCandidates.length}`);
  for (const d of otherCandidates) {
    console.log(`         - draft ${d.id}: "${d.questionText}"`);
  }

  if (!apply) {
    console.log("[revert] DRY-RUN complete — re-run with --apply to execute");
    return;
  }

  // ── APPLY ────────────────────────────────────────────────────────────────
  await prisma.$transaction(async (tx) => {
    // Refund blindBetUsed for any answerer who blind-bet this round.
    for (const a of blindAnswerers) {
      await tx.gamePlayerState.updateMany({
        where: { gameId: game.id, leaguePlayerId: a.leaguePlayerId },
        data: { blindBetUsed: false },
      });
    }
    // Delete answers (RoundAnswer FKs reference Question, so do this before deleting Question).
    await tx.roundAnswer.deleteMany({ where: { roundId: round.id } });
    await tx.question.delete({ where: { id: round.question!.id } });
    await tx.round.update({
      where: { id: round.id },
      data: {
        status: ROUND_STATUS.AWAITING_QUESTION,
        // Clear any timing flags that were set when the question went live
        categoryRevealAt: null,
        deadlineAt: null,
      },
    });
    for (const d of toClear) {
      await tx.questionDraft.update({
        where: { id: d.id },
        data: { useOnNextRound: false },
      });
    }
  });
  console.log("[revert] reverted round, deleted answers, cleared draft flags");

  // Re-notify the at-bat player. Do NOT re-run tryAutoSubmitFromBank here:
  // the new server-side guard will pick a non-played draft on its own next
  // time, but right now we want to surface this to the user — let them pick.
  // (If they had an eligible alternate, they can toggle it on; the engine
  // does not currently have a "scan and auto-fire on existing rounds" job.)
  try {
    await notifyAtBat(round.id);
    console.log("[revert] notified at-bat player");
  } catch (err) {
    console.error("[revert] notifyAtBat failed:", err);
  }

  console.log("[revert] done.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

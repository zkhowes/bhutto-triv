/**
 * Fix Stander Clan / Game 1 / Round 9.
 *
 * Background: the AI workshop produced an ordering question whose orderingItems were
 * listed in the OPPOSITE direction of orderingDirection ("earliest to latest" with
 * Marvel Iron Man at position 1, Star Wars at position 4). Round 9 was the final
 * round of Game 1, so the wrong winner was crowned.
 *
 * This script:
 *  1) Rewrites the Question row with the correct orderingItems and adds
 *     orderingItemValues = [1977, 2001, 2001, 2008] so equal-year tied items
 *     (Harry Potter / LotR) score correctly under the new value-equivalence rule.
 *  2) Remaps every RoundAnswer.freeTextAnswer for round 9 from the OLD original-index
 *     basis (Marvel=0, HP=1, LotR=2, SW=3) to the NEW basis (SW=0, HP=1, LotR=2, Marvel=3).
 *  3) Re-grades round 9 using determineOrderingWinners (with values).
 *  4) Recomputes round-9 placements/F1/pointsWon via scoreRound (mirroring closeRound's blind+clamp logic).
 *  5) Recomputes GamePlayerState.points by summing pointsWon across rounds 1..9 on top of startingPoints.
 *  6) Recomputes end-of-game F1 (totalF1Points) by sorting on points desc, bonusEarned desc.
 *  7) Re-runs awardQuestionQualityBonus.
 *  8) Sends a Notification + Mosio SMS to every active league player explaining the change.
 *
 * Flags:
 *   --dry-run     : compute and print everything, write nothing.
 *   --skip-notify : write data but skip the Notification + Mosio SMS.
 */
import { PrismaClient } from "@prisma/client";
import {
  determineOrderingWinners,
  scoreRound,
  getF1PointsForPlacement,
} from "../src/lib/scoring";
import {
  GAME_STATUS,
  ROUND_STATUS,
} from "../src/lib/constants";

const prisma = new PrismaClient();

// ─── Constants tied to this specific repair ────────────────────────────────
const LEAGUE_ID = "cmnvyikt60000cpmzqr3vbecb"; // Stander Clan
const GAME_ID = "cmnw4nu4g0005ad29hn49bflw";   // Game 1
const ROUND_9_ID = "cmnw4nv0h0015ad29rcw3woju";
const QUESTION_ID = "cmohukpn40001f3j80ws0xpun";

const NEW_ITEMS = [
  "Star Wars",
  "Harry Potter",
  "The Lord of the Rings",
  "Marvel Cinematic Universe (Iron Man)",
];
const NEW_VALUES = [1977, 2001, 2001, 2008];
const NEW_CORRECT_ORDER = [1, 2, 3, 4];
const DIRECTION = "earliest to latest";

// Old basis index -> new basis index.
//   old: ["Marvel" (0), "Harry Potter" (1), "LotR" (2), "Star Wars" (3)]
//   new: ["Star Wars" (0), "Harry Potter" (1), "LotR" (2), "Marvel" (3)]
const OLD_TO_NEW_INDEX: Record<number, number> = { 0: 3, 1: 1, 2: 2, 3: 0 };

// ─── CLI flags ─────────────────────────────────────────────────────────────
const args = new Set(process.argv.slice(2));
const dryRun = args.has("--dry-run");
const skipNotify = args.has("--skip-notify");

function logSection(label: string) {
  console.log(`\n=== ${label} ===`);
}

function fmtName(p: { fakeNickname: string | null; user: { nickname: string | null } | null }) {
  return p.fakeNickname || p.user?.nickname || "?";
}

async function main() {
  console.log(`Stander Clan repair${dryRun ? " (DRY RUN)" : ""}${skipNotify ? " (skip notify)" : ""}`);

  const game = await prisma.game.findUnique({
    where: { id: GAME_ID },
    include: {
      season: { include: { league: true } },
      rounds: { orderBy: { number: "asc" } },
      playerStates: {
        include: { leaguePlayer: { include: { user: { select: { nickname: true } } } } },
      },
    },
  });
  if (!game) throw new Error("Game not found");

  const question = await prisma.question.findUnique({ where: { id: QUESTION_ID } });
  if (!question) throw new Error("Round-9 question not found");

  // Sanity-check: stored orderingItems still in the buggy state we expect.
  const storedItems: string[] = JSON.parse(question.orderingItems ?? "[]");
  const expectedOldItems = [
    "Marvel Cinematic Universe (Iron Man)",
    "Harry Potter",
    "The Lord of the Rings",
    "Star Wars",
  ];
  const matchesOld = JSON.stringify(storedItems) === JSON.stringify(expectedOldItems);
  const matchesNew = JSON.stringify(storedItems) === JSON.stringify(NEW_ITEMS);
  if (!matchesOld && !matchesNew) {
    throw new Error(
      `Unexpected orderingItems on Question ${QUESTION_ID}: ${question.orderingItems}`
    );
  }
  if (matchesNew && question.orderingItemValues) {
    console.log("Question already corrected; will only re-run scoring/standings.");
  }

  // Round 9 answers.
  const round9Answers = await prisma.roundAnswer.findMany({
    where: { roundId: ROUND_9_ID },
    include: {
      leaguePlayer: { include: { user: { select: { nickname: true } } } },
    },
  });

  // Compute remapped player orderings (only for non-absent ones with a freeTextAnswer).
  const remapped: Array<{
    answerId: string;
    leaguePlayerId: string;
    nickname: string;
    isAbsent: boolean;
    isBlindBet: boolean;
    betAmount: number;
    answeredAt: Date | null;
    oldFreeText: string | null;
    newFreeText: string | null;
    newPlayerOrder: number[] | null;
  }> = [];
  for (const a of round9Answers) {
    let newFreeText: string | null = null;
    let newPlayerOrder: number[] | null = null;
    if (!a.isAbsent && a.freeTextAnswer && matchesOld) {
      try {
        const oldArr = JSON.parse(a.freeTextAnswer) as number[];
        if (Array.isArray(oldArr) && oldArr.length === 4) {
          const out = new Array<number>(4);
          for (let oldIdx = 0; oldIdx < 4; oldIdx++) {
            const newIdx = OLD_TO_NEW_INDEX[oldIdx];
            out[newIdx] = oldArr[oldIdx];
          }
          newPlayerOrder = out;
          newFreeText = JSON.stringify(out);
        }
      } catch {
        // leave null
      }
    } else if (!a.isAbsent && a.freeTextAnswer && matchesNew) {
      // Already remapped from a prior partial run — read as-is.
      try {
        const arr = JSON.parse(a.freeTextAnswer) as number[];
        if (Array.isArray(arr) && arr.length === 4) {
          newPlayerOrder = arr;
          newFreeText = a.freeTextAnswer;
        }
      } catch { /* ignore */ }
    }
    remapped.push({
      answerId: a.id,
      leaguePlayerId: a.leaguePlayerId,
      nickname: fmtName(a.leaguePlayer),
      isAbsent: a.isAbsent,
      isBlindBet: a.isBlindBet,
      betAmount: a.betAmount ?? 0,
      answeredAt: a.answeredAt,
      oldFreeText: a.freeTextAnswer,
      newFreeText,
      newPlayerOrder,
    });
  }

  logSection("Round 9 answer remap");
  for (const r of remapped) {
    if (r.isAbsent) {
      console.log(`  ${r.nickname.padEnd(15)} absent`);
    } else {
      console.log(
        `  ${r.nickname.padEnd(15)} ${r.oldFreeText} -> ${r.newFreeText ?? "(unchanged)"}`
      );
    }
  }

  // Re-grade with the new winners helper, including value equivalence.
  const submissions = remapped
    .filter((r) => !r.isAbsent && r.newPlayerOrder)
    .map((r) => ({ id: r.answerId, playerOrder: r.newPlayerOrder! }));
  const { winners, scores } = determineOrderingWinners(
    NEW_CORRECT_ORDER,
    submissions,
    NEW_VALUES
  );

  logSection("Round 9 grading (values: SW=1977, HP=2001, LotR=2001, Marvel=2008)");
  for (const r of remapped) {
    if (r.isAbsent) continue;
    const score = scores.get(r.answerId) ?? 0;
    const isWinner = winners.has(r.answerId);
    console.log(
      `  ${r.nickname.padEnd(15)} ${score}/4 correct${isWinner ? "  WINNER" : ""}`
    );
  }

  // Build PlayerRoundResult inputs for scoreRound (round 9 only).
  // Need each player's "isEliminated" entering round 9 and their nickname for tiebreak.
  // We also need the PRE-round-9 points for clamp on negative pointsWon.
  const stateBeforeR9 = await computePointsBeforeRound(
    GAME_ID,
    9,
    game.playerStates.map((ps) => ({
      leaguePlayerId: ps.leaguePlayerId,
      startingPoints: ps.startingPoints,
    }))
  );

  const playerNicknames = new Map<string, string>();
  for (const ps of game.playerStates) playerNicknames.set(ps.leaguePlayerId, fmtName(ps.leaguePlayer));

  // Determine eliminated state for round 9 = points before round 9 == 0.
  const eliminatedBeforeR9 = new Map<string, boolean>();
  stateBeforeR9.forEach((pts, id) => {
    eliminatedBeforeR9.set(id, pts <= 0);
  });

  // Build the input for scoreRound: include all RoundAnswers, mark winners as isCorrect.
  const newIsCorrectByAnswerId = new Map<string, boolean>();
  for (const a of round9Answers) {
    if (a.isAbsent) {
      newIsCorrectByAnswerId.set(a.id, false);
    } else {
      newIsCorrectByAnswerId.set(a.id, winners.has(a.id));
    }
  }

  const scoringInput = round9Answers.map((a) => ({
    leaguePlayerId: a.leaguePlayerId,
    isCorrect: newIsCorrectByAnswerId.get(a.id) ?? false,
    betAmount: a.betAmount ?? 0,
    answeredAt: a.answeredAt,
    isAbsent: a.isAbsent,
    isEliminated: eliminatedBeforeR9.get(a.leaguePlayerId) ?? false,
    nickname: playerNicknames.get(a.leaguePlayerId) ?? "?",
  }));
  const scored = scoreRound(scoringInput);

  // Apply blind multiplier + clamp the same way closeRound does.
  type Round9Update = {
    answerId: string;
    leaguePlayerId: string;
    placement: number | null;
    f1Points: number;
    pointsWon: number; // final, post-blind, post-clamp
    fastestLap: boolean;
    isCorrect: boolean;
  };
  const round9Updates: Round9Update[] = [];

  for (const a of round9Answers) {
    const score = scored.find((s) => s.leaguePlayerId === a.leaguePlayerId);
    if (!score) continue;
    const isElim = eliminatedBeforeR9.get(a.leaguePlayerId) ?? false;
    if (isElim) {
      // Busted player path: no points/F1/placement; original code increments bonusEarned.
      // Stander Clan game 1 had no busted players entering round 9 (only Spencer was at 0
      // — verify and skip if so).
      round9Updates.push({
        answerId: a.id,
        leaguePlayerId: a.leaguePlayerId,
        placement: null,
        f1Points: 0,
        pointsWon: 0,
        fastestLap: false,
        isCorrect: newIsCorrectByAnswerId.get(a.id) ?? false,
      });
      continue;
    }

    const blindMul = a.isBlindBet ? 2 : 1;
    const isCorrect = newIsCorrectByAnswerId.get(a.id) ?? false;
    let raw: number;
    if (a.isAbsent) {
      // Absentee penalty stays as-is — round-grading change doesn't touch absences.
      raw = a.pointsWon ?? 0;
    } else if (isCorrect) {
      raw = (a.betAmount ?? 0) * blindMul;
    } else {
      raw = -(a.betAmount ?? 0) * blindMul;
    }
    const prevPoints = stateBeforeR9.get(a.leaguePlayerId) ?? 0;
    const clamped = raw < 0 ? Math.max(raw, -prevPoints) : raw;

    round9Updates.push({
      answerId: a.id,
      leaguePlayerId: a.leaguePlayerId,
      placement: score.placement,
      f1Points: score.f1Points,
      pointsWon: clamped,
      fastestLap: score.fastestLap,
      isCorrect,
    });
  }

  // Final per-player game points = startingPoints + sum(pointsWon r1..r8) + clamped r9.
  const finalPoints = new Map<string, number>();
  for (const ps of game.playerStates) {
    const before = stateBeforeR9.get(ps.leaguePlayerId) ?? ps.startingPoints;
    const r9 = round9Updates.find((u) => u.leaguePlayerId === ps.leaguePlayerId);
    const after = Math.max(0, before + (r9?.pointsWon ?? 0));
    finalPoints.set(ps.leaguePlayerId, after);
  }

  logSection("Round 9 round-level results (post-fix)");
  for (const u of round9Updates) {
    const name = playerNicknames.get(u.leaguePlayerId) ?? "?";
    console.log(
      `  ${name.padEnd(15)} place=${u.placement ?? "-"} f1=${u.f1Points} won=${u.pointsWon} fastest=${u.fastestLap} correct=${u.isCorrect}`
    );
  }

  // End-of-game F1 standings (mirror game-engine.ts:1019-1035).
  const totalPlayers = game.playerStates.length;
  const sortedForF1 = [...game.playerStates].sort((a, b) => {
    const aPts = finalPoints.get(a.leaguePlayerId) ?? 0;
    const bPts = finalPoints.get(b.leaguePlayerId) ?? 0;
    if (bPts !== aPts) return bPts - aPts;
    return b.bonusEarned - a.bonusEarned;
  });
  const newTotalF1: Map<string, number> = new Map();
  for (let i = 0; i < sortedForF1.length; i++) {
    newTotalF1.set(sortedForF1[i].leaguePlayerId, getF1PointsForPlacement(i + 1, totalPlayers));
  }

  logSection("End-of-game F1 standings (post-fix)");
  console.log("Pos | Player          | Points | F1 | Δ vs current");
  for (let i = 0; i < sortedForF1.length; i++) {
    const ps = sortedForF1[i];
    const name = playerNicknames.get(ps.leaguePlayerId) ?? "?";
    const newPts = finalPoints.get(ps.leaguePlayerId) ?? 0;
    const newF1 = newTotalF1.get(ps.leaguePlayerId) ?? 0;
    const dPts = newPts - ps.points;
    const dF1 = newF1 - ps.totalF1Points;
    console.log(
      ` ${String(i + 1).padStart(2)} | ${name.padEnd(15)} | ${String(newPts).padStart(6)} | ${String(newF1).padStart(2)} | pts ${dPts >= 0 ? "+" : ""}${dPts}, f1 ${dF1 >= 0 ? "+" : ""}${dF1}`
    );
  }

  if (dryRun) {
    console.log("\nDRY RUN — no changes written.");
    await prisma.$disconnect();
    return;
  }

  // ─── Apply changes in a transaction ──────────────────────────────────────
  await prisma.$transaction(async (tx) => {
    // 1) Question row.
    await tx.question.update({
      where: { id: QUESTION_ID },
      data: {
        orderingItems: JSON.stringify(NEW_ITEMS),
        orderingCorrectOrder: JSON.stringify(NEW_CORRECT_ORDER),
        orderingItemValues: JSON.stringify(NEW_VALUES),
        orderingDirection: DIRECTION,
      },
    });

    // 2) Remap each round-9 RoundAnswer.freeTextAnswer (only when we computed a new mapping).
    for (const r of remapped) {
      if (r.newFreeText && r.newFreeText !== r.oldFreeText) {
        await tx.roundAnswer.update({
          where: { id: r.answerId },
          data: { freeTextAnswer: r.newFreeText },
        });
      }
    }

    // 3) Update RoundAnswer scoring (round 9 only).
    for (const u of round9Updates) {
      await tx.roundAnswer.update({
        where: { id: u.answerId },
        data: {
          isCorrect: u.isCorrect,
          gradedBy: "auto",
          placement: u.placement,
          f1Points: u.f1Points,
          pointsWon: u.pointsWon,
          fastestLap: u.fastestLap,
        },
      });
    }

    // 4) Reset GamePlayerState.points / isEliminated using replayed totals.
    for (const ps of game.playerStates) {
      const newPts = finalPoints.get(ps.leaguePlayerId) ?? 0;
      const newF1 = newTotalF1.get(ps.leaguePlayerId) ?? 0;
      await tx.gamePlayerState.update({
        where: { id: ps.id },
        data: {
          points: newPts,
          isEliminated: newPts === 0,
          totalF1Points: newF1,
        },
      });
    }

    // 5) Make sure round 9 is GRADED and game COMPLETED.
    await tx.round.update({
      where: { id: ROUND_9_ID },
      data: { status: ROUND_STATUS.GRADED },
    });
    await tx.game.update({
      where: { id: GAME_ID },
      data: { status: GAME_STATUS.COMPLETED, completedAt: game.completedAt ?? new Date() },
    });
  });

  // 6) Question quality bonus — pulled in *after* the txn so its own writes see committed state.
  const { awardQuestionQualityBonus } = await import("../src/lib/game-engine");
  await awardQuestionQualityBonus(GAME_ID);

  // 7) Notifications.
  if (!skipNotify) {
    const winnerEntry = sortedForF1[0];
    const winnerName = playerNicknames.get(winnerEntry.leaguePlayerId) ?? "?";
    const title = "Stander Clan: Game 1 round 9 re-graded";
    const message = `Round 9 of Game 1 was re-graded — the original ordering question listed franchises in the reverse direction it asked for. Updated standings are live; the new game winner is ${winnerName}.`;
    await sendLeagueAnnouncement(title, message);
  }

  console.log("\nDone.");
  await prisma.$disconnect();
}

/**
 * Replay rounds 1..(beforeRound-1) on top of each player's startingPoints to derive
 * "points entering round N". Cancelled rounds are skipped (they don't have pointsWon).
 * Negative pointsWon is clamped at -prevPoints just like the engine does, so the floor is 0.
 */
async function computePointsBeforeRound(
  gameId: string,
  beforeRoundNumber: number,
  players: Array<{ leaguePlayerId: string; startingPoints: number }>
): Promise<Map<string, number>> {
  const rounds = await prisma.round.findMany({
    where: { gameId, isCancelled: false, number: { lt: beforeRoundNumber } },
    orderBy: { number: "asc" },
    include: { answers: true },
  });
  const map = new Map<string, number>();
  for (const p of players) map.set(p.leaguePlayerId, p.startingPoints);
  for (const r of rounds) {
    for (const a of r.answers) {
      const cur = map.get(a.leaguePlayerId) ?? 0;
      const change = a.pointsWon ?? 0;
      const next = Math.max(0, cur + change);
      map.set(a.leaguePlayerId, next);
    }
  }
  return map;
}

/**
 * Send an in-app Notification + Mosio SMS to every active, non-fake league player.
 * Uses the existing createNotification helper so SMS opt-in / level filtering and
 * click-tracking URLs are consistent with the rest of the app.
 */
async function sendLeagueAnnouncement(title: string, text: string) {
  const { createNotification } = await import("../src/lib/notifications");
  const players = await prisma.leaguePlayer.findMany({
    where: { leagueId: LEAGUE_ID, isActive: true, isPaused: false, isFake: false },
    include: { user: { select: { id: true, phoneNumber: true } } },
  });

  for (const p of players) {
    await createNotification({
      userId: p.userId,
      leagueId: LEAGUE_ID,
      gameId: GAME_ID,
      type: "round_results",
      title,
      message: text,
      destinationUrl: `/games/${GAME_ID}`,
      phoneNumber: p.user.phoneNumber ?? undefined,
    });
  }
  console.log(`Sent announcement to ${players.length} player(s).`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

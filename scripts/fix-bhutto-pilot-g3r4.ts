/**
 * Fix Bhutto Pilot / Game 3 / Round 4.
 *
 * Background: MC question "Which was the largest margin of victory in a Super Bowl?"
 * was authored with correctOption=D ("2014 Seahawks vs Broncos", 35-pt margin) when
 * the correct answer is B ("1989 49ers vs Broncos", 45-pt margin — SB XXIV).
 * A flag was thrown; rather than cancel the round (which would discard the 3 players'
 * correct picks of B), we flip the answer and regrade in place.
 *
 * Steps:
 *  1) Print full before-state.
 *  2) Reverse each RoundAnswer.pointsWon from its GamePlayerState.points,
 *     restoring whatever isEliminated flag was set this round.
 *  3) Mark FlagReview as agreed (resolvedAt = now).
 *  4) Update Question.correctOption D -> B.
 *  5) For each answer: recompute isCorrect = (selectedOption === "B"),
 *     clear placement/f1Points/pointsWon/fastestLap, gradedBy="auto".
 *  6) Set Round.status back to category_revealed so closeRound's guard
 *     (returns early if already graded) doesn't bail.
 *  7) Call closeRound(roundId) to re-score and re-finalize.
 *  8) Print after-state.
 *
 * Flags:
 *   --dry-run   : compute and print, write nothing.
 */
import { PrismaClient } from "@prisma/client";
import { closeRound } from "../src/lib/game-engine";
import { ROUND_STATUS } from "../src/lib/constants";

const prisma = new PrismaClient();

const LEAGUE_ID = "cmlri9ncp00009ksww08dnfk6";
const GAME_ID = "cmovzcy0c0001d11hpc353bfz";
const ROUND_ID = "cmovzcyou000nd11hwjlda8xg";
const QUESTION_ID = "cmp2y4h3d000111z3dx38d0bn";
const OLD_CORRECT = "D";
const NEW_CORRECT = "B";

const args = new Set(process.argv.slice(2));
const dryRun = args.has("--dry-run");

function fmtName(p: { fakeNickname: string | null; user: { nickname: string | null } | null }) {
  return p.fakeNickname || p.user?.nickname || "?";
}

async function printState(label: string) {
  console.log(`\n=== ${label} ===`);
  const round = await prisma.round.findUnique({
    where: { id: ROUND_ID },
    include: {
      question: true,
      flagReview: true,
      answers: {
        include: {
          leaguePlayer: { include: { user: { select: { nickname: true } } } },
        },
      },
      game: {
        include: {
          playerStates: {
            include: { leaguePlayer: { include: { user: { select: { nickname: true } } } } },
          },
        },
      },
    },
  });
  if (!round) {
    console.log("Round not found");
    return;
  }
  console.log(
    `Round status=${round.status} isCancelled=${round.isCancelled}  Question correctOption=${round.question?.correctOption}  Flag=${round.flagReview?.status ?? "none"}`
  );
  console.log("Answers:");
  for (const a of round.answers) {
    const who = fmtName(a.leaguePlayer);
    console.log(
      `  ${who.padEnd(15)} sel=${a.selectedOption ?? "-"} correct=${a.isCorrect} pts=${a.pointsWon} f1=${a.f1Points} place=${a.placement ?? "-"} fastest=${a.fastestLap} gradedBy=${a.gradedBy ?? "-"}`
    );
  }
  console.log("Game player states:");
  for (const ps of round.game.playerStates) {
    console.log(
      `  ${fmtName(ps.leaguePlayer).padEnd(15)} points=${ps.points} elim=${ps.isEliminated} f1=${ps.totalF1Points} bonus=${ps.bonusEarned}`
    );
  }
}

async function main() {
  console.log(`Bhutto Pilot G3R4 fix${dryRun ? " (DRY RUN)" : ""}`);
  await printState("BEFORE");

  // Sanity checks
  const round = await prisma.round.findUnique({
    where: { id: ROUND_ID },
    include: { question: true, flagReview: true, answers: true },
  });
  if (!round || !round.question) throw new Error("Round/question missing");
  if (round.question.id !== QUESTION_ID) throw new Error("Question id mismatch");
  if (round.question.correctOption !== OLD_CORRECT && round.question.correctOption !== NEW_CORRECT) {
    throw new Error(`Unexpected correctOption=${round.question.correctOption}`);
  }
  if (round.isCancelled) throw new Error("Round is cancelled — wrong path");

  // Recompute what isCorrect should be once we flip to B
  const newIsCorrect = new Map<string, boolean>();
  for (const a of round.answers) {
    newIsCorrect.set(a.id, a.selectedOption === NEW_CORRECT);
  }

  console.log("\nPlanned re-grading (selectedOption === 'B'):");
  for (const a of round.answers) {
    console.log(`  answer=${a.id.slice(-6)} sel=${a.selectedOption} -> correct=${newIsCorrect.get(a.id)}`);
  }

  if (dryRun) {
    console.log("\nDRY RUN — no writes. Exiting.");
    await prisma.$disconnect();
    return;
  }

  await prisma.$transaction(async (tx) => {
    // 1) Reverse points from GamePlayerState
    const states = await tx.gamePlayerState.findMany({ where: { gameId: GAME_ID } });
    const stateByPlayerId = new Map(states.map((s) => [s.leaguePlayerId, s]));

    for (const a of round.answers) {
      const ps = stateByPlayerId.get(a.leaguePlayerId);
      if (!ps) continue;
      if (a.pointsWon === 0) continue;
      const reversed = ps.points - a.pointsWon;
      await tx.gamePlayerState.update({
        where: { id: ps.id },
        data: {
          points: Math.max(0, reversed),
          // If they were eliminated by this round's loss, un-eliminate them
          isEliminated: reversed > 0 ? false : ps.isEliminated,
        },
      });
      // Reflect new value in our local map so later reads aren't stale
      stateByPlayerId.set(a.leaguePlayerId, {
        ...ps,
        points: Math.max(0, reversed),
        isEliminated: reversed > 0 ? false : ps.isEliminated,
      });
    }

    // 2) Flip the answer key
    await tx.question.update({
      where: { id: QUESTION_ID },
      data: { correctOption: NEW_CORRECT },
    });

    // 3) Re-grade each RoundAnswer and clear scoring (closeRound will repopulate)
    for (const a of round.answers) {
      await tx.roundAnswer.update({
        where: { id: a.id },
        data: {
          isCorrect: newIsCorrect.get(a.id) ?? false,
          gradedBy: "auto",
          placement: null,
          f1Points: 0,
          pointsWon: 0,
          fastestLap: false,
        },
      });
    }

    // 4) Resolve the flag review as agreed (commissioner override — keeps round alive)
    if (round.flagReview) {
      await tx.flagReview.update({
        where: { id: round.flagReview.id },
        data: { status: "agreed", resolvedAt: new Date() },
      });
    }

    // 5) Set status back so closeRound's "already graded" guard doesn't short-circuit
    await tx.round.update({
      where: { id: ROUND_ID },
      data: { status: ROUND_STATUS.CATEGORY_REVEALED },
    });
  });

  // 6) Re-run scoring/finalization
  await closeRound(ROUND_ID);

  await printState("AFTER");
  console.log("\nDone.");
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});

/**
 * Fix Bhutto Pilot / Game 3 / Round 5 — full regrade.
 *
 * Background: MC question "In the movie Step Brothers, Dale has a wildly unhinged
 * sleepwalking habit. During one of his midnight zombie strolls, he puts a very
 * unusual item in the oven. What is it?"
 *
 * Authored correctOption=A (Pillows — correct). The at-submit reviewer (Haiku 4.5)
 * hallucinated and flipped it to B (Bike helmet). Last night's first fix flipped
 * Question.correctOption back to A but the round had already closed and most
 * RoundAnswer rows were never re-graded — so the live state has Raul (picked B)
 * still marked correct with +10/P1/fastestLap, and 4 of the 5 A-pickers marked
 * incorrect with point penalties applied.
 *
 * Current state (verified via investigate-bhutto-pilot-g3r5.ts):
 *   Question.correctOption = "A"  (already flipped — good)
 *   Round.status = "graded"
 *   FlagReview = none
 *   Answers: Miho/A wrong, Zack Ali/A wrong, Yap/A wrong, Spokane Tim/A wrong,
 *            Raul/B correct (+10, P1, fastestLap), Zkhowes/A correct (+1, P2)
 *
 * Plan (mirrors fix-bhutto-pilot-g3r4.ts, minus the flag step):
 *  1) Print before-state.
 *  2) Reverse each RoundAnswer.pointsWon from GamePlayerState.points
 *     (clamp at 0, un-eliminate if reversed > 0).
 *  3) Re-grade each RoundAnswer: isCorrect = (selectedOption === "A"),
 *     clear placement/f1Points/pointsWon/fastestLap, gradedBy="auto".
 *  4) Demote Round.status to category_revealed so closeRound's
 *     already-graded guard doesn't short-circuit.
 *  5) Call closeRound(ROUND_ID, { force: true }) to re-score + finalize.
 *  6) Print after-state.
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
const ROUND_ID = "cmovzcyql000pd11hrft5ovrl";
const QUESTION_ID = "cmp5ktw1m0001utyiht1br191";
const CORRECT = "A";

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
  console.log(`Bhutto Pilot G3R5 regrade${dryRun ? " (DRY RUN)" : ""}`);
  await printState("BEFORE");

  const round = await prisma.round.findUnique({
    where: { id: ROUND_ID },
    include: { question: true, flagReview: true, answers: true },
  });
  if (!round || !round.question) throw new Error("Round/question missing");
  if (round.question.id !== QUESTION_ID) throw new Error("Question id mismatch");
  if (round.question.correctOption !== CORRECT) {
    throw new Error(
      `Expected question.correctOption=${CORRECT} (already flipped from last night's first fix); got ${round.question.correctOption}`
    );
  }
  if (round.isCancelled) throw new Error("Round is cancelled — wrong path");

  const newIsCorrect = new Map<string, boolean>();
  for (const a of round.answers) {
    newIsCorrect.set(a.id, a.selectedOption === CORRECT);
  }

  console.log(`\nPlanned re-grading (selectedOption === '${CORRECT}'):`);
  for (const a of round.answers) {
    console.log(
      `  answer=${a.id.slice(-6)} sel=${a.selectedOption} -> correct=${newIsCorrect.get(a.id)}  (was ${a.isCorrect})`
    );
  }

  if (dryRun) {
    console.log("\nDRY RUN — no writes. Exiting.");
    await prisma.$disconnect();
    return;
  }

  await prisma.$transaction(async (tx) => {
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
          isEliminated: reversed > 0 ? false : ps.isEliminated,
        },
      });
      stateByPlayerId.set(a.leaguePlayerId, {
        ...ps,
        points: Math.max(0, reversed),
        isEliminated: reversed > 0 ? false : ps.isEliminated,
      });
    }

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

    await tx.round.update({
      where: { id: ROUND_ID },
      data: { status: ROUND_STATUS.CATEGORY_REVEALED },
    });
  });

  await closeRound(ROUND_ID, { force: true });

  await printState("AFTER");
  console.log("\nDone.");
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});

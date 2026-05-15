/**
 * Fix Bhutto Pilot / Game 3 / Round 5.
 *
 * Background: MC question "In the movie Step Brothers, Dale has a wildly
 * unhinged sleepwalking habit. During one of his midnight zombie strolls,
 * he puts a very unusual item in the oven. What is it?"
 *
 * LOS authored with correctOption=A (Pillows — correct). The at-submit reviewer
 * (Haiku 4.5) hallucinated and flipped it to B (Bike helmet). Caught BEFORE
 * the round closed, so no scoring exists yet — the fix is just flipping the
 * answer key back to A. No flag, no closeRound, no score reversal needed.
 *
 * Flags:
 *   --dry-run   : compute and print, write nothing.
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const QUESTION_ID = "cmp5ktw1m0001utyiht1br191";
const ROUND_ID = "cmovzcyql000pd11hrft5ovrl";
const OLD_CORRECT = "B";
const NEW_CORRECT = "A";

const args = new Set(process.argv.slice(2));
const dryRun = args.has("--dry-run");

async function main() {
  console.log(`Bhutto Pilot G3R5 fix${dryRun ? " (DRY RUN)" : ""}`);

  const q = await prisma.question.findUnique({
    where: { id: QUESTION_ID },
    include: { round: { select: { id: true, status: true, isCancelled: true, number: true } } },
  });
  if (!q) throw new Error("Question not found");
  if (q.round?.id !== ROUND_ID) throw new Error("Round id mismatch");
  if (q.round.isCancelled) throw new Error("Round is cancelled");
  if (q.correctOption !== OLD_CORRECT && q.correctOption !== NEW_CORRECT) {
    throw new Error(`Unexpected correctOption=${q.correctOption}`);
  }
  if (q.optionA?.toLowerCase() !== "pillows") {
    throw new Error(`Unexpected optionA=${q.optionA}`);
  }
  if (q.round.status === "graded") {
    throw new Error("Round already graded — use the regrade flow instead");
  }

  console.log(`Before: correctOption=${q.correctOption}`);
  console.log(`  A: ${q.optionA}`);
  console.log(`  B: ${q.optionB}`);
  console.log(`  C: ${q.optionC}`);
  console.log(`  D: ${q.optionD}`);
  console.log(`Round status=${q.round.status} (not yet graded — flip is safe)`);

  if (dryRun) {
    console.log("\nDRY RUN — would update correctOption B -> A. Exiting.");
    return;
  }

  await prisma.question.update({
    where: { id: QUESTION_ID },
    data: { correctOption: NEW_CORRECT },
  });

  const after = await prisma.question.findUnique({
    where: { id: QUESTION_ID },
    select: { correctOption: true },
  });
  console.log(`\nAfter: correctOption=${after?.correctOption}`);
  console.log("Done. Round will grade correctly when answers complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

// Forensic fix: Trivia Titans S1G2R1 (test league) — reviewer caught a
// blatantly wrong answer key ("What system of government values free
// markets" had correctOption=C/Communism; reviewer proposed A/Capitalism
// at confidence 0.99). Round was sitting at question_submitted with zero
// answers, waiting on the at-bat fake player (Lightning McQuiz) to accept
// or reject the proposal via the ReviewProposalBanner. In test mode the
// at-bat is a bot, so the round would hang forever.
//
// Fix: programmatically apply the same logic as POST
// /api/questions/[id]/review-decision with decision="accepted":
//   - Replace question fields with the proposal payload
//   - Clear pendingReview* fields, set reviewDecision="accepted"
//   - Log a QuestionReviewLog row marking the manual acceptance
//
// No regrade is needed — there are zero RoundAnswer rows, no scoring to
// reverse, the round just continues at question_submitted.

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const QUESTION_ID = "cmp6ewnhr0001vgm5k8wpqntj";
const ROUND_ID = "cmokygs4f0009r6dtsqo2g0zb";
const EXPECTED_OLD_CORRECT = "C";
const EXPECTED_NEW_CORRECT = "A";

const DRY_RUN = process.argv.includes("--dry-run");

async function main() {
  const before = await prisma.question.findUnique({
    where: { id: QUESTION_ID },
    include: {
      round: { include: { answers: true } },
    },
  });
  if (!before) throw new Error(`Question ${QUESTION_ID} not found`);
  if (!before.round) throw new Error(`Question ${QUESTION_ID} has no round`);
  if (before.round.id !== ROUND_ID) {
    throw new Error(`Round mismatch: expected ${ROUND_ID}, got ${before.round.id}`);
  }
  if (before.round.answers.length !== 0) {
    throw new Error(`Refusing to run — round has ${before.round.answers.length} answers, expected 0 (no regrade path here)`);
  }
  if (before.correctOption !== EXPECTED_OLD_CORRECT) {
    throw new Error(`Expected correctOption=${EXPECTED_OLD_CORRECT}, got ${before.correctOption}`);
  }
  if (!before.pendingReviewProposal) {
    throw new Error(`Question has no pendingReviewProposal — already decided?`);
  }
  if (before.reviewDecision !== null) {
    throw new Error(`Question already has reviewDecision=${before.reviewDecision}`);
  }

  const proposal = JSON.parse(before.pendingReviewProposal) as {
    correctOption?: string | null;
    optionA?: string | null;
    optionB?: string | null;
    optionC?: string | null;
    optionD?: string | null;
  };
  if (proposal.correctOption !== EXPECTED_NEW_CORRECT) {
    throw new Error(`Proposal says correctOption=${proposal.correctOption}, expected ${EXPECTED_NEW_CORRECT}`);
  }

  console.log("=== BEFORE ===");
  console.log(`  correctOption: ${before.correctOption}`);
  console.log(`  reviewDecision: ${before.reviewDecision}`);
  console.log(`  pendingReviewProposal: ${before.pendingReviewProposal}`);
  console.log(`  pendingReviewConfidence: ${before.pendingReviewConfidence}`);
  console.log(`  round status: ${before.round.status}`);
  console.log(`  round answers: ${before.round.answers.length}`);
  console.log("");
  console.log("=== PROPOSED ===");
  console.log(`  correctOption: ${proposal.correctOption}`);
  console.log("");

  if (DRY_RUN) {
    console.log("--dry-run: not committing.");
    await prisma.$disconnect();
    return;
  }

  await prisma.$transaction(async (tx) => {
    await tx.question.update({
      where: { id: QUESTION_ID },
      data: {
        // Apply the proposal payload (only correctOption changes here, but
        // mirror the full mc payload for parity with the API endpoint).
        optionA: proposal.optionA ?? before.optionA,
        optionB: proposal.optionB ?? before.optionB,
        optionC: proposal.optionC ?? before.optionC,
        optionD: proposal.optionD ?? before.optionD,
        correctOption: proposal.correctOption,
        // Clear pending review state, mark decision.
        pendingReviewProposal: null,
        pendingReviewNotes: null,
        pendingReviewConfidence: null,
        pendingReviewLogId: null,
        reviewDecision: "accepted",
        reviewDecidedAt: new Date(),
      },
    });

    // Forensic audit log — distinct modelUsed value so the admin Reviewer
    // tab can identify this as a script-driven acceptance (test-mode unblock).
    await tx.questionReviewLog.create({
      data: {
        questionId: QUESTION_ID,
        format: before.answerFormat,
        category: before.category,
        questionText: before.questionText,
        beforeJson: JSON.stringify({
          correctOption: before.correctOption,
          optionA: before.optionA,
          optionB: before.optionB,
          optionC: before.optionC,
          optionD: before.optionD,
        }),
        afterJson: JSON.stringify({
          correctOption: proposal.correctOption,
          optionA: proposal.optionA ?? before.optionA,
          optionB: proposal.optionB ?? before.optionB,
          optionC: proposal.optionC ?? before.optionC,
          optionD: proposal.optionD ?? before.optionD,
        }),
        proposedJson: before.pendingReviewProposal,
        proposedChange: true,
        confidence: before.pendingReviewConfidence,
        changed: true,
        notes: `Manual acceptance via fix-trivia-titans-g2r1.ts (test-mode fake at-bat could not accept via UI). Original reviewer rationale: ${before.pendingReviewNotes ?? "(none)"}`,
        modelUsed: "commissioner-script-accept",
        status: "ok",
        latencyMs: 0,
      },
    });
  });

  const after = await prisma.question.findUnique({
    where: { id: QUESTION_ID },
    include: { round: true },
  });
  console.log("=== AFTER ===");
  console.log(`  correctOption: ${after?.correctOption}`);
  console.log(`  reviewDecision: ${after?.reviewDecision}`);
  console.log(`  reviewDecidedAt: ${after?.reviewDecidedAt?.toISOString()}`);
  console.log(`  pendingReviewProposal: ${after?.pendingReviewProposal}`);
  console.log(`  round status: ${after?.round?.status}`);
  console.log("");
  console.log("Done. Round can now advance (next play: bets + answers).");

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

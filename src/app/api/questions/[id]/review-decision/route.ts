import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ROUND_STATUS } from "@/lib/constants";

/**
 * Submitter decides on a pending reviewer correction.
 *
 * Body: { decision: "accepted" | "rejected" }
 *
 * Only the question's creatorUserId may decide. Only allowed while the round
 * is in question_submitted or category_revealed (i.e. before grading). After
 * grading, the answer key is locked — submitter should use the commissioner
 * fix-and-regrade flow (admin-only).
 *
 * On "accepted": rewrite the answer-key fields from the stashed proposal,
 * clear the pending fields, stamp the decision, and update the forensic
 * QuestionReviewLog row to reflect that the change was actually applied.
 *
 * On "rejected": clear the pending fields and stamp the decision. The
 * forensic log already captured the proposal (proposedChange=true,
 * changed=false) so no log update is needed.
 */

interface DecisionBody {
  decision?: "accepted" | "rejected";
}

interface ReviewablePayload {
  category?: string;
  questionText?: string;
  answerFormat?: string;
  optionA?: string;
  optionB?: string;
  optionC?: string;
  optionD?: string;
  correctOption?: string;
  correctAnswer?: string;
  correctAnswerUnit?: string;
  acceptableAnswers?: string[];
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json()) as DecisionBody;
  if (body.decision !== "accepted" && body.decision !== "rejected") {
    return NextResponse.json({ error: "decision must be 'accepted' or 'rejected'" }, { status: 400 });
  }

  const question = await prisma.question.findUnique({
    where: { id: params.id },
    include: { round: { select: { id: true, status: true, isCancelled: true } } },
  });
  if (!question) {
    return NextResponse.json({ error: "Question not found" }, { status: 404 });
  }
  if (question.creatorUserId !== session.user.id) {
    return NextResponse.json({ error: "Only the question submitter can decide" }, { status: 403 });
  }
  if (!question.pendingReviewProposal || question.reviewDecision) {
    return NextResponse.json({ error: "No pending reviewer proposal to decide on" }, { status: 409 });
  }
  if (question.round?.isCancelled) {
    return NextResponse.json({ error: "Round is cancelled" }, { status: 409 });
  }
  const allowedStatuses = [ROUND_STATUS.QUESTION_SUBMITTED, ROUND_STATUS.CATEGORY_REVEALED];
  if (question.round && !allowedStatuses.includes(question.round.status as typeof allowedStatuses[number])) {
    return NextResponse.json(
      {
        error: "Round has already been graded. Use the commissioner fix-and-regrade flow to change the answer key now.",
      },
      { status: 409 }
    );
  }

  const proposalJson: string = question.pendingReviewProposal; // narrowed by the !pendingReviewProposal check above
  const proposed = JSON.parse(proposalJson) as ReviewablePayload;
  const now = new Date();

  if (body.decision === "accepted") {
    await prisma.$transaction(async (tx) => {
      // Apply the answer-key fields from the proposal. Only update fields the
      // reviewer can change — text/options/correctOption for MC, correctAnswer
      // / acceptableAnswers / correctAnswerUnit for free-text and closest-guess.
      await tx.question.update({
        where: { id: question.id },
        data: {
          correctOption: proposed.correctOption ?? question.correctOption,
          correctAnswer: proposed.correctAnswer ?? question.correctAnswer,
          correctAnswerUnit: proposed.correctAnswerUnit ?? question.correctAnswerUnit,
          acceptableAnswers: proposed.acceptableAnswers
            ? JSON.stringify(proposed.acceptableAnswers)
            : question.acceptableAnswers,
          pendingReviewProposal: null,
          pendingReviewNotes: null,
          pendingReviewConfidence: null,
          pendingReviewLogId: null,
          reviewDecision: "accepted",
          reviewDecidedAt: now,
        },
      });

      // Update the forensic log so the admin Reviewer tab shows that the
      // correction was ultimately applied (after the submitter's approval).
      if (question.pendingReviewLogId) {
        await tx.questionReviewLog.update({
          where: { id: question.pendingReviewLogId },
          data: {
            changed: true,
            afterJson: proposalJson,
            notes: question.pendingReviewNotes
              ? `[submitter-accepted ${now.toISOString()}] ${question.pendingReviewNotes}`.slice(0, 240)
              : "[submitter-accepted]",
          },
        });
      }
    });
  } else {
    // rejected
    await prisma.$transaction(async (tx) => {
      await tx.question.update({
        where: { id: question.id },
        data: {
          pendingReviewProposal: null,
          pendingReviewNotes: null,
          pendingReviewConfidence: null,
          pendingReviewLogId: null,
          reviewDecision: "rejected",
          reviewDecidedAt: now,
        },
      });
      if (question.pendingReviewLogId) {
        await tx.questionReviewLog.update({
          where: { id: question.pendingReviewLogId },
          data: {
            notes: question.pendingReviewNotes
              ? `[submitter-rejected ${now.toISOString()}] ${question.pendingReviewNotes}`.slice(0, 240)
              : "[submitter-rejected]",
          },
        });
      }
    });
  }

  return NextResponse.json({ ok: true, decision: body.decision });
}

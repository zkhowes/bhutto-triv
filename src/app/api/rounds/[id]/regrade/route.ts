import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  closeRound,
  reverseRoundScoring,
} from "@/lib/game-engine";
import { gradeAnswer as aiGrade } from "@/lib/ai";
import {
  determinePirWinners,
  determineOrderingWinners,
  deriveCanonicalOrder,
  projectRegrade,
  type ProjectionAnswerInput,
} from "@/lib/scoring";
import { ROUND_STATUS } from "@/lib/constants";
import { createNotification } from "@/lib/notifications";

interface QuestionPatch {
  correctOption?: string | null;
  correctAnswer?: string | null;
  acceptableAnswers?: string | null;
  correctAnswerUnit?: string | null;
  orderingCorrectOrder?: string | null;
  orderingItemValues?: string | null;
  orderingDirection?: string | null;
}

interface RegradeBody {
  question: QuestionPatch;
  reason: string;
  preview?: boolean;
  notifySms?: boolean;
  resolveFlag?: "agreed" | "disagreed" | "leave";
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json()) as RegradeBody;
  const roundId = params.id;

  if (!body || typeof body.reason !== "string" || body.reason.trim().length === 0) {
    return NextResponse.json({ error: "Reason is required" }, { status: 400 });
  }
  if (body.reason.length > 500) {
    return NextResponse.json({ error: "Reason must be under 500 characters" }, { status: 400 });
  }

  const round = await prisma.round.findUnique({
    where: { id: roundId },
    include: {
      question: true,
      flagReview: true,
      answers: {
        include: {
          leaguePlayer: { include: { user: { select: { nickname: true, phoneNumber: true } } } },
        },
      },
      game: {
        include: {
          playerStates: {
            include: { leaguePlayer: { include: { user: { select: { nickname: true } } } } },
          },
          season: {
            include: {
              league: {
                include: {
                  players: {
                    where: { userId: session.user.id, isActive: true },
                  },
                },
              },
            },
          },
        },
      },
    },
  });

  if (!round || !round.question) {
    return NextResponse.json({ error: "Round not found" }, { status: 404 });
  }

  // AuthN/Z: commissioner of this league only.
  const myPlayer = round.game.season.league.players[0];
  const isCommissioner = myPlayer?.role === "commissioner";
  const isTestMode = round.game.season.league.type === "test";
  if (!isCommissioner && !isTestMode) {
    return NextResponse.json({ error: "Only commissioners can regrade" }, { status: 403 });
  }

  if (round.isCancelled) {
    return NextResponse.json({ error: "Round is cancelled — cannot regrade" }, { status: 400 });
  }

  const format = round.question.answerFormat;
  const patch = body.question || {};

  // Validate the patch shape per format.
  if (format === "multiple_choice") {
    if (!patch.correctOption || !["A", "B", "C", "D"].includes(patch.correctOption)) {
      return NextResponse.json({ error: "correctOption must be A, B, C, or D" }, { status: 400 });
    }
  } else if (format === "free_text") {
    if (typeof patch.correctAnswer !== "string" || patch.correctAnswer.trim().length === 0) {
      return NextResponse.json({ error: "correctAnswer is required" }, { status: 400 });
    }
  } else if (format === "price_is_right") {
    if (typeof patch.correctAnswer !== "string" || isNaN(parseFloat(patch.correctAnswer))) {
      return NextResponse.json({ error: "correctAnswer must be a number" }, { status: 400 });
    }
  } else if (format === "ordering") {
    // Item-array edits are out of scope for the in-app fix — they require a basis remap.
    if (!patch.orderingCorrectOrder && !patch.orderingItemValues && !patch.orderingDirection) {
      return NextResponse.json(
        { error: "Provide at least one of orderingCorrectOrder, orderingItemValues, orderingDirection" },
        { status: 400 }
      );
    }
  } else {
    return NextResponse.json({ error: `Unsupported format: ${format}` }, { status: 400 });
  }

  // Compute each answer's new isCorrect under the proposed key.
  const newIsCorrectByAnswerId = new Map<string, boolean>();

  if (format === "multiple_choice") {
    const newCorrect = patch.correctOption!;
    for (const a of round.answers) {
      newIsCorrectByAnswerId.set(a.id, !a.isAbsent && a.selectedOption === newCorrect);
    }
  } else if (format === "price_is_right") {
    const target = parseFloat(patch.correctAnswer!);
    const guesses = round.answers
      .filter((a) => !a.isAbsent && a.freeTextAnswer)
      .map((a) => ({ id: a.id, value: parseFloat(a.freeTextAnswer!) }))
      .filter((g) => !isNaN(g.value));
    const winners = determinePirWinners(target, guesses);
    for (const a of round.answers) {
      newIsCorrectByAnswerId.set(a.id, !a.isAbsent && winners.has(a.id));
    }
  } else if (format === "ordering") {
    const itemValues = patch.orderingItemValues
      ? (JSON.parse(patch.orderingItemValues) as Array<string | number | null>)
      : round.question.orderingItemValues
        ? (JSON.parse(round.question.orderingItemValues) as Array<string | number | null>)
        : null;
    const direction = patch.orderingDirection ?? round.question.orderingDirection;
    const storedCorrectOrder = patch.orderingCorrectOrder
      ? (JSON.parse(patch.orderingCorrectOrder) as number[])
      : round.question.orderingCorrectOrder
        ? (JSON.parse(round.question.orderingCorrectOrder) as number[])
        : [];
    const derived = deriveCanonicalOrder(itemValues, direction);
    const correctOrder = derived ?? storedCorrectOrder;
    const submissions = round.answers
      .filter((a) => !a.isAbsent && a.freeTextAnswer)
      .map((a) => ({ id: a.id, playerOrder: JSON.parse(a.freeTextAnswer!) as number[] }));
    const { winners } = determineOrderingWinners(correctOrder, submissions, itemValues);
    for (const a of round.answers) {
      newIsCorrectByAnswerId.set(a.id, !a.isAbsent && winners.has(a.id));
    }
  } else if (format === "free_text") {
    if (body.preview) {
      // Preview mode: skip AI to save credits + latency. Caller is warned client-side.
      for (const a of round.answers) {
        newIsCorrectByAnswerId.set(a.id, a.isCorrect ?? false);
      }
    } else {
      const newCorrect = patch.correctAnswer!;
      const acceptable = patch.acceptableAnswers
        ? (JSON.parse(patch.acceptableAnswers) as string[])
        : [];
      for (const a of round.answers) {
        if (a.isAbsent || !a.freeTextAnswer) {
          newIsCorrectByAnswerId.set(a.id, false);
          continue;
        }
        try {
          const result = await aiGrade(round.question.questionText, newCorrect, acceptable, a.freeTextAnswer);
          newIsCorrectByAnswerId.set(a.id, result.isCorrect);
        } catch {
          // Fall back to keeping the current grade if AI fails on this answer.
          newIsCorrectByAnswerId.set(a.id, a.isCorrect ?? false);
        }
      }
    }
  }

  // Build the projection input.
  const projAnswers: ProjectionAnswerInput[] = round.answers.map((a) => ({
    id: a.id,
    leaguePlayerId: a.leaguePlayerId,
    nickname: a.leaguePlayer.fakeNickname || a.leaguePlayer.user.nickname || "?",
    selectedOption: a.selectedOption,
    freeTextAnswer: a.freeTextAnswer,
    betAmount: a.betAmount || 0,
    answeredAt: a.answeredAt,
    isAbsent: a.isAbsent,
    isBlindBet: a.isBlindBet,
    isCorrect: a.isCorrect,
    pointsWon: a.pointsWon,
    f1Points: a.f1Points,
    placement: a.placement,
    fastestLap: a.fastestLap,
    newIsCorrect: newIsCorrectByAnswerId.get(a.id) ?? false,
  }));

  const projection = projectRegrade({
    answers: projAnswers,
    playerStates: round.game.playerStates.map((ps) => ({
      leaguePlayerId: ps.leaguePlayerId,
      nickname: ps.leaguePlayer.fakeNickname || ps.leaguePlayer.user.nickname || "?",
      currentPoints: ps.points,
      isEliminated: ps.isEliminated,
    })),
  });

  // Preview mode: don't write anything.
  if (body.preview) {
    return NextResponse.json({
      preview: true,
      format,
      previewNote:
        format === "free_text"
          ? "Free-text preview uses current isCorrect values. AI grading will re-run on commit and may change the result."
          : null,
      projection,
    });
  }

  // ─── Commit ──────────────────────────────────────────────────────────────
  const beforeJson = JSON.stringify({
    correctOption: round.question.correctOption,
    correctAnswer: round.question.correctAnswer,
    acceptableAnswers: round.question.acceptableAnswers,
    correctAnswerUnit: round.question.correctAnswerUnit,
    orderingCorrectOrder: round.question.orderingCorrectOrder,
    orderingItemValues: round.question.orderingItemValues,
    orderingDirection: round.question.orderingDirection,
  });

  // 1. Reverse current scoring on GamePlayerState.
  await reverseRoundScoring(roundId);

  // 2. Persist the new question key + flag resolution + answer overrides in a txn.
  const afterJsonPayload = {
    correctOption: round.question.correctOption,
    correctAnswer: round.question.correctAnswer,
    acceptableAnswers: round.question.acceptableAnswers,
    correctAnswerUnit: round.question.correctAnswerUnit,
    orderingCorrectOrder: round.question.orderingCorrectOrder,
    orderingItemValues: round.question.orderingItemValues,
    orderingDirection: round.question.orderingDirection,
  };

  await prisma.$transaction(async (tx) => {
    const questionUpdate: Record<string, unknown> = {};
    if (format === "multiple_choice") {
      questionUpdate.correctOption = patch.correctOption;
      afterJsonPayload.correctOption = patch.correctOption ?? null;
    } else if (format === "free_text") {
      questionUpdate.correctAnswer = patch.correctAnswer;
      afterJsonPayload.correctAnswer = patch.correctAnswer ?? null;
      if (typeof patch.acceptableAnswers === "string") {
        questionUpdate.acceptableAnswers = patch.acceptableAnswers;
        afterJsonPayload.acceptableAnswers = patch.acceptableAnswers;
      }
    } else if (format === "price_is_right") {
      questionUpdate.correctAnswer = patch.correctAnswer;
      afterJsonPayload.correctAnswer = patch.correctAnswer ?? null;
      if (typeof patch.correctAnswerUnit === "string") {
        questionUpdate.correctAnswerUnit = patch.correctAnswerUnit;
        afterJsonPayload.correctAnswerUnit = patch.correctAnswerUnit;
      }
    } else if (format === "ordering") {
      if (typeof patch.orderingCorrectOrder === "string") {
        questionUpdate.orderingCorrectOrder = patch.orderingCorrectOrder;
        afterJsonPayload.orderingCorrectOrder = patch.orderingCorrectOrder;
      }
      if (typeof patch.orderingItemValues === "string") {
        questionUpdate.orderingItemValues = patch.orderingItemValues;
        afterJsonPayload.orderingItemValues = patch.orderingItemValues;
      }
      if (typeof patch.orderingDirection === "string") {
        questionUpdate.orderingDirection = patch.orderingDirection;
        afterJsonPayload.orderingDirection = patch.orderingDirection;
      }
    }
    await tx.question.update({
      where: { id: round.question!.id },
      data: questionUpdate,
    });

    // Clear scoring on each answer and persist the recomputed isCorrect so
    // closeRound's MC path (which only re-evaluates inside scoreRound) sees
    // the right values. closeRound's PIR / ordering paths already re-grade
    // from the question fields.
    for (const a of round.answers) {
      await tx.roundAnswer.update({
        where: { id: a.id },
        data: {
          isCorrect: newIsCorrectByAnswerId.get(a.id) ?? false,
          gradedBy: "auto",
          placement: null,
          f1Points: 0,
          pointsWon: 0,
          fastestLap: false,
        },
      });
    }

    // Resolve the flag if one exists. Default = agreed (the answer key was wrong).
    if (round.flagReview) {
      const resolveTo = body.resolveFlag ?? "agreed";
      if (resolveTo !== "leave") {
        await tx.flagReview.update({
          where: { id: round.flagReview.id },
          data: { status: resolveTo, resolvedAt: new Date() },
        });
      }
    }

    // Status back to category_revealed so closeRound's `graded`-guard lets it through.
    await tx.round.update({
      where: { id: roundId },
      data: { status: ROUND_STATUS.CATEGORY_REVEALED },
    });

    // Forensic log — reuse the QuestionReviewLog model.
    await tx.questionReviewLog.create({
      data: {
        questionId: round.question!.id,
        format,
        category: round.question!.category,
        questionText: round.question!.questionText,
        beforeJson,
        afterJson: JSON.stringify(afterJsonPayload),
        changed: true,
        notes: `Commissioner regrade by ${session.user.id}: ${body.reason.trim()}`,
        modelUsed: "commissioner-regrade",
        status: "ok",
        latencyMs: 0,
      },
    });
  });

  // 3. Re-run closeRound with force:true, suppressing its default "round results"
  //    notification so we can send our own contextual one instead.
  await closeRound(roundId, { force: true, suppressNotify: true });

  // 4. Send a contextual regrade notification (in-app always, SMS opt-in via body).
  const leagueId = round.game.season.league.id;
  const gameId = round.game.id;
  const notifySms = body.notifySms !== false;
  const players = await prisma.leaguePlayer.findMany({
    where: { leagueId, isActive: true, isPaused: false, isFake: false },
    include: { user: { select: { id: true, phoneNumber: true } } },
  });
  const title = `Round ${round.number} regraded`;
  const message = `Commissioner corrected the answer key. ${body.reason.trim()}`;
  await Promise.all(
    players.map((p) =>
      createNotification({
        userId: p.userId,
        leagueId,
        gameId,
        roundId,
        type: "round_results",
        title,
        message,
        destinationUrl: `/games/${gameId}`,
        phoneNumber: notifySms ? p.user.phoneNumber ?? undefined : undefined,
      }).catch((err) => console.error("Regrade notify failed:", err))
    )
  );

  return NextResponse.json({ success: true, projection });
}

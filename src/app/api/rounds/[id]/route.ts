import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);

  const round = await prisma.round.findUnique({
    where: { id: params.id },
    include: {
      question: true,
      answers: {
        include: {
          leaguePlayer: {
            include: {
              user: {
                select: {
                  id: true,
                  nickname: true,
                  avatarUrl: true,
                  image: true,
                },
              },
            },
          },
        },
      },
      game: {
        include: {
          season: {
            include: {
              league: {
                select: {
                  id: true,
                  name: true,
                  type: true,
                  dailyDeadline: true,
                  deadlineTimezone: true,
                  answerTimerSeconds: true,
                },
              },
            },
          },
          playerStates: {
            include: {
              leaguePlayer: {
                include: {
                  user: {
                    select: {
                      id: true,
                      nickname: true,
                      avatarUrl: true,
                      image: true,
                    },
                  },
                },
              },
            },
          },
          battingOrder: {
            orderBy: { position: "asc" },
            include: {
              leaguePlayer: {
                include: {
                  user: {
                    select: {
                      id: true,
                      nickname: true,
                      avatarUrl: true,
                      image: true,
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  });

  if (!round) {
    return NextResponse.json({ error: "Round not found" }, { status: 404 });
  }

  // Require league membership to view round data
  const leagueId = round.game.season.league.id;
  if (session?.user?.id) {
    const membership = await prisma.leaguePlayer.findFirst({
      where: { leagueId, userId: session.user.id, isActive: true },
      select: { id: true },
    });
    if (!membership && !session.user.isSuperAdmin) {
      return NextResponse.json({ error: "Not a member of this league" }, { status: 403 });
    }
  } else {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // If round is not yet graded, hide some answer details for non-graded rounds
  const isGraded = round.status === "graded" || round.status === "under_review";
  const userId = session?.user?.id;

  // Support test mode actAs parameter for correct player identification
  const url = new URL(_req.url);
  const actAsPlayerId = url.searchParams.get("actAs");

  const processedAnswers = round.answers.map((answer) => {
    const isMyAnswer = actAsPlayerId
      ? answer.leaguePlayerId === actAsPlayerId
      : answer.userId === userId;

    // After grading, show everything
    if (isGraded) {
      return {
        ...answer,
        question: undefined,
      };
    }

    // Before grading:
    // - Show own answers fully
    // - Show others' bet amounts and status (bet placed, answered, etc.)
    // - Don't reveal correctness or specific answers
    if (isMyAnswer) {
      return answer;
    }

    return {
      id: answer.id,
      roundId: answer.roundId,
      leaguePlayerId: answer.leaguePlayerId,
      userId: answer.userId,
      betAmount: answer.betAmount,
      betPlacedAt: answer.betPlacedAt,
      answeredAt: answer.answeredAt,
      isAbsent: answer.isAbsent,
      isBlindBet: answer.isBlindBet,
      // Hide these until graded
      selectedOption: null,
      freeTextAnswer: null,
      isCorrect: null,
      gradedBy: null,
      pointsWon: 0,
      f1Points: 0,
      placement: null,
      fastestLap: false,
      powerUpType: null,
      powerUpCost: 0,
      powerUpData: null,
      cheatSeekerData: null,
      questionRating: null,
      leaguePlayer: answer.leaguePlayer,
    };
  });

  // Hide question text until player has bet (for non-graded rounds)
  let questionData = round.question;
  if (questionData && !isGraded && userId) {
    const myAnswer = actAsPlayerId
      ? round.answers.find((a) => a.leaguePlayerId === actAsPlayerId)
      : round.answers.find((a) => a.userId === userId);
    // Busted players bypass the bet gate once the category is revealed —
    // they're on the answer-only path, so they need to see the question.
    const myLeaguePlayerId = actAsPlayerId
      ?? round.game.playerStates.find((ps) => ps.leaguePlayer.user.id === userId)?.leaguePlayerId
      ?? null;
    const myPlayerState = myLeaguePlayerId
      ? round.game.playerStates.find((ps) => ps.leaguePlayerId === myLeaguePlayerId)
      : null;
    // Busted players bypass the bet gate as soon as a question exists — no
    // bet to place, so the bet-screen placeholder would just block them from
    // answering. question_submitted and category_revealed both qualify.
    const isBustedAnswerPhase =
      !!myPlayerState?.isEliminated &&
      (round.status === "question_submitted" || round.status === "category_revealed");
    if (!myAnswer?.betPlacedAt && !isBustedAnswerPhase) {
      // Player hasn't bet yet, only show category + answerFormat (safe to reveal format)
      questionData = {
        ...questionData,
        questionText: "[Place your bet to see the question]",
        optionA: null,
        optionB: null,
        optionC: null,
        optionD: null,
        correctOption: null,
        correctAnswer: null,
        acceptableAnswers: null,
        imageUrl: null,
        imageSource: null,
        imageAttribution: null,
        orderingItems: null,
        orderingCorrectOrder: null,
        orderingDirection: null,
        orderingItemValues: null,
      };
    } else {
      // Player has bet, show question but hide correct answer/order
      questionData = {
        ...questionData,
        correctOption: null,
        correctAnswer: null,
        acceptableAnswers: null,
        orderingCorrectOrder: null,
        orderingItemValues: null,
      };
    }
  }

  // Compute at-bat player's historical avg question rating + success rate (cross-league via userId)
  // Only compute during betting phases when this info is shown to players
  const isBettingPhase = round.status === "question_submitted" || round.status === "category_revealed";
  let atBatAvgRating: number | null = null;
  let atBatRatingCount = 0;
  let atBatSuccessRate: number | null = null;
  if (isBettingPhase && round.atBatPlayerId) {
    // Look up the at-bat player's userId to aggregate cross-league
    const atBatPlayer = await prisma.leaguePlayer.findUnique({
      where: { id: round.atBatPlayerId },
      select: { userId: true },
    });
    if (atBatPlayer) {
      // Find all LeaguePlayer IDs for this user across all leagues
      const allPlayerIds = await prisma.leaguePlayer.findMany({
        where: { userId: atBatPlayer.userId },
        select: { id: true },
      });
      const playerIds = allPlayerIds.map((p) => p.id);
      const ratingAgg = await prisma.round.aggregate({
        where: {
          status: "graded",
          questionComposite: { not: null },
          atBatPlayerId: { in: playerIds },
        },
        _avg: { questionComposite: true },
        _count: { questionComposite: true },
      });
      atBatRatingCount = ratingAgg._count.questionComposite;
      if (atBatRatingCount >= 1) {
        atBatAvgRating = ratingAgg._avg.questionComposite;
      }

      // Compute success rate: % of non-absent answers to this player's questions that were correct
      const answerStats = await prisma.roundAnswer.aggregate({
        where: {
          round: {
            status: "graded",
            atBatPlayerId: { in: playerIds },
          },
          leaguePlayerId: { notIn: playerIds }, // exclude at-bat player's own answers
          isAbsent: false,
          isCorrect: { not: null },
        },
        _count: { isCorrect: true },
      });
      const correctCount = await prisma.roundAnswer.count({
        where: {
          round: {
            status: "graded",
            atBatPlayerId: { in: playerIds },
          },
          leaguePlayerId: { notIn: playerIds },
          isAbsent: false,
          isCorrect: true,
        },
      });
      if (answerStats._count.isCorrect > 0) {
        atBatSuccessRate = correctCount / answerStats._count.isCorrect;
      }
    }
  }

  // Compute question quality score for graded rounds
  let questionScore: { avgRating: number | null; successRate: number | null; composite: number | null } | null = null;
  if (round.status === "graded" || round.status === "under_review") {
    const { computeQuestionComposite } = await import("@/lib/scoring");
    const nonAtBatAnswers = round.answers.filter(
      (a) => a.leaguePlayerId !== round.atBatPlayerId && !a.isAbsent
    );
    const ratings = nonAtBatAnswers
      .map((a) => a.questionRating)
      .filter((r): r is number => r !== null);
    const avgRating = ratings.length > 0
      ? ratings.reduce((s, r) => s + r, 0) / ratings.length
      : null;
    const correctCount = nonAtBatAnswers.filter((a) => a.isCorrect).length;
    const successRate = nonAtBatAnswers.length > 0
      ? correctCount / nonAtBatAnswers.length
      : null;
    const composite = computeQuestionComposite(
      avgRating,
      round.question?.answerFormat || "free_text",
      nonAtBatAnswers.map((a) => ({
        isCorrect: a.isCorrect,
        freeTextAnswer: a.freeTextAnswer,
      })),
      round.question?.correctAnswer || null
    );
    questionScore = { avgRating, successRate, composite };
  }

  // Flag data: check if this round has a flag review and if current player can flag
  const flagReview = await prisma.flagReview.findUnique({
    where: { roundId: round.id },
    select: { id: true, status: true, flaggedById: true, objection: true },
  });

  // Check if current player's flag is used (for showing/hiding flag button)
  const currentPlayerId = actAsPlayerId || round.game.playerStates.find(
    (ps) => ps.leaguePlayer.user.id === userId
  )?.leaguePlayerId;
  const currentPlayerState = currentPlayerId
    ? round.game.playerStates.find((ps) => ps.leaguePlayerId === currentPlayerId)
    : null;

  // Check if a later round is already graded (flag window closed)
  const laterGradedRound = await prisma.round.findFirst({
    where: {
      gameId: round.gameId,
      number: { gt: round.number },
      isCancelled: false,
      status: "graded",
    },
  });

  return NextResponse.json({
    ...round,
    question: questionData,
    answers: processedAnswers,
    atBatAvgRating,
    atBatRatingCount,
    atBatSuccessRate,
    questionScore,
    flagReview: flagReview || null,
    flagUsed: currentPlayerState?.flagUsed ?? false,
    flagWindowOpen: !laterGradedRound,
    activePlayerCount: round.game.playerStates.filter((ps) => !ps.leaguePlayer.isPaused).length,
  });
}

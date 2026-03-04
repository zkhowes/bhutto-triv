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

  // If round is not yet graded, hide some answer details for non-graded rounds
  const isGraded = round.status === "graded" || round.status === "closed";
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
    if (!myAnswer?.betPlacedAt) {
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
      };
    } else {
      // Player has bet, show question but hide correct answer
      questionData = {
        ...questionData,
        correctOption: null,
        correctAnswer: null,
        acceptableAnswers: null,
      };
    }
  }

  // Compute at-bat player's historical avg question rating
  let atBatAvgRating: number | null = null;
  let atBatRatingCount = 0;
  if (round.atBatPlayerId) {
    const ratingAgg = await prisma.roundAnswer.aggregate({
      where: {
        questionRating: { not: null },
        round: {
          atBatPlayerId: round.atBatPlayerId,
          status: "graded",
        },
      },
      _avg: { questionRating: true },
      _count: { questionRating: true },
    });
    atBatRatingCount = ratingAgg._count.questionRating;
    if (atBatRatingCount >= 3) {
      atBatAvgRating = ratingAgg._avg.questionRating;
    }
  }

  // Compute question quality score for graded rounds
  let questionScore: { avgRating: number | null; successRate: number | null; composite: number | null } | null = null;
  if (round.status === "graded") {
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
    // Composite: weighted blend of avg rating (0-5 scale) and success rate mapped to 0-5
    // 70% rating, 30% difficulty balance (ideal ~50% success = 5, 0% or 100% = lower)
    const difficultyScore = successRate !== null
      ? 5 - Math.abs(successRate - 0.5) * 6
      : null;
    const composite = avgRating !== null && difficultyScore !== null
      ? Math.round((avgRating * 0.7 + Math.max(0, difficultyScore) * 0.3) * 10) / 10
      : avgRating;
    questionScore = { avgRating, successRate, composite };
  }

  return NextResponse.json({
    ...round,
    question: questionData,
    answers: processedAnswers,
    atBatAvgRating,
    atBatRatingCount,
    questionScore,
  });
}

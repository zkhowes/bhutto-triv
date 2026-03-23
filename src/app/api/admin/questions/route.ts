import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isAdminAuthenticated } from "@/lib/admin-auth";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!(await isAdminAuthenticated(session.user.id))) {
    return NextResponse.json(
      { error: "Super admin authentication required" },
      { status: 403 }
    );
  }

  const { searchParams } = new URL(req.url);
  const leagueId = searchParams.get("league");
  const category = searchParams.get("category");
  const dateFrom = searchParams.get("dateFrom");
  const dateTo = searchParams.get("dateTo");
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "50");

  // Build where clause
  const where: any = {};

  if (leagueId) {
    where.round = {
      game: {
        season: {
          leagueId,
        },
      },
    };
  }

  if (category) {
    where.category = category;
  }

  if (dateFrom || dateTo) {
    where.createdAt = {};
    if (dateFrom) {
      where.createdAt.gte = new Date(dateFrom);
    }
    if (dateTo) {
      where.createdAt.lte = new Date(dateTo);
    }
  }

  try {
    const [questions, total] = await Promise.all([
      prisma.question.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          round: {
            include: {
              game: {
                include: {
                  season: {
                    include: {
                      league: {
                        select: { id: true, name: true },
                      },
                    },
                  },
                },
              },
              answers: {
                select: {
                  isCorrect: true,
                  betAmount: true,
                  pointsWon: true,
                },
              },
            },
          },
        },
      }),
      prisma.question.count({ where }),
    ]);

    // Get creators for all questions
    const atBatPlayerIds = questions
      .map((q) => q.round?.atBatPlayerId)
      .filter((id): id is string => !!id);

    const creators = await prisma.leaguePlayer.findMany({
      where: { id: { in: atBatPlayerIds } },
      include: {
        user: {
          select: { nickname: true, email: true },
        },
      },
    });

    const creatorMap = new Map(creators.map((c) => [c.id, c]));

    // Calculate statistics for each question
    const questionsWithStats = questions.map((q) => {
      const totalAnswers = q.round?.answers.length || 0;
      const correctAnswers =
        q.round?.answers.filter((a) => a.isCorrect).length || 0;
      const bets =
        q.round?.answers
          .map((a) => a.betAmount)
          .filter((b): b is number => b !== null) || [];
      const avgBet =
        bets.length > 0 ? bets.reduce((a, b) => a + b, 0) / bets.length : 0;
      const highestBet = bets.length > 0 ? Math.max(...bets) : 0;

      const creatorId = q.round?.atBatPlayerId;
      const creator = creatorId ? creatorMap.get(creatorId) : null;

      return {
        id: q.id,
        questionText: q.questionText,
        category: q.category,
        answerFormat: q.answerFormat,
        correctAnswer: q.correctAnswer,
        imageUrl: q.imageUrl ?? null,
        imageSource: q.imageSource ?? null,
        creator: creator
          ? {
              nickname:
                creator.user.nickname || creator.user.email || "Unknown",
              email: creator.user.email || "",
            }
          : null,
        league: q.round?.game.season.league || null,
        createdAt: q.createdAt,
        stats: {
          timesAsked: 1, // Each question is asked once per round
          totalAnswers,
          correctAnswers,
          accuracy:
            totalAnswers > 0
              ? Math.round((correctAnswers / totalAnswers) * 100)
              : 0,
          avgBet: Math.round(avgBet * 10) / 10,
          highestBet,
        },
      };
    });

    return NextResponse.json({
      questions: questionsWithStats,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error("Questions query error:", error);
    return NextResponse.json(
      { error: "Failed to fetch questions" },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { assessQuestionDifficulty } from "@/lib/ai";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { category, questionText, leagueId } = await req.json();

  if (!category || !questionText) {
    return NextResponse.json(
      { error: "category and questionText are required" },
      { status: 400 }
    );
  }

  // Compute league stats from last 100 graded answers
  let overallCorrectRate = 0.5;
  const categoryCorrectRates: Record<string, number> = {};

  if (leagueId) {
    const recentAnswers = await prisma.roundAnswer.findMany({
      where: {
        round: {
          status: "graded",
          game: { season: { leagueId } },
        },
        isAbsent: false,
        isCorrect: { not: null },
      },
      select: {
        isCorrect: true,
        round: {
          select: {
            question: { select: { category: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    if (recentAnswers.length > 0) {
      const correct = recentAnswers.filter((a) => a.isCorrect).length;
      overallCorrectRate = correct / recentAnswers.length;

      // Per-category rates
      const byCategory: Record<string, { correct: number; total: number }> = {};
      for (const a of recentAnswers) {
        const cat = a.round.question?.category;
        if (!cat) continue;
        if (!byCategory[cat]) byCategory[cat] = { correct: 0, total: 0 };
        byCategory[cat].total++;
        if (a.isCorrect) byCategory[cat].correct++;
      }
      for (const [cat, stats] of Object.entries(byCategory)) {
        categoryCorrectRates[cat] = stats.correct / stats.total;
      }
    }
  }

  const result = await assessQuestionDifficulty(questionText, {
    overallCorrectRate,
    categoryCorrectRates,
    category,
  });

  return NextResponse.json(result);
}

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSuperAdmin } from "@/lib/admin-auth";

export async function GET(req: NextRequest) {
  const { error } = await requireSuperAdmin();
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const page = parseInt(searchParams.get("page") || "1");
  const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 200);
  const status = searchParams.get("status"); // "ok" | "review_error" | "review_unavailable"
  const changedOnly = searchParams.get("changedOnly") === "true";
  const questionId = searchParams.get("questionId");
  const q = searchParams.get("q")?.trim();

  const where: any = {};
  if (status) where.status = status;
  if (changedOnly) where.changed = true;
  if (questionId) where.questionId = questionId;
  if (q) {
    where.OR = [
      { questionText: { contains: q, mode: "insensitive" } },
      { notes: { contains: q, mode: "insensitive" } },
      { category: { contains: q, mode: "insensitive" } },
    ];
  }

  try {
    const [logs, total, totalAll, changedCount, errorCount, unavailableCount, avgLatencyAgg] =
      await Promise.all([
        prisma.questionReviewLog.findMany({
          where,
          skip: (page - 1) * limit,
          take: limit,
          orderBy: { createdAt: "desc" },
          include: {
            question: {
              select: {
                id: true,
                round: {
                  select: {
                    id: true,
                    number: true,
                    game: {
                      select: {
                        id: true,
                        number: true,
                        season: {
                          select: {
                            number: true,
                            league: { select: { id: true, name: true } },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        }),
        prisma.questionReviewLog.count({ where }),
        // Global totals (unfiltered) for summary cards
        prisma.questionReviewLog.count(),
        prisma.questionReviewLog.count({ where: { changed: true } }),
        prisma.questionReviewLog.count({ where: { status: "review_error" } }),
        prisma.questionReviewLog.count({ where: { status: "review_unavailable" } }),
        prisma.questionReviewLog.aggregate({
          _avg: { latencyMs: true },
          where: { status: "ok" },
        }),
      ]);

    return NextResponse.json({
      logs: logs.map((log) => ({
        id: log.id,
        questionId: log.questionId,
        format: log.format,
        category: log.category,
        questionText: log.questionText,
        beforeJson: log.beforeJson,
        afterJson: log.afterJson,
        changed: log.changed,
        notes: log.notes,
        modelUsed: log.modelUsed,
        status: log.status,
        latencyMs: log.latencyMs,
        createdAt: log.createdAt,
        league: log.question?.round?.game.season.league ?? null,
        seasonNumber: log.question?.round?.game.season.number ?? null,
        gameNumber: log.question?.round?.game.number ?? null,
        roundNumber: log.question?.round?.number ?? null,
        roundId: log.question?.round?.id ?? null,
        gameId: log.question?.round?.game.id ?? null,
      })),
      total,
      page,
      totalPages: Math.ceil(total / limit) || 1,
      summary: {
        totalReviewed: totalAll,
        changed: changedCount,
        errors: errorCount,
        unavailable: unavailableCount,
        avgLatencyMs: Math.round(avgLatencyAgg._avg.latencyMs ?? 0),
      },
    });
  } catch (err) {
    console.error("question-reviews query error:", err);
    return NextResponse.json(
      { error: "Failed to fetch question reviews" },
      { status: 500 }
    );
  }
}

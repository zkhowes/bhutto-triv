import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSuperAdmin } from "@/lib/admin-auth";

export async function GET(req: NextRequest) {
  const { error } = await requireSuperAdmin();
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const leagueId = searchParams.get("leagueId");
  const status = searchParams.get("status");
  const page = parseInt(searchParams.get("page") || "1");
  const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 200);

  const where: any = {};
  if (leagueId) where.season = { leagueId };
  if (status) where.status = status;

  const [games, total] = await Promise.all([
    prisma.game.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { createdAt: "desc" },
      include: {
        season: {
          include: {
            league: { select: { id: true, name: true } },
          },
        },
        _count: { select: { rounds: true } },
        rounds: {
          where: { status: "graded" },
          select: { id: true },
        },
      },
    }),
    prisma.game.count({ where }),
  ]);

  return NextResponse.json({
    games: games.map((g) => ({
      id: g.id,
      number: g.number,
      status: g.status,
      league: g.season.league,
      season: { id: g.season.id, number: g.season.number },
      totalRounds: g._count.rounds,
      completedRounds: g.rounds.length,
      startedAt: g.startedAt,
      completedAt: g.completedAt,
      createdAt: g.createdAt,
    })),
    total,
    page,
    totalPages: Math.ceil(total / limit),
  });
}

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSuperAdmin } from "@/lib/admin-auth";

export async function GET(req: NextRequest) {
  const { error } = await requireSuperAdmin();
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const gameId = searchParams.get("gameId");
  const leagueId = searchParams.get("leagueId");
  const playerId = searchParams.get("playerId"); // userId of at-bat player
  const status = searchParams.get("status");
  const page = parseInt(searchParams.get("page") || "1");
  const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 200);

  const where: any = {};
  if (gameId) where.gameId = gameId;
  if (leagueId) where.game = { season: { leagueId } };
  if (status) where.status = status;
  if (playerId) {
    const lps = await prisma.leaguePlayer.findMany({
      where: { userId: playerId },
      select: { id: true },
    });
    where.atBatPlayerId = { in: lps.map((lp) => lp.id) };
  }

  const [rounds, total] = await Promise.all([
    prisma.round.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { createdAt: "desc" },
      include: {
        game: {
          include: {
            season: {
              include: {
                league: { select: { id: true, name: true } },
              },
            },
          },
        },
        question: { select: { category: true, questionText: true } },
      },
    }),
    prisma.round.count({ where }),
  ]);

  const atBatIds = rounds
    .map((r) => r.atBatPlayerId)
    .filter((id): id is string => !!id);
  const atBatPlayers = atBatIds.length
    ? await prisma.leaguePlayer.findMany({
        where: { id: { in: atBatIds } },
        include: { user: { select: { id: true, nickname: true, email: true } } },
      })
    : [];
  const atBatMap = new Map(atBatPlayers.map((p) => [p.id, p]));

  return NextResponse.json({
    rounds: rounds.map((r) => {
      const ab = r.atBatPlayerId ? atBatMap.get(r.atBatPlayerId) : null;
      return {
        id: r.id,
        number: r.number,
        status: r.status,
        game: {
          id: r.game.id,
          number: r.game.number,
          league: r.game.season.league,
        },
        atBatPlayer: ab
          ? {
              userId: ab.user.id,
              leaguePlayerId: ab.id,
              nickname: ab.user.nickname || ab.user.email || "Unknown",
            }
          : null,
        category: r.question?.category ?? null,
        deadlineAt: r.deadlineAt,
      };
    }),
    total,
    page,
    totalPages: Math.ceil(total / limit),
  });
}

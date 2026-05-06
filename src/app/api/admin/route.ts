import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSuperAdmin } from "@/lib/admin-auth";

// GET - Super admin dashboard data
export async function GET() {
  const { error } = await requireSuperAdmin();
  if (error) return error;

  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const [
    totalPlayers,
    totalLeagues,
    activeLeagues,
    totalGamesStarted,
    totalGamesCompleted,
    totalQuestions,
    totalRounds,
    activeUsers7d,
    activeUsers30d,
    allLeagues,
    commissioners,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.league.count(),
    prisma.league.count({ where: { isActive: true } }),
    prisma.game.count({ where: { status: { not: "pending" } } }),
    prisma.game.count({ where: { status: "completed" } }),
    prisma.question.count(),
    prisma.round.count({ where: { status: { not: "pending" } } }),
    prisma.user.count({ where: { lastLoginAt: { gte: sevenDaysAgo } } }),
    prisma.user.count({ where: { lastLoginAt: { gte: thirtyDaysAgo } } }),
    prisma.league.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        players: {
          where: { role: "commissioner" },
          include: {
            user: { select: { nickname: true, email: true } },
          },
        },
        _count: { select: { players: true } },
        seasons: {
          orderBy: { number: "desc" },
          take: 1,
          include: {
            games: { orderBy: { number: "desc" }, take: 1 },
          },
        },
      },
    }),
    // Get all commissioners
    prisma.leaguePlayer.findMany({
      where: { role: "commissioner" },
      distinct: ["userId"],
      include: {
        user: {
          select: {
            id: true,
            nickname: true,
            email: true,
            createdAt: true,
          },
        },
        league: {
          select: {
            id: true,
            name: true,
            _count: { select: { players: true } },
          },
        },
      },
    }),
  ]);

  // Calculate average league size
  const activeLeaguesForSize = allLeagues.filter((l) => l.isActive);
  const avgLeagueSize =
    activeLeaguesForSize.length > 0
      ? activeLeaguesForSize.reduce((sum, l) => sum + l._count.players, 0) /
        activeLeaguesForSize.length
      : 0;

  // Group commissioners by user
  const commissionersByUser = new Map<
    string,
    { user: any; leagues: any[] }
  >();
  commissioners.forEach((c) => {
    if (!commissionersByUser.has(c.userId)) {
      commissionersByUser.set(c.userId, {
        user: c.user,
        leagues: [],
      });
    }
    commissionersByUser.get(c.userId)!.leagues.push(c.league);
  });

  return NextResponse.json({
    overview: {
      totalPlayers,
      totalLeagues,
      activeLeagues,
      totalGamesStarted,
      totalGamesCompleted,
      totalQuestions,
      totalRounds,
      activeUsers7d,
      activeUsers30d,
      avgLeagueSize: Math.round(avgLeagueSize * 10) / 10,
      gameCompletionRate:
        totalGamesStarted > 0
          ? Math.round((totalGamesCompleted / totalGamesStarted) * 100)
          : 0,
    },
    leagues: allLeagues.map((l) => ({
      id: l.id,
      name: l.name,
      type: l.type,
      commissioner:
        l.players[0]?.user?.nickname || l.players[0]?.user?.email || "Unknown",
      commissionerUserId: l.players[0]?.userId ?? null,
      playerCount: l._count.players,
      currentSeason: l.seasons[0]?.number || 0,
      currentSeasonId: l.seasons[0]?.id ?? null,
      currentGame: l.seasons[0]?.games[0]?.number || 0,
      currentGameId: l.seasons[0]?.games[0]?.id ?? null,
      createdAt: l.createdAt,
      isActive: l.isActive,
      notificationMode: l.notificationMode,
    })),
    commissioners: Array.from(commissionersByUser.values()).map((c) => ({
      id: c.user.id,
      nickname: c.user.nickname,
      email: c.user.email,
      leagueCount: c.leagues.length,
      leagues: c.leagues.map((l: any) => ({ id: l.id, name: l.name })),
      totalPlayers: c.leagues.reduce(
        (sum: number, l: any) => sum + l._count.players,
        0
      ),
      createdAt: c.user.createdAt,
    })),
  });
}

// POST - Admin actions
export async function POST(req: NextRequest) {
  const { session, error } = await requireSuperAdmin();
  if (error) return error;

  const { action, entityType, entityId, reason } = await req.json();

  // Log admin action
  await prisma.adminAuditLog.create({
    data: {
      adminId: session.user.id,
      action,
      entityType,
      entityId,
    },
  });

  switch (action) {
    case "deactivate_league":
      await prisma.league.update({
        where: { id: entityId },
        data: {
          isActive: false,
          deactivatedAt: new Date(),
          deactivateReason: reason,
        },
      });
      return NextResponse.json({ success: true });

    case "deactivate_user":
      // Soft deactivate by removing from all leagues
      await prisma.leaguePlayer.updateMany({
        where: { userId: entityId },
        data: { isActive: false },
      });
      return NextResponse.json({ success: true });

    default:
      return NextResponse.json(
        { error: "Unknown action" },
        { status: 400 }
      );
  }
}

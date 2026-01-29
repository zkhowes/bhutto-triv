import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET - Super admin dashboard data
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Verify super admin
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
  });

  if (!user?.isSuperAdmin) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

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
    recentLeagues,
    recentPlayers,
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
      take: 20,
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
    prisma.user.findMany({
      take: 20,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        nickname: true,
        email: true,
        createdAt: true,
        lastLoginAt: true,
        _count: {
          select: { leaguePlayers: true },
        },
      },
    }),
  ]);

  // Calculate average league size
  const allLeagueSizes = await prisma.league.findMany({
    where: { isActive: true },
    select: { _count: { select: { players: true } } },
  });
  const avgLeagueSize =
    allLeagueSizes.length > 0
      ? allLeagueSizes.reduce((sum, l) => sum + l._count.players, 0) /
        allLeagueSizes.length
      : 0;

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
    recentLeagues: recentLeagues.map((l) => ({
      id: l.id,
      name: l.name,
      type: l.type,
      commissioner:
        l.players[0]?.user?.nickname || l.players[0]?.user?.email || "Unknown",
      playerCount: l._count.players,
      currentSeason: l.seasons[0]?.number || 0,
      currentGame: l.seasons[0]?.games[0]?.number || 0,
      createdAt: l.createdAt,
      isActive: l.isActive,
    })),
    recentPlayers: recentPlayers.map((p) => ({
      id: p.id,
      nickname: p.nickname,
      email: p.email,
      leagueCount: p._count.leaguePlayers,
      createdAt: p.createdAt,
      lastLogin: p.lastLoginAt,
    })),
  });
}

// POST - Admin actions
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
  });

  if (!user?.isSuperAdmin) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

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

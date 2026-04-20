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
    recentLeagues,
    recentPlayers,
    commissioners,
    recentGames,
    recentRounds,
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
            name: true,
            _count: { select: { players: true } },
          },
        },
      },
    }),
    // Get recent games
    prisma.game.findMany({
      take: 20,
      orderBy: { createdAt: "desc" },
      include: {
        season: {
          include: {
            league: {
              select: { id: true, name: true },
            },
          },
        },
        _count: {
          select: {
            rounds: true,
          },
        },
        rounds: {
          where: { status: "graded" },
          select: { id: true },
        },
      },
    }),
    // Get recent rounds
    prisma.round.findMany({
      take: 20,
      orderBy: { createdAt: "desc" },
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
        question: {
          select: { category: true },
        },
      },
    }),
  ]);

  // Compute per-player question success rates (how often others answer their questions correctly)
  const playerIds = recentPlayers.map((p) => p.id);
  const playerLeaguePlayers = await prisma.leaguePlayer.findMany({
    where: { userId: { in: playerIds } },
    select: { id: true, userId: true },
  });
  const playerIdsByUserId = new Map<string, string[]>();
  playerLeaguePlayers.forEach((lp) => {
    const existing = playerIdsByUserId.get(lp.userId) || [];
    existing.push(lp.id);
    playerIdsByUserId.set(lp.userId, existing);
  });

  // Batch query: total answers and correct answers to each player's questions
  const playerQuestionStats = await Promise.all(
    playerIds.map(async (userId) => {
      const lpIds = playerIdsByUserId.get(userId) || [];
      if (lpIds.length === 0) return { userId, totalAnswers: 0, correctAnswers: 0 };
      const [totalAnswers, correctAnswers] = await Promise.all([
        prisma.roundAnswer.count({
          where: {
            round: { status: "graded", atBatPlayerId: { in: lpIds } },
            leaguePlayerId: { notIn: lpIds },
            isAbsent: false,
            isCorrect: { not: null },
          },
        }),
        prisma.roundAnswer.count({
          where: {
            round: { status: "graded", atBatPlayerId: { in: lpIds } },
            leaguePlayerId: { notIn: lpIds },
            isAbsent: false,
            isCorrect: true,
          },
        }),
      ]);
      return { userId, totalAnswers, correctAnswers };
    })
  );
  const questionStatsMap = new Map(playerQuestionStats.map((s) => [s.userId, s]));

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

  // Fetch at-bat players for recent rounds
  const atBatPlayerIds = recentRounds
    .map((r) => r.atBatPlayerId)
    .filter((id): id is string => !!id);

  const atBatPlayers = await prisma.leaguePlayer.findMany({
    where: { id: { in: atBatPlayerIds } },
    include: {
      user: {
        select: { nickname: true, email: true },
      },
    },
  });

  const atBatPlayerMap = new Map(atBatPlayers.map((p) => [p.id, p]));

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
    recentPlayers: recentPlayers.map((p) => {
      const stats = questionStatsMap.get(p.id);
      return {
        id: p.id,
        nickname: p.nickname,
        email: p.email,
        leagueCount: p._count.leaguePlayers,
        createdAt: p.createdAt,
        lastLogin: p.lastLoginAt,
        questionSuccessRate: stats && stats.totalAnswers > 0
          ? Math.round((stats.correctAnswers / stats.totalAnswers) * 100)
          : null,
        questionAnswerCount: stats?.totalAnswers ?? 0,
      };
    }),
    commissioners: Array.from(commissionersByUser.values()).map((c) => ({
      id: c.user.id,
      nickname: c.user.nickname,
      email: c.user.email,
      leagueCount: c.leagues.length,
      totalPlayers: c.leagues.reduce((sum, l) => sum + l._count.players, 0),
      createdAt: c.user.createdAt,
    })),
    recentGames: recentGames.map((g) => ({
      id: g.id,
      number: g.number,
      status: g.status,
      league: g.season.league,
      season: {
        id: g.season.id,
        number: g.season.number,
      },
      totalRounds: g._count.rounds,
      completedRounds: g.rounds.length,
      startedAt: g.startedAt,
      completedAt: g.completedAt,
    })),
    recentRounds: recentRounds.map((r) => {
      const atBatPlayer = r.atBatPlayerId
        ? atBatPlayerMap.get(r.atBatPlayerId)
        : null;
      return {
        id: r.id,
        number: r.number,
        status: r.status,
        game: {
          id: r.game.id,
          number: r.game.number,
          league: r.game.season.league,
        },
        atBatPlayer: atBatPlayer
          ? {
              nickname:
                atBatPlayer.user.nickname ||
                atBatPlayer.user.email ||
                "Unknown",
            }
          : null,
        category: r.question?.category,
        deadlineAt: r.deadlineAt,
      };
    }),
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

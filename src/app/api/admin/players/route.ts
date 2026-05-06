import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSuperAdmin } from "@/lib/admin-auth";

export async function GET(req: NextRequest) {
  const { error } = await requireSuperAdmin();
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim() || "";
  const leagueId = searchParams.get("leagueId");
  const page = parseInt(searchParams.get("page") || "1");
  const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 200);

  const where: any = {};

  if (q.length > 0) {
    where.OR = [
      { nickname: { contains: q, mode: "insensitive" } },
      { email: { contains: q, mode: "insensitive" } },
      { name: { contains: q, mode: "insensitive" } },
      { phoneNumber: { contains: q } },
    ];
  }

  if (leagueId) {
    where.leaguePlayers = { some: { leagueId } };
  }

  const [users, total, globalSettings] = await Promise.all([
    prisma.user.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        nickname: true,
        email: true,
        phoneNumber: true,
        notificationPreference: true,
        profileComplete: true,
        createdAt: true,
        lastLoginAt: true,
        leaguePlayers: {
          select: {
            id: true,
            isActive: true,
            isPaused: true,
            isFake: true,
            role: true,
            league: {
              select: {
                id: true,
                name: true,
                notificationMode: true,
                isActive: true,
              },
            },
          },
        },
      },
    }),
    prisma.user.count({ where }),
    prisma.globalSettings.findUnique({ where: { id: "singleton" } }),
  ]);

  const userIds = users.map((u) => u.id);

  // Recent SMS status per user (last 5)
  const recentNotifs = userIds.length
    ? await prisma.notification.findMany({
        where: { userId: { in: userIds } },
        orderBy: { createdAt: "desc" },
        take: userIds.length * 5,
        select: {
          id: true,
          userId: true,
          type: true,
          smsStatus: true,
          smsSentAt: true,
          createdAt: true,
        },
      })
    : [];

  const notifsByUser = new Map<string, typeof recentNotifs>();
  for (const n of recentNotifs) {
    const arr = notifsByUser.get(n.userId) ?? [];
    if (arr.length < 5) {
      arr.push(n);
      notifsByUser.set(n.userId, arr);
    }
  }

  // Per-player question success rate (how often others answer their questions correctly)
  const lpIdsByUser = new Map<string, string[]>();
  for (const u of users) {
    lpIdsByUser.set(u.id, u.leaguePlayers.map((lp) => lp.id));
  }

  const playerStats = await Promise.all(
    users.map(async (u) => {
      const lpIds = lpIdsByUser.get(u.id) || [];
      if (lpIds.length === 0)
        return { userId: u.id, totalAnswers: 0, correctAnswers: 0 };
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
      return { userId: u.id, totalAnswers, correctAnswers };
    })
  );
  const statsByUser = new Map(playerStats.map((s) => [s.userId, s]));

  const globalOverride =
    (globalSettings?.notificationOverride as "none" | "commissioner") ??
    "commissioner";

  const players = users.map((u) => {
    const stats = statsByUser.get(u.id);
    const memberships = u.leaguePlayers.map((lp) => {
      // Effective level for this user in this league
      const userPref = u.notificationPreference;
      const leaguePref = lp.league.notificationMode;
      const effective =
        globalOverride === "none" ? "none" : (userPref || leaguePref || "low");
      return {
        leaguePlayerId: lp.id,
        leagueId: lp.league.id,
        leagueName: lp.league.name,
        leagueIsActive: lp.league.isActive,
        leagueNotificationMode: leaguePref,
        role: lp.role,
        isActive: lp.isActive,
        isPaused: lp.isPaused,
        isFake: lp.isFake,
        effectiveLevel: effective,
      };
    });

    const recent = (notifsByUser.get(u.id) ?? []).map((n) => ({
      id: n.id,
      type: n.type,
      smsStatus: n.smsStatus,
      smsSentAt: n.smsSentAt,
      createdAt: n.createdAt,
    }));

    return {
      id: u.id,
      nickname: u.nickname,
      email: u.email,
      phoneNumber: u.phoneNumber,
      hasPhone: !!u.phoneNumber,
      notificationPreference: u.notificationPreference,
      profileComplete: u.profileComplete,
      createdAt: u.createdAt,
      lastLogin: u.lastLoginAt,
      leagueCount: u.leaguePlayers.length,
      memberships,
      recentNotifications: recent,
      questionSuccessRate:
        stats && stats.totalAnswers > 0
          ? Math.round((stats.correctAnswers / stats.totalAnswers) * 100)
          : null,
      questionAnswerCount: stats?.totalAnswers ?? 0,
    };
  });

  return NextResponse.json({
    players,
    total,
    page,
    totalPages: Math.ceil(total / limit),
    globalOverride,
  });
}

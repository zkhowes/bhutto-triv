import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { authenticatedSessions } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!authenticatedSessions.has(session.user.id)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const [
    totalSent,
    totalSms,
    totalClicks,
    byTypeRaw,
    globalSettings,
    recentNotificationsRaw,
  ] = await Promise.all([
    // Total notifications created
    prisma.notification.count(),

    // Total SMS sent successfully
    prisma.notification.count({ where: { smsStatus: "sent" } }),

    // Total click-throughs
    prisma.notification.count({ where: { clickedAt: { not: null } } }),

    // Counts grouped by type
    prisma.notification.groupBy({
      by: ["type"],
      _count: { id: true },
    }),

    // Global settings
    prisma.globalSettings.findUnique({ where: { id: "singleton" } }),

    // Recent 50 notifications with user info
    prisma.notification.findMany({
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        id: true,
        type: true,
        title: true,
        userId: true,
        smsStatus: true,
        clickedAt: true,
        createdAt: true,
        user: {
          select: { nickname: true, name: true },
        },
      },
    }),
  ]);

  // Get SMS + click counts per type
  const smsByType = await prisma.notification.groupBy({
    by: ["type"],
    where: { smsStatus: "sent" },
    _count: { id: true },
  });
  const clicksByType = await prisma.notification.groupBy({
    by: ["type"],
    where: { clickedAt: { not: null } },
    _count: { id: true },
  });

  const byType = byTypeRaw.map((row) => ({
    type: row.type,
    count: row._count.id,
    smsCount: smsByType.find((s) => s.type === row.type)?._count.id ?? 0,
    clickCount: clicksByType.find((c) => c.type === row.type)?._count.id ?? 0,
  }));

  const clickRate = totalSms > 0 ? (totalClicks / totalSms) * 100 : 0;

  const recentNotifications = recentNotificationsRaw.map((n) => ({
    id: n.id,
    type: n.type,
    title: n.title,
    userId: n.userId,
    userNickname: n.user.nickname ?? n.user.name ?? "Unknown",
    smsStatus: n.smsStatus,
    clickedAt: n.clickedAt?.toISOString() ?? null,
    createdAt: n.createdAt.toISOString(),
  }));

  return NextResponse.json({
    totalSent,
    totalSms,
    totalClicks,
    clickRate,
    byType,
    globalOverride: globalSettings?.notificationOverride ?? "commissioner",
    recentNotifications,
  });
}

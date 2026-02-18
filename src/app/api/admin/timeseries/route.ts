import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { authenticatedSessions } from "@/lib/admin-auth";

type TimeRange = "7d" | "30d" | "90d" | "all";
type Metric =
  | "players"
  | "leagues"
  | "games_started"
  | "games_completed"
  | "questions";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!authenticatedSessions.has(session.user.id)) {
    return NextResponse.json(
      { error: "Super admin authentication required" },
      { status: 403 }
    );
  }

  const { searchParams } = new URL(req.url);
  const metric = searchParams.get("metric") as Metric;
  const range = (searchParams.get("range") as TimeRange) || "30d";

  if (!metric) {
    return NextResponse.json(
      { error: "Metric parameter required" },
      { status: 400 }
    );
  }

  // Calculate date range
  const now = new Date();
  let startDate: Date;
  let groupBy: "day" | "week" | "month";

  switch (range) {
    case "7d":
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      groupBy = "day";
      break;
    case "30d":
      startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      groupBy = "day";
      break;
    case "90d":
      startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
      groupBy = "week";
      break;
    case "all":
      startDate = new Date(0); // Beginning of time
      groupBy = "month";
      break;
    default:
      startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      groupBy = "day";
  }

  try {
    let data: Array<{ date: string; value: number }> = [];

    switch (metric) {
      case "players":
        // New player registrations
        const players = await prisma.user.findMany({
          where: { createdAt: { gte: startDate } },
          select: { createdAt: true },
          orderBy: { createdAt: "asc" },
        });
        data = aggregateByDate(
          players.map((p) => p.createdAt),
          groupBy
        );
        break;

      case "leagues":
        // Active leagues over time (cumulative)
        const leagues = await prisma.league.findMany({
          where: { createdAt: { gte: startDate } },
          select: { createdAt: true, isActive: true },
          orderBy: { createdAt: "asc" },
        });
        data = aggregateByDate(
          leagues.filter((l) => l.isActive).map((l) => l.createdAt),
          groupBy
        );
        break;

      case "games_started":
        // Games started per period
        const gamesStarted = await prisma.game.findMany({
          where: {
            startedAt: { gte: startDate, not: null },
          },
          select: { startedAt: true },
          orderBy: { startedAt: "asc" },
        });
        data = aggregateByDate(
          gamesStarted
            .map((g) => g.startedAt)
            .filter((d): d is Date => d !== null),
          groupBy
        );
        break;

      case "games_completed":
        // Games completed per period
        const gamesCompleted = await prisma.game.findMany({
          where: {
            completedAt: { gte: startDate, not: null },
          },
          select: { completedAt: true },
          orderBy: { completedAt: "asc" },
        });
        data = aggregateByDate(
          gamesCompleted
            .map((g) => g.completedAt)
            .filter((d): d is Date => d !== null),
          groupBy
        );
        break;

      case "questions":
        // Questions submitted per period
        const questions = await prisma.question.findMany({
          where: { createdAt: { gte: startDate } },
          select: { createdAt: true },
          orderBy: { createdAt: "asc" },
        });
        data = aggregateByDate(
          questions.map((q) => q.createdAt),
          groupBy
        );
        break;

      default:
        return NextResponse.json({ error: "Invalid metric" }, { status: 400 });
    }

    return NextResponse.json({ data });
  } catch (error) {
    console.error("Time-series query error:", error);
    return NextResponse.json(
      { error: "Failed to fetch time-series data" },
      { status: 500 }
    );
  }
}

// Helper function to aggregate dates by period
function aggregateByDate(
  dates: Date[],
  groupBy: "day" | "week" | "month"
): Array<{ date: string; value: number }> {
  const grouped = new Map<string, number>();

  dates.forEach((date) => {
    let key: string;

    switch (groupBy) {
      case "day":
        key = date.toISOString().split("T")[0]; // YYYY-MM-DD
        break;
      case "week":
        // Get Monday of the week
        const d = new Date(date);
        const day = d.getDay();
        const diff = d.getDate() - day + (day === 0 ? -6 : 1);
        d.setDate(diff);
        key = d.toISOString().split("T")[0];
        break;
      case "month":
        key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(
          2,
          "0"
        )}`; // YYYY-MM
        break;
    }

    grouped.set(key, (grouped.get(key) || 0) + 1);
  });

  return Array.from(grouped.entries())
    .map(([date, value]) => ({ date, value }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

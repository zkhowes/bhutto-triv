import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isAdminAuthenticated } from "@/lib/admin-auth";

type TimeRange = "7d" | "30d" | "90d" | "all";
type Metric =
  | "players"
  | "leagues"
  | "games_started"
  | "games_completed"
  | "questions";
type ChartType = "total" | "active";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!(await isAdminAuthenticated(session.user.id))) {
    return NextResponse.json(
      { error: "Super admin authentication required" },
      { status: 403 }
    );
  }

  const { searchParams } = new URL(req.url);
  const metric = searchParams.get("metric") as Metric;
  const range = (searchParams.get("range") as TimeRange) || "30d";
  const chartType = (searchParams.get("type") as ChartType) || "total";

  if (!metric) {
    return NextResponse.json(
      { error: "Metric parameter required" },
      { status: 400 }
    );
  }

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
      startDate = new Date(0);
      groupBy = "month";
      break;
    default:
      startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      groupBy = "day";
  }

  try {
    let data: Array<{ date: string; value: number }> = [];

    switch (metric) {
      case "players": {
        if (chartType === "active") {
          // Distinct users who submitted an answer in the period
          const answers = await prisma.roundAnswer.findMany({
            where: { answeredAt: { gte: startDate } },
            select: { answeredAt: true, userId: true },
            orderBy: { answeredAt: "asc" },
          });
          data = aggregateDistinctByDate(
            answers
              .filter((a): a is typeof a & { answeredAt: Date } =>
                a.answeredAt !== null
              )
              .map((a) => ({ date: a.answeredAt, id: a.userId })),
            groupBy,
            startDate,
            now
          );
        } else {
          const players = await prisma.user.findMany({
            where: { createdAt: { gte: startDate } },
            select: { createdAt: true },
            orderBy: { createdAt: "asc" },
          });
          data = aggregateByDate(
            players.map((p) => p.createdAt),
            groupBy,
            startDate,
            now
          );
        }
        break;
      }

      case "leagues": {
        if (chartType === "active") {
          // Distinct leagues with a graded round in the period
          const rounds = await prisma.round.findMany({
            where: { status: "graded", updatedAt: { gte: startDate } },
            select: {
              updatedAt: true,
              game: { select: { season: { select: { leagueId: true } } } },
            },
            orderBy: { updatedAt: "asc" },
          });
          data = aggregateDistinctByDate(
            rounds.map((r) => ({
              date: r.updatedAt,
              id: r.game.season.leagueId,
            })),
            groupBy,
            startDate,
            now
          );
        } else {
          const leagues = await prisma.league.findMany({
            where: { createdAt: { gte: startDate } },
            select: { createdAt: true, isActive: true },
            orderBy: { createdAt: "asc" },
          });
          data = aggregateByDate(
            leagues.filter((l) => l.isActive).map((l) => l.createdAt),
            groupBy,
            startDate,
            now
          );
        }
        break;
      }

      case "games_started": {
        if (chartType === "active") {
          // Distinct games with graded rounds in the period
          const rounds = await prisma.round.findMany({
            where: { status: "graded", updatedAt: { gte: startDate } },
            select: { updatedAt: true, gameId: true },
            orderBy: { updatedAt: "asc" },
          });
          data = aggregateDistinctByDate(
            rounds.map((r) => ({ date: r.updatedAt, id: r.gameId })),
            groupBy,
            startDate,
            now
          );
        } else {
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
            groupBy,
            startDate,
            now
          );
        }
        break;
      }

      case "games_completed": {
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
          groupBy,
          startDate,
          now
        );
        break;
      }

      case "questions": {
        if (chartType === "active") {
          // Graded rounds = questions fully played through
          const gradedRounds = await prisma.round.findMany({
            where: { status: "graded", updatedAt: { gte: startDate } },
            select: { updatedAt: true },
            orderBy: { updatedAt: "asc" },
          });
          data = aggregateByDate(
            gradedRounds.map((r) => r.updatedAt),
            groupBy,
            startDate,
            now
          );
        } else {
          const questions = await prisma.question.findMany({
            where: { createdAt: { gte: startDate } },
            select: { createdAt: true },
            orderBy: { createdAt: "asc" },
          });
          data = aggregateByDate(
            questions.map((q) => q.createdAt),
            groupBy,
            startDate,
            now
          );
        }
        break;
      }

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

function getDateKey(date: Date, groupBy: "day" | "week" | "month"): string {
  switch (groupBy) {
    case "day":
      return date.toISOString().split("T")[0];
    case "week": {
      const d = new Date(date);
      const day = d.getDay();
      const diff = d.getDate() - day + (day === 0 ? -6 : 1);
      d.setDate(diff);
      return d.toISOString().split("T")[0];
    }
    case "month":
      return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
  }
}

function generateAllKeys(
  startDate: Date,
  endDate: Date,
  groupBy: "day" | "week" | "month"
): string[] {
  const keys: string[] = [];
  const current = new Date(startDate);

  while (current <= endDate) {
    keys.push(getDateKey(current, groupBy));
    if (groupBy === "day") current.setDate(current.getDate() + 1);
    else if (groupBy === "week") current.setDate(current.getDate() + 7);
    else current.setMonth(current.getMonth() + 1);
  }

  return Array.from(new Set(keys));
}

// Aggregates dates into counts per period, filling missing periods with 0.
// For "all" range (startDate = epoch), uses first data point as effective start.
function aggregateByDate(
  dates: Date[],
  groupBy: "day" | "week" | "month",
  startDate: Date,
  endDate: Date
): Array<{ date: string; value: number }> {
  const isAllTime = startDate.getTime() === 0;
  if (isAllTime && dates.length === 0) return [];

  const effectiveStart = isAllTime
    ? dates.reduce((min, d) => (d < min ? d : min), dates[0])
    : startDate;

  const grouped = new Map<string, number>();
  generateAllKeys(effectiveStart, endDate, groupBy).forEach((key) =>
    grouped.set(key, 0)
  );

  dates.forEach((date) => {
    const key = getDateKey(date, groupBy);
    grouped.set(key, (grouped.get(key) ?? 0) + 1);
  });

  return Array.from(grouped.entries())
    .map(([date, value]) => ({ date, value }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

// Aggregates items into distinct-id counts per period, filling missing periods with 0.
function aggregateDistinctByDate(
  items: Array<{ date: Date; id: string }>,
  groupBy: "day" | "week" | "month",
  startDate: Date,
  endDate: Date
): Array<{ date: string; value: number }> {
  const isAllTime = startDate.getTime() === 0;
  if (isAllTime && items.length === 0) return [];

  const effectiveStart = isAllTime
    ? items.reduce(
        (min, item) => (item.date < min ? item.date : min),
        items[0].date
      )
    : startDate;

  const grouped = new Map<string, Set<string>>();
  generateAllKeys(effectiveStart, endDate, groupBy).forEach((key) =>
    grouped.set(key, new Set())
  );

  items.forEach(({ date, id }) => {
    const key = getDateKey(date, groupBy);
    if (!grouped.has(key)) grouped.set(key, new Set());
    grouped.get(key)!.add(id);
  });

  return Array.from(grouped.entries())
    .map(([date, ids]) => ({ date, value: ids.size }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

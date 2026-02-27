import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { nanoid } from "nanoid";
import { DEFAULT_SETTINGS } from "@/lib/constants";

// GET /api/leagues - List user's leagues
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const leagues = await prisma.league.findMany({
    where: {
      players: {
        some: { userId: session.user.id, isActive: true },
      },
      isActive: true,
    },
    include: {
      players: {
        where: { isActive: true },
        include: { user: { select: { nickname: true, avatarUrl: true, image: true } } },
      },
      seasons: {
        orderBy: { number: "desc" },
        take: 1,
        include: {
          games: {
            orderBy: { number: "desc" },
            take: 1,
            include: {
              rounds: {
                orderBy: { number: "asc" },
                take: 20,
              },
            },
          },
        },
      },
    },
  });

  const leaguesWithRole = leagues.map((league) => {
    const myPlayer = league.players.find((p) => p.userId === session.user.id);
    const currentSeason = league.seasons[0];
    const currentGame = currentSeason?.games[0];
    const currentRound = currentGame?.rounds[0];

    return {
      id: league.id,
      name: league.name,
      type: league.type,
      playerCount: league.players.length,
      maxPlayers: league.maxPlayers,
      myRole: myPlayer?.role,
      currentSeason: currentSeason
        ? { number: currentSeason.number, status: currentSeason.status }
        : null,
      currentGame: currentGame
        ? { number: currentGame.number, status: currentGame.status }
        : null,
      currentRound: currentRound
        ? { number: currentRound.number, status: currentRound.status }
        : null,
      inviteCode: league.inviteCode,
    };
  });

  return NextResponse.json(leaguesWithRole);
}

// POST /api/leagues - Create a new league
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const {
    name,
    type = "season",
    maxPlayers = DEFAULT_SETTINGS.maxPlayers,
    gamesPerSeason = DEFAULT_SETTINGS.gamesPerSeason,
    dailyDeadline = DEFAULT_SETTINGS.dailyDeadline,
    deadlineTimezone = DEFAULT_SETTINGS.deadlineTimezone,
    submissionWindowStart = DEFAULT_SETTINGS.submissionWindowStart,
    submissionWindowEnd = DEFAULT_SETTINGS.submissionWindowEnd,
    categoryRevealTime = DEFAULT_SETTINGS.categoryRevealTime,
    absenteePenaltyType = DEFAULT_SETTINGS.absenteePenaltyType,
  } = body;

  if (!name) {
    return NextResponse.json(
      { error: "League name is required" },
      { status: 400 }
    );
  }

  // Validate test mode only in development or for super admins
  if (type === "test" && process.env.NODE_ENV !== "development" && !session.user.isSuperAdmin) {
    return NextResponse.json(
      { error: "Test mode only available in development" },
      { status: 400 }
    );
  }

  // Ensure the user exists in the database (may have been reset)
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
  });
  if (!user) {
    return NextResponse.json(
      { error: "User not found. Please sign out and sign back in." },
      { status: 400 }
    );
  }

  const league = await prisma.league.create({
    data: {
      name,
      type,
      inviteCode: nanoid(10),
      maxPlayers: Math.min(Math.max(maxPlayers, 2), 10),
      gamesPerSeason,
      dailyDeadline,
      deadlineTimezone,
      submissionWindowStart,
      submissionWindowEnd,
      categoryRevealTime,
      absenteePenaltyType,
      players: {
        create: {
          userId: session.user.id,
          role: "commissioner",
        },
      },
    },
    include: {
      players: true,
    },
  });

  return NextResponse.json(league, { status: 201 });
}

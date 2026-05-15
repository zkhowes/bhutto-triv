import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { nanoid } from "nanoid";
import { DEFAULT_SETTINGS } from "@/lib/constants";
import { DEFAULT_QUIET_HOURS_TZ } from "@/lib/quiet-hours";

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
        include: { user: { select: { nickname: true, avatarUrl: true, image: true, timezone: true } } },
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
              playerStates: true,
            },
          },
        },
      },
    },
  });

  // Build per-league active round info
  const activeRoundInfo: Record<string, {
    roundId: string;
    status: string;
    atBatPlayerId: string | null;
    myLeaguePlayerId: string;
    gameId: string;
    updatedAt: string;
  }> = {};

  const roundIdsToCheck: string[] = [];
  const playerIdsToCheck: string[] = [];

  for (const league of leagues) {
    const myPlayer = league.players.find((p) => p.userId === session.user.id);
    const currentSeason = league.seasons[0];
    const currentGame = currentSeason?.games[0];
    if (!currentGame || currentGame.status !== "active" || !myPlayer) continue;

    // Find the active round (latest non-graded, non-cancelled)
    const activeRound = [...currentGame.rounds]
      .reverse()
      .find((r) => r.status !== "graded" && r.status !== "cancelled" && r.status !== "pending");

    if (!activeRound) continue;

    activeRoundInfo[league.id] = {
      roundId: activeRound.id,
      status: activeRound.status,
      atBatPlayerId: activeRound.atBatPlayerId,
      myLeaguePlayerId: myPlayer.id,
      gameId: currentGame.id,
      updatedAt: activeRound.updatedAt.toISOString(),
    };
    roundIdsToCheck.push(activeRound.id);
    playerIdsToCheck.push(myPlayer.id);
  }

  // Batch lookup: check if user has bet/answered in active rounds
  const myAnswers = roundIdsToCheck.length > 0
    ? await prisma.roundAnswer.findMany({
        where: {
          roundId: { in: roundIdsToCheck },
          leaguePlayerId: { in: playerIdsToCheck },
        },
        select: { roundId: true, leaguePlayerId: true, betPlacedAt: true, answeredAt: true },
      })
    : [];

  const answerLookup = new Map(
    myAnswers.map((a) => [`${a.roundId}:${a.leaguePlayerId}`, a])
  );

  const leaguesWithRole = leagues.map((league) => {
    const myPlayer = league.players.find((p) => p.userId === session.user.id);
    const currentSeason = league.seasons[0];
    const currentGame = currentSeason?.games[0];
    const currentRound = currentGame?.rounds[0];
    const info = activeRoundInfo[league.id];

    let activeRound = null;
    if (info) {
      const answer = answerLookup.get(`${info.roundId}:${info.myLeaguePlayerId}`);
      activeRound = {
        status: info.status,
        atBatPlayerId: info.atBatPlayerId,
        hasBet: !!answer?.betPlacedAt,
        hasAnswered: !!answer?.answeredAt,
        updatedAt: info.updatedAt,
      };
    }

    let myStanding: { isBusted: boolean; place: number | null; total: number } | null = null;
    if (currentGame && myPlayer) {
      const myState = currentGame.playerStates.find(
        (ps) => ps.leaguePlayerId === myPlayer.id
      );
      if (myState) {
        const isBusted = myState.isEliminated || myState.points === 0;
        if (isBusted) {
          myStanding = { isBusted: true, place: null, total: 0 };
        } else {
          const alive = currentGame.playerStates.filter(
            (ps) => !ps.isEliminated && ps.points > 0
          );
          const ahead = alive.filter((ps) => ps.points > myState.points).length;
          myStanding = { isBusted: false, place: ahead + 1, total: alive.length };
        }
      }
    }

    const commissioner = league.players.find((p) => p.role === "commissioner");
    const quietHoursTimezone = commissioner?.user?.timezone ?? DEFAULT_QUIET_HOURS_TZ;

    return {
      id: league.id,
      name: league.name,
      type: league.type,
      playerCount: league.players.length,
      maxPlayers: league.maxPlayers,
      myRole: myPlayer?.role,
      myLeaguePlayerId: myPlayer?.id ?? null,
      gameId: currentGame?.id ?? null,
      autoSkipEnabled: league.autoSkipEnabled,
      quietHours: {
        enabled: league.quietHoursEnabled,
        start: league.quietHoursStart,
        end: league.quietHoursEnd,
        timezone: quietHoursTimezone,
      },
      currentSeason: currentSeason
        ? { number: currentSeason.number, status: currentSeason.status }
        : null,
      currentGame: currentGame
        ? {
            number: currentGame.number,
            status: currentGame.status,
            totalRounds: currentGame.totalRounds,
          }
        : null,
      currentRound: currentRound
        ? { number: currentRound.number, status: currentRound.status }
        : null,
      activeRound,
      myStanding,
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
      inviteCode: nanoid(5),
      maxPlayers: Math.min(Math.max(maxPlayers, 2), 10),
      gamesPerSeason,
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

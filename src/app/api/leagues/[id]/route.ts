import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { deleteLeagueCascade } from "@/lib/league-delete";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  const leagueId = params.id;

  const league = await prisma.league.findUnique({
    where: { id: leagueId },
    include: {
      players: {
        where: { isActive: true },
        include: {
          user: {
            select: {
              id: true,
              nickname: true,
              avatarUrl: true,
              image: true,
              name: true,
            },
          },
        },
      },
      seasons: {
        orderBy: { number: "desc" },
        include: {
          games: {
            orderBy: { number: "desc" },
            take: 1,
            include: {
              rounds: {
                orderBy: { number: "asc" },
              },
              playerStates: {
                include: {
                  leaguePlayer: {
                    include: {
                      user: {
                        select: { nickname: true, avatarUrl: true, image: true },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  });

  if (!league) {
    return NextResponse.json({ error: "League not found" }, { status: 404 });
  }

  // Require authentication to view league data
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Check if user is a member (active players)
  const isPlayer = league.players.some((p) => p.userId === session.user.id);
  let myPlayer = session?.user?.id
    ? league.players.find((p) => p.userId === session.user.id)
    : null;

  // If user not found in active players, check if they're paused
  let myPaused = false;
  let myPausedPlayerId: string | null = null;
  if (!myPlayer && session?.user?.id) {
    const pausedPlayer = await prisma.leaguePlayer.findFirst({
      where: { leagueId, userId: session.user.id, isPaused: true },
    });
    if (pausedPlayer) {
      myPausedPlayerId = pausedPlayer.id;
      myPaused = true;
    }
  }

  // Compute season standings: aggregate F1 points across all completed games in active season
  let seasonStandings: Array<{
    leaguePlayerId: string;
    nickname: string;
    avatarUrl: string | null;
    totalF1Points: number;
    gamesPlayed: number;
    lastGameF1Points: number;
  }> = [];
  let seasonChartData: Array<Record<string, number>> = [];

  const activeSeason = league.seasons.find((s) => s.status === "active" || s.status === "completed");
  if (activeSeason) {
    // Fetch all games for this season (not just the latest)
    const allSeasonGames = await prisma.game.findMany({
      where: { seasonId: activeSeason.id, status: "completed" },
      orderBy: { number: "asc" },
      include: {
        playerStates: {
          include: {
            leaguePlayer: {
              include: {
                user: { select: { nickname: true, avatarUrl: true, image: true } },
              },
            },
          },
        },
      },
    });

    if (allSeasonGames.length > 0) {
      // Aggregate F1 points per player across all completed games
      const playerTotals: Record<string, { nickname: string; avatarUrl: string | null; totalF1Points: number; gamesPlayed: number; lastGameF1Points: number }> = {};
      // Track cumulative points per game for chart
      const cumulativePoints: Record<string, number> = {};
      const lastGame = allSeasonGames[allSeasonGames.length - 1];

      for (const game of allSeasonGames) {
        const chartPoint: Record<string, number> = { game: game.number };
        const isLastGame = game.id === lastGame?.id;

        for (const ps of game.playerStates) {
          const pid = ps.leaguePlayerId;
          const nickname = ps.leaguePlayer.fakeNickname || ps.leaguePlayer.user.nickname || "Unknown";
          const avatarUrl = ps.leaguePlayer.user.avatarUrl || ps.leaguePlayer.user.image;

          if (!playerTotals[pid]) {
            playerTotals[pid] = { nickname, avatarUrl, totalF1Points: 0, gamesPlayed: 0, lastGameF1Points: 0 };
            cumulativePoints[pid] = 0;
          }
          playerTotals[pid].totalF1Points += ps.totalF1Points;
          playerTotals[pid].gamesPlayed++;
          if (isLastGame) {
            playerTotals[pid].lastGameF1Points = ps.totalF1Points;
          }
          cumulativePoints[pid] += ps.totalF1Points;
          chartPoint[nickname] = cumulativePoints[pid];
        }

        seasonChartData.push(chartPoint);
      }

      seasonStandings = Object.entries(playerTotals)
        .map(([leaguePlayerId, data]) => ({ leaguePlayerId, ...data }))
        .sort((a, b) => b.totalF1Points - a.totalF1Points);
    }

    // If season is active but no completed games yet, show all players at 0
    if (seasonStandings.length === 0 && activeSeason.status === "active") {
      seasonStandings = league.players
        .filter((p) => p.isActive)
        .map((p) => ({
          leaguePlayerId: p.id,
          nickname: p.fakeNickname || p.user.nickname || "Unknown",
          avatarUrl: p.user.avatarUrl || p.user.image,
          totalF1Points: 0,
          gamesPlayed: 0,
          lastGameF1Points: 0,
        }));
    }
  }

  // Fetch paused players for commissioner tools
  const pausedPlayers = await prisma.leaguePlayer.findMany({
    where: { leagueId, isPaused: true },
    include: {
      user: {
        select: {
          id: true,
          nickname: true,
          avatarUrl: true,
          image: true,
          name: true,
        },
      },
    },
  });

  return NextResponse.json({
    ...league,
    isPlayer: isPlayer || myPaused,
    myRole: myPlayer?.role || null,
    myPlayerId: myPlayer?.id || myPausedPlayerId,
    myPaused,
    seasonStandings,
    seasonChartData,
    pausedPlayers,
  });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const leagueId = params.id;
  const league = await prisma.league.findUnique({
    where: { id: leagueId },
    include: {
      players: { where: { userId: session.user.id, role: "commissioner" } },
    },
  });

  if (!league) {
    return NextResponse.json({ error: "League not found" }, { status: 404 });
  }

  // Also allow super admin to delete any league
  const isSuperAdmin = session.user.isSuperAdmin === true;
  if (league.players.length === 0 && !isSuperAdmin) {
    return NextResponse.json({ error: "Only the commissioner can delete a league" }, { status: 403 });
  }

  // Delete fake users created for test players
  const fakePlayers = await prisma.leaguePlayer.findMany({
    where: { leagueId, isFake: true },
  });
  const fakeUserIds = fakePlayers.map((p) => p.userId);

  try {
    await deleteLeagueCascade(leagueId);
  } catch (err) {
    console.error("League delete failed", leagueId, err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to delete league" },
      { status: 500 }
    );
  }

  if (fakeUserIds.length > 0) {
    await prisma.user.deleteMany({ where: { id: { in: fakeUserIds } } });
  }

  return NextResponse.json({ deleted: true });
}

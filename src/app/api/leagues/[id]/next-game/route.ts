import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { initializeGame } from "@/lib/game-engine";
import { getF1PointsForPlacement } from "@/lib/scoring";

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const leagueId = params.id;

  // Verify commissioner
  const commissioner = await prisma.leaguePlayer.findFirst({
    where: {
      leagueId,
      userId: session.user.id,
      role: "commissioner",
      isActive: true,
    },
  });

  if (!commissioner) {
    return NextResponse.json(
      { error: "Only the commissioner can start the next game" },
      { status: 403 }
    );
  }

  const league = await prisma.league.findUnique({
    where: { id: leagueId },
    select: { gamesPerSeason: true },
  });

  if (!league) {
    return NextResponse.json({ error: "League not found" }, { status: 404 });
  }

  // Check active season exists
  const season = await prisma.season.findFirst({
    where: { leagueId, status: "active" },
    include: {
      games: { orderBy: { number: "desc" } },
    },
  });

  if (!season) {
    return NextResponse.json({ error: "No active season" }, { status: 400 });
  }

  // Check latest game is completed (or auto-complete if all rounds are terminal)
  const latestGame = season.games[0];
  if (!latestGame) {
    return NextResponse.json({ error: "No game found in active season" }, { status: 400 });
  }

  if (latestGame.status !== "completed") {
    // Check if game is stuck: all rounds are graded or cancelled but game wasn't marked complete
    const activeRounds = await prisma.round.findMany({
      where: {
        gameId: latestGame.id,
        isCancelled: false,
        status: { notIn: ["graded", "pending"] },
      },
    });

    if (activeRounds.length > 0) {
      return NextResponse.json(
        { error: `Current game still has ${activeRounds.length} round(s) in progress. Grade all rounds first.` },
        { status: 400 }
      );
    }

    // All non-pending rounds are graded — auto-complete the game with F1 scoring
    const finalStates = await prisma.gamePlayerState.findMany({
      where: { gameId: latestGame.id },
    });
    const sortedByPoints = [...finalStates].sort((a, b) => b.points - a.points);
    for (let i = 0; i < sortedByPoints.length; i++) {
      await prisma.gamePlayerState.update({
        where: { id: sortedByPoints[i].id },
        data: { totalF1Points: getF1PointsForPlacement(i + 1, sortedByPoints.length) },
      });
    }
    await prisma.game.update({
      where: { id: latestGame.id },
      data: { status: "completed", completedAt: new Date() },
    });
  }

  // Check season is not yet complete
  if (season.games.length >= league.gamesPerSeason) {
    return NextResponse.json(
      { error: "All games for this season have been played" },
      { status: 400 }
    );
  }

  // Get all active players
  const players = await prisma.leaguePlayer.findMany({
    where: { leagueId, isActive: true },
    select: { id: true },
  });

  if (players.length < 2) {
    return NextResponse.json(
      { error: "Need at least 2 players to start a game" },
      { status: 400 }
    );
  }

  const playerIds = players.map((p) => p.id);
  const gameId = await initializeGame(season.id, playerIds);

  return NextResponse.json({ gameId }, { status: 201 });
}

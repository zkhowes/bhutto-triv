import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { initializeGame } from "@/lib/game-engine";

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

  // Check latest game is completed
  const latestGame = season.games[0];
  if (!latestGame || latestGame.status !== "completed") {
    return NextResponse.json(
      { error: "Current game is not yet complete" },
      { status: 400 }
    );
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

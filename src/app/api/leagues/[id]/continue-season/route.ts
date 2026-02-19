import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { initializeGame } from "@/lib/game-engine";

/**
 * Reactivate a completed season and start the next game within it.
 * Used when a season was auto-completed before all intended games were played
 * (e.g. gamesPerSeason was set incorrectly and has since been updated).
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const leagueId = params.id;

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
      { error: "Only the commissioner can continue a season" },
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

  // Body may contain an updated gamesPerSeason to apply first
  let body: { gamesPerSeason?: number } = {};
  try {
    body = await req.json();
  } catch {
    // no body is fine
  }

  // Find the most recent season (active or completed)
  const season = await prisma.season.findFirst({
    where: { leagueId, status: { in: ["completed", "active"] } },
    orderBy: { number: "desc" },
    include: { games: { orderBy: { number: "desc" } } },
  });

  if (!season) {
    return NextResponse.json({ error: "No season found" }, { status: 400 });
  }

  // Optionally update gamesPerSeason on the league
  const effectiveGamesPerSeason = body.gamesPerSeason ?? league.gamesPerSeason;
  if (body.gamesPerSeason && body.gamesPerSeason !== league.gamesPerSeason) {
    await prisma.league.update({
      where: { id: leagueId },
      data: { gamesPerSeason: body.gamesPerSeason },
    });
  }

  if (season.games.length >= effectiveGamesPerSeason) {
    return NextResponse.json(
      { error: `Season already has ${season.games.length} game(s) — all ${effectiveGamesPerSeason} games are complete` },
      { status: 400 }
    );
  }

  // Reactivate the season if it was completed early
  if (season.status === "completed") {
    await prisma.season.update({
      where: { id: season.id },
      data: { status: "active", completedAt: null },
    });
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

  return NextResponse.json({ gameId, seasonReactivated: season.status === "completed" }, { status: 201 });
}

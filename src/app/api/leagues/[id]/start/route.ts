import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { initializeSeason } from "@/lib/game-engine";

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
  const player = await prisma.leaguePlayer.findFirst({
    where: {
      leagueId,
      userId: session.user.id,
      role: "commissioner",
      isActive: true,
    },
  });

  if (!player) {
    return NextResponse.json(
      { error: "Only the commissioner can start a season" },
      { status: 403 }
    );
  }

  // Check minimum players
  const playerCount = await prisma.leaguePlayer.count({
    where: { leagueId, isActive: true },
  });

  if (playerCount < 2) {
    return NextResponse.json(
      { error: "Need at least 2 players to start" },
      { status: 400 }
    );
  }

  // Check no active season
  const activeSeason = await prisma.season.findFirst({
    where: {
      leagueId,
      status: { in: ["active", "paused"] },
    },
  });

  if (activeSeason) {
    return NextResponse.json(
      { error: "A season is already in progress" },
      { status: 400 }
    );
  }

  const seasonId = await initializeSeason(leagueId);

  return NextResponse.json({ seasonId }, { status: 201 });
}

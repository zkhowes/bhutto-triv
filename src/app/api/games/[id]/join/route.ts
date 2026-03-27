import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { addLateJoiner } from "@/lib/game-engine";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const gameId = params.id;

  // Find the league player for this user in this game's league
  const game = await prisma.game.findUnique({
    where: { id: gameId },
    include: { season: { include: { league: true } } },
  });

  if (!game) {
    return NextResponse.json({ error: "Game not found" }, { status: 404 });
  }

  const leaguePlayer = await prisma.leaguePlayer.findFirst({
    where: {
      leagueId: game.season.leagueId,
      userId: session.user.id,
      isActive: true,
    },
  });

  if (!leaguePlayer) {
    return NextResponse.json({ error: "Not a member of this league" }, { status: 403 });
  }

  try {
    await addLateJoiner(gameId, leaguePlayer.id);
    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Failed to join game";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

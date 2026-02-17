import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { placeBet } from "@/lib/game-engine";
import { resolveTestPlayer } from "@/lib/test-mode";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { betAmount, leaguePlayerId } = await req.json();
  const roundId = params.id;

  if (!betAmount || betAmount < 1) {
    return NextResponse.json(
      { error: "Bet amount must be at least 1" },
      { status: 400 }
    );
  }

  // Verify player belongs to user (or commissioner acting as test player)
  let player = await prisma.leaguePlayer.findFirst({
    where: {
      id: leaguePlayerId,
      userId: session.user.id,
    },
  });

  if (!player) {
    // Check if commissioner acting as test player
    const testPlayer = await resolveTestPlayer(leaguePlayerId, session.user.id);
    if (!testPlayer) {
      return NextResponse.json({ error: "Player not found" }, { status: 404 });
    }
    player = { ...testPlayer } as unknown as typeof player;
  }

  try {
    const answerId = await placeBet(
      roundId,
      leaguePlayerId,
      player!.userId,
      betAmount
    );
    return NextResponse.json({ answerId });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to place bet";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

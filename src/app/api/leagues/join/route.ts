import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { inviteCode } = await req.json();

  if (!inviteCode) {
    return NextResponse.json(
      { error: "Invite code is required" },
      { status: 400 }
    );
  }

  const league = await prisma.league.findUnique({
    where: { inviteCode },
    include: {
      players: { where: { isActive: true } },
    },
  });

  if (!league) {
    return NextResponse.json(
      { error: "Invalid invite code" },
      { status: 404 }
    );
  }

  if (!league.isActive) {
    return NextResponse.json(
      { error: "This league is no longer active" },
      { status: 400 }
    );
  }

  // Check if already a member
  const existing = league.players.find((p) => p.userId === session.user.id);
  if (existing) {
    return NextResponse.json(
      { error: "Already in this league", leagueId: league.id },
      { status: 400 }
    );
  }

  // Check max players
  if (league.players.length >= league.maxPlayers) {
    return NextResponse.json(
      { error: "League is full" },
      { status: 400 }
    );
  }

  const player = await prisma.leaguePlayer.create({
    data: {
      leagueId: league.id,
      userId: session.user.id,
      role: "player",
    },
  });

  return NextResponse.json(
    { leagueId: league.id, playerId: player.id },
    { status: 201 }
  );
}

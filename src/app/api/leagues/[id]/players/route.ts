import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET - list players
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const players = await prisma.leaguePlayer.findMany({
    where: { leagueId: params.id, isActive: true },
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

  return NextResponse.json(players);
}

// DELETE - remove player (commissioner only)
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { playerId } = await req.json();

  // Verify commissioner
  const commissioner = await prisma.leaguePlayer.findFirst({
    where: {
      leagueId: params.id,
      userId: session.user.id,
      role: "commissioner",
      isActive: true,
    },
  });

  if (!commissioner) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  // Cannot remove self if commissioner
  const targetPlayer = await prisma.leaguePlayer.findUnique({
    where: { id: playerId },
  });

  if (!targetPlayer) {
    return NextResponse.json({ error: "Player not found" }, { status: 404 });
  }

  if (targetPlayer.role === "commissioner") {
    return NextResponse.json(
      { error: "Transfer commissioner role before leaving" },
      { status: 400 }
    );
  }

  await prisma.leaguePlayer.update({
    where: { id: playerId },
    data: { isActive: false, removedAt: new Date() },
  });

  return NextResponse.json({ success: true });
}

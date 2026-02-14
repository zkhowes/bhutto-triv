import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

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

  // Check if user is a member
  const isPlayer = session?.user?.id
    ? league.players.some((p) => p.userId === session.user.id)
    : false;
  const myPlayer = session?.user?.id
    ? league.players.find((p) => p.userId === session.user.id)
    : null;

  return NextResponse.json({
    ...league,
    isPlayer,
    myRole: myPlayer?.role || null,
    myPlayerId: myPlayer?.id || null,
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

  if (league.players.length === 0) {
    return NextResponse.json({ error: "Only the commissioner can delete a league" }, { status: 403 });
  }

  if (league.type !== "test") {
    return NextResponse.json({ error: "Only test leagues can be deleted" }, { status: 400 });
  }

  // Delete fake users created for test players
  const fakePlayers = await prisma.leaguePlayer.findMany({
    where: { leagueId, isFake: true },
  });
  const fakeUserIds = fakePlayers.map((p) => p.userId);

  // Cascade delete handles league → seasons → games → rounds → answers etc.
  await prisma.league.delete({ where: { id: leagueId } });

  // Clean up fake user records
  if (fakeUserIds.length > 0) {
    await prisma.user.deleteMany({ where: { id: { in: fakeUserIds } } });
  }

  return NextResponse.json({ deleted: true });
}

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
                orderBy: { number: "desc" },
                take: 1,
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

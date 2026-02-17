import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const game = await prisma.game.findUnique({
    where: { id: params.id },
    include: {
      season: {
        include: {
          league: {
            select: {
              id: true,
              name: true,
              dailyDeadline: true,
              deadlineTimezone: true,
            },
          },
        },
      },
      rounds: {
        orderBy: { number: "asc" },
        include: {
          question: {
            select: { id: true, category: true, answerFormat: true },
          },
        },
      },
      battingOrder: {
        orderBy: { position: "asc" },
        include: {
          leaguePlayer: {
            include: {
              user: {
                select: {
                  id: true,
                  nickname: true,
                  avatarUrl: true,
                  image: true,
                },
              },
            },
          },
        },
      },
      playerStates: {
        orderBy: { totalF1Points: "desc" },
        include: {
          leaguePlayer: {
            include: {
              user: {
                select: {
                  id: true,
                  nickname: true,
                  avatarUrl: true,
                  image: true,
                },
              },
            },
          },
        },
      },
    },
  });

  if (!game) {
    return NextResponse.json({ error: "Game not found" }, { status: 404 });
  }

  return NextResponse.json(game);
}

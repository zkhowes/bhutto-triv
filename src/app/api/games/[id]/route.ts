import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);

  const game = await prisma.game.findUnique({
    where: { id: params.id },
    include: {
      season: {
        include: {
          league: {
            select: {
              id: true,
              name: true,
              type: true,
              dailyDeadline: true,
              deadlineTimezone: true,
              answerTimerSeconds: true,
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

  // Look up current user's role and player ID (avoids separate /api/leagues call)
  let myRole: string | null = null;
  let myPlayerId: string | null = null;
  if (session?.user?.id) {
    const leaguePlayer = await prisma.leaguePlayer.findFirst({
      where: {
        leagueId: game.season.league.id,
        userId: session.user.id,
        isActive: true,
      },
      select: { id: true, role: true },
    });
    if (leaguePlayer) {
      myRole = leaguePlayer.role;
      myPlayerId = leaguePlayer.id;
    }
  }

  // Require league membership to view game data
  if (!myPlayerId && !session?.user?.isSuperAdmin) {
    return NextResponse.json({ error: "Not a member of this league" }, { status: 403 });
  }

  // Find previous game's last graded round (for cross-game recap on new game start)
  let previousGameLastRoundId: string | null = null;
  if (game.number > 1) {
    const prevGame = await prisma.game.findFirst({
      where: { seasonId: game.seasonId, number: game.number - 1 },
      select: {
        rounds: {
          where: { status: "graded", isCancelled: false },
          orderBy: { number: "desc" },
          take: 1,
          select: { id: true },
        },
      },
    });
    previousGameLastRoundId = prevGame?.rounds[0]?.id ?? null;
  }

  // Check if current user can late-join this game
  let canJoinLate = false;
  if (myPlayerId && game.status === "active") {
    const isInGame = game.playerStates.some((ps) => ps.leaguePlayerId === myPlayerId);
    if (!isInGame) {
      const hasGradedRound = game.rounds.some((r) => r.status === "graded");
      canJoinLate = !hasGradedRound;
    }
  }

  return NextResponse.json({ ...game, myRole, myPlayerId, canJoinLate, previousGameLastRoundId });
}

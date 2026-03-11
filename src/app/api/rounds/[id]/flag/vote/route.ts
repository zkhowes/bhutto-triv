import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { submitFlagVote } from "@/lib/game-engine";
import { resolveTestPlayer } from "@/lib/test-mode";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { leaguePlayerId, vote, proxyPlayerId } = await req.json();

  if (!vote || !["agree", "disagree"].includes(vote)) {
    return NextResponse.json({ error: "Vote must be 'agree' or 'disagree'" }, { status: 400 });
  }

  // Get the flag review for this round
  const flagReview = await prisma.flagReview.findUnique({
    where: { roundId: params.id },
    include: {
      round: {
        include: {
          game: {
            include: {
              season: {
                include: {
                  league: {
                    include: {
                      players: {
                        where: {
                          userId: session.user.id,
                          isActive: true,
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
    },
  });

  if (!flagReview) {
    return NextResponse.json({ error: "No flag review for this round" }, { status: 404 });
  }

  // Determine the actual voter
  const voterId = proxyPlayerId || leaguePlayerId;
  const isProxy = !!proxyPlayerId;

  if (isProxy) {
    // Only commissioner can cast proxy votes
    const isCommissioner = flagReview.round.game.season.league.players.some(
      (p) => p.role === "commissioner"
    );
    if (!isCommissioner) {
      return NextResponse.json({ error: "Only commissioner can cast proxy votes" }, { status: 403 });
    }
  } else {
    // Verify player belongs to user (or test mode)
    let player = await prisma.leaguePlayer.findFirst({
      where: { id: leaguePlayerId, userId: session.user.id },
    });

    if (!player) {
      const testPlayer = await resolveTestPlayer(leaguePlayerId, session.user.id, session.user.isSuperAdmin);
      if (!testPlayer) {
        return NextResponse.json({ error: "Player not found" }, { status: 404 });
      }
    }
  }

  try {
    const result = await submitFlagVote(flagReview.id, voterId, vote, isProxy);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to submit vote";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

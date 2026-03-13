import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { throwFlag } from "@/lib/game-engine";
import { resolveTestPlayer } from "@/lib/test-mode";
import { FLAG_VOTE_THRESHOLD } from "@/lib/constants";

// POST: Throw a flag on a graded round
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { leaguePlayerId, objection } = await req.json();

  if (!objection || typeof objection !== "string" || objection.trim().length === 0) {
    return NextResponse.json({ error: "Objection text is required" }, { status: 400 });
  }

  if (objection.length > 500) {
    return NextResponse.json({ error: "Objection must be under 500 characters" }, { status: 400 });
  }

  // Verify player belongs to user (or commissioner acting as test player)
  let player = await prisma.leaguePlayer.findFirst({
    where: { id: leaguePlayerId, userId: session.user.id },
  });

  if (!player) {
    const testPlayer = await resolveTestPlayer(leaguePlayerId, session.user.id, session.user.isSuperAdmin);
    if (!testPlayer) {
      return NextResponse.json({ error: "Player not found" }, { status: 404 });
    }
    player = { ...testPlayer } as unknown as typeof player;
  }

  try {
    const result = await throwFlag(params.id, leaguePlayerId, objection.trim());
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to throw flag";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

// GET: Get flag review status for a round
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const flagReview = await prisma.flagReview.findUnique({
    where: { roundId: params.id },
    include: {
      votes: {
        include: {
          leaguePlayer: {
            include: {
              user: { select: { nickname: true, avatarUrl: true } },
            },
          },
        },
      },
      flaggedBy: {
        include: {
          user: { select: { nickname: true, avatarUrl: true } },
        },
      },
      round: {
        select: {
          atBatPlayerId: true,
          number: true,
          game: {
            select: {
              playerStates: {
                select: {
                  leaguePlayerId: true,
                  isEliminated: true,
                  leaguePlayer: { select: { isPaused: true } },
                },
              },
            },
          },
        },
      },
    },
  });

  if (!flagReview) {
    return NextResponse.json({ flagReview: null });
  }

  // Calculate eligible voter count (paused excluded, busted can still vote)
  const eligibleVoters = flagReview.round.game.playerStates.filter(
    (ps) =>
      !ps.leaguePlayer.isPaused &&
      ps.leaguePlayerId !== flagReview.flaggedById &&
      ps.leaguePlayerId !== flagReview.round.atBatPlayerId
  );

  const agreeCount = flagReview.votes.filter((v) => v.vote === "agree").length;
  const disagreeCount = flagReview.votes.filter((v) => v.vote === "disagree").length;
  const threshold = Math.ceil(eligibleVoters.length * FLAG_VOTE_THRESHOLD);

  return NextResponse.json({
    flagReview: {
      id: flagReview.id,
      roundId: flagReview.roundId,
      objection: flagReview.objection,
      status: flagReview.status,
      createdAt: flagReview.createdAt,
      resolvedAt: flagReview.resolvedAt,
      flaggedBy: {
        id: flagReview.flaggedById,
        nickname: flagReview.flaggedBy.fakeNickname || flagReview.flaggedBy.user.nickname,
        avatarUrl: flagReview.flaggedBy.user.avatarUrl,
      },
      atBatPlayerId: flagReview.round.atBatPlayerId,
      votes: flagReview.votes.map((v) => ({
        leaguePlayerId: v.leaguePlayerId,
        vote: v.vote,
        isProxyVote: v.isProxyVote,
        nickname: v.leaguePlayer.fakeNickname || v.leaguePlayer.user.nickname,
        avatarUrl: v.leaguePlayer.user.avatarUrl,
      })),
      tally: {
        agree: agreeCount,
        disagree: disagreeCount,
        totalEligible: eligibleVoters.length,
        threshold,
      },
    },
  });
}

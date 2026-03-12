import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { notifyAtBat, notifyOnDeck } from "@/lib/notifications";

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

// PATCH - pause/unpause player (commissioner only)
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { playerId, action } = await req.json();
  if (!playerId || !["pause", "unpause"].includes(action)) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

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

  const targetPlayer = await prisma.leaguePlayer.findUnique({
    where: { id: playerId },
  });

  if (!targetPlayer || targetPlayer.leagueId !== params.id) {
    return NextResponse.json({ error: "Player not found" }, { status: 404 });
  }

  if (targetPlayer.role === "commissioner") {
    return NextResponse.json({ error: "Cannot pause commissioner" }, { status: 400 });
  }

  if (action === "pause") {
    if (!targetPlayer.isActive || targetPlayer.isPaused) {
      return NextResponse.json({ error: "Player is not active" }, { status: 400 });
    }
    await prisma.leaguePlayer.update({
      where: { id: playerId },
      data: { isActive: false, isPaused: true, pausedAt: new Date() },
    });

    // Handle active game: cancel paused player's pending rounds and eliminate them
    const activeGame = await prisma.game.findFirst({
      where: {
        season: { leagueId: params.id },
        status: "active",
      },
      include: {
        rounds: { orderBy: { number: "asc" } },
        playerStates: true,
      },
    });

    if (activeGame) {
      // Eliminate the player from the game
      await prisma.gamePlayerState.updateMany({
        where: { gameId: activeGame.id, leaguePlayerId: playerId },
        data: { isEliminated: true },
      });

      // Find rounds where this player is at bat that haven't progressed past awaiting_question
      const playerRounds = activeGame.rounds.filter(
        (r) =>
          r.atBatPlayerId === playerId &&
          !r.isCancelled &&
          (r.status === "pending" || r.status === "awaiting_question")
      );

      for (const r of playerRounds) {
        // Cancel the round
        await prisma.round.update({
          where: { id: r.id },
          data: { status: "cancelled", isCancelled: true },
        });

        // Decrement totalRounds
        await prisma.game.update({
          where: { id: activeGame.id },
          data: { totalRounds: { decrement: 1 } },
        });

        // If this was the active round (awaiting_question), advance to next round
        if (r.status === "awaiting_question") {
          const nextPending = activeGame.rounds.find(
            (nr) =>
              nr.number > r.number &&
              !nr.isCancelled &&
              nr.atBatPlayerId !== playerId &&
              nr.status === "pending"
          );
          if (nextPending) {
            await prisma.round.update({
              where: { id: nextPending.id },
              data: { status: "awaiting_question" },
            });
            await notifyAtBat(nextPending.id);
            await notifyOnDeck(nextPending.id);
          } else {
            // No more rounds — check if game should complete
            const remainingRounds = activeGame.rounds.filter(
              (nr) =>
                !nr.isCancelled &&
                nr.id !== r.id &&
                nr.atBatPlayerId !== playerId &&
                nr.status !== "graded"
            );
            if (remainingRounds.length === 0) {
              // Complete the game
              const { getF1PointsForPlacement } = await import("@/lib/scoring");
              const finalStates = await prisma.gamePlayerState.findMany({
                where: { gameId: activeGame.id },
              });
              const sorted = [...finalStates].sort((a, b) => b.points - a.points);
              for (let i = 0; i < sorted.length; i++) {
                const f1Points = getF1PointsForPlacement(i + 1, sorted.length);
                await prisma.gamePlayerState.update({
                  where: { id: sorted[i].id },
                  data: { totalF1Points: f1Points },
                });
              }
              await prisma.game.update({
                where: { id: activeGame.id },
                data: { status: "completed", completedAt: new Date() },
              });
            }
          }
        }
      }
    }
  } else {
    if (!targetPlayer.isPaused) {
      return NextResponse.json({ error: "Player is not paused" }, { status: 400 });
    }
    await prisma.leaguePlayer.update({
      where: { id: playerId },
      data: { isActive: true, isPaused: false, pausedAt: null },
    });
  }

  return NextResponse.json({ success: true });
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
    data: { isActive: false, isPaused: false, pausedAt: null, removedAt: new Date() },
  });

  return NextResponse.json({ success: true });
}

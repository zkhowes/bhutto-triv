import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { forceCloseFlagReview } from "@/lib/game-engine";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { resolution } = await req.json();

  if (!resolution || !["agree", "disagree"].includes(resolution)) {
    return NextResponse.json(
      { error: "Resolution must be 'agree' or 'disagree'" },
      { status: 400 }
    );
  }

  // Get the flag review and verify commissioner
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
                          role: "commissioner",
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

  if (flagReview.round.game.season.league.players.length === 0) {
    return NextResponse.json({ error: "Only commissioner can force close" }, { status: 403 });
  }

  try {
    await forceCloseFlagReview(flagReview.id, resolution);
    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to force close";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

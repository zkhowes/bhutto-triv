import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// Override grade (creator or commissioner)
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { answerId, isCorrect } = await req.json();
  const roundId = params.id;

  const round = await prisma.round.findUnique({
    where: { id: roundId },
    include: {
      question: true,
      game: {
        include: {
          season: {
            include: {
              league: {
                include: {
                  players: {
                    where: { userId: session.user.id, isActive: true },
                  },
                },
              },
            },
          },
        },
      },
    },
  });

  if (!round || !round.question) {
    return NextResponse.json({ error: "Round not found" }, { status: 404 });
  }

  const myPlayer = round.game.season.league.players[0];
  if (!myPlayer) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const isCreator = round.question.creatorUserId === session.user.id;
  const isCommissioner = myPlayer.role === "commissioner";

  if (!isCreator && !isCommissioner) {
    return NextResponse.json(
      { error: "Only question creator or commissioner can override grades" },
      { status: 403 }
    );
  }

  await prisma.roundAnswer.update({
    where: { id: answerId },
    data: {
      isCorrect,
      gradedBy: isCommissioner ? "commissioner" : "creator",
      creatorValidated: true,
    },
  });

  return NextResponse.json({ success: true });
}

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { rating } = await req.json();

  if (!rating || typeof rating !== "number" || rating < 1 || rating > 5) {
    return NextResponse.json(
      { error: "Rating must be 1-5" },
      { status: 400 }
    );
  }

  const round = await prisma.round.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      status: true,
      atBatPlayerId: true,
      answers: {
        select: { id: true, leaguePlayerId: true, userId: true },
      },
    },
  });

  if (!round) {
    return NextResponse.json({ error: "Round not found" }, { status: 404 });
  }

  // Must be in a rateable state
  if (!["category_revealed", "graded"].includes(round.status)) {
    return NextResponse.json(
      { error: "Cannot rate in this round state" },
      { status: 400 }
    );
  }

  // Support test mode actAs
  const url = new URL(req.url);
  const actAsPlayerId = url.searchParams.get("actAs");

  const myAnswer = actAsPlayerId
    ? round.answers.find((a) => a.leaguePlayerId === actAsPlayerId)
    : round.answers.find((a) => a.userId === session.user.id);

  if (!myAnswer) {
    return NextResponse.json(
      { error: "You must participate to rate" },
      { status: 403 }
    );
  }

  // At-bat player cannot rate their own question
  if (myAnswer.leaguePlayerId === round.atBatPlayerId) {
    return NextResponse.json(
      { error: "Cannot rate your own question" },
      { status: 403 }
    );
  }

  await prisma.roundAnswer.update({
    where: { id: myAnswer.id },
    data: { questionRating: rating },
  });

  return NextResponse.json({ ok: true });
}

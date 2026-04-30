import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// Returns the set of league IDs where the user has already played this question text.
async function findLeaguesWherePlayed(
  userId: string,
  questionText: string | null | undefined
): Promise<string[]> {
  const text = questionText?.trim();
  if (!text) return [];
  const rows = await prisma.question.findMany({
    where: {
      creatorUserId: userId,
      questionText: { equals: text, mode: "insensitive" },
    },
    select: { round: { select: { game: { select: { season: { select: { leagueId: true } } } } } } },
  });
  return Array.from(
    new Set(
      rows
        .map((r) => r.round?.game?.season?.leagueId)
        .filter((id): id is string => !!id)
    )
  );
}

// GET - List user's drafts
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const drafts = await prisma.questionDraft.findMany({
    where: { userId: session.user.id },
    orderBy: { updatedAt: "desc" },
  });

  return NextResponse.json(drafts);
}

// POST - Save a draft
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();

  if (body.useOnNextRound) {
    // Auto-submit can fire in any of the user's leagues, so any prior play blocks it.
    const playedLeagueIds = await findLeaguesWherePlayed(session.user.id, body.questionText);
    if (playedLeagueIds.length > 0) {
      return NextResponse.json(
        {
          error: "This question has already been played. Auto-submit was disabled — pick a specific league via 'Use in this league' instead.",
          playedLeagueIds,
          alreadyPlayedLeagueId: playedLeagueIds[0], // back-compat
        },
        { status: 409 }
      );
    }
  }

  const draft = await prisma.questionDraft.create({
    data: {
      userId: session.user.id,
      category: body.category,
      questionText: body.questionText,
      answerFormat: body.answerFormat,
      optionA: body.optionA,
      optionB: body.optionB,
      optionC: body.optionC,
      optionD: body.optionD,
      correctOption: body.correctOption,
      correctAnswer: body.correctAnswer,
      acceptableAnswers: body.acceptableAnswers
        ? JSON.stringify(body.acceptableAnswers)
        : null,
      orderingItems: body.orderingItems
        ? JSON.stringify(body.orderingItems)
        : null,
      orderingCorrectOrder: body.orderingCorrectOrder
        ? JSON.stringify(body.orderingCorrectOrder)
        : null,
      orderingDirection: body.orderingDirection || null,
      orderingItemValues: body.orderingItemValues
        ? JSON.stringify(body.orderingItemValues)
        : null,
      useOnNextRound: body.useOnNextRound || false,
      leagueId: body.leagueId,
      imageUrl: body.imageUrl || null,
      imageSource: body.imageSource || null,
      imageAttribution: body.imageAttribution || null,
      isReplay: body.isReplay === true,
      originalQuestionId: body.originalQuestionId || null,
    },
  });

  return NextResponse.json(draft, { status: 201 });
}

// PUT - Update a draft
export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { id, ...updateData } = body;

  if (!id) {
    return NextResponse.json(
      { error: "Draft ID is required" },
      { status: 400 }
    );
  }

  const draft = await prisma.questionDraft.findFirst({
    where: { id, userId: session.user.id },
  });

  if (!draft) {
    return NextResponse.json(
      { error: "Draft not found" },
      { status: 404 }
    );
  }

  if (updateData.useOnNextRound === true) {
    const candidateText =
      "questionText" in updateData ? updateData.questionText : draft.questionText;
    const playedLeagueIds = await findLeaguesWherePlayed(session.user.id, candidateText);
    if (playedLeagueIds.length > 0) {
      return NextResponse.json(
        {
          error: "This question has already been played. Auto-submit cannot be re-enabled — pick a specific league via 'Use in this league' instead.",
          playedLeagueIds,
          alreadyPlayedLeagueId: playedLeagueIds[0], // back-compat
        },
        { status: 409 }
      );
    }
  }

  // Build update payload only from keys actually sent
  const data: Record<string, unknown> = {};
  const fields = ["category", "questionText", "answerFormat", "optionA", "optionB", "optionC", "optionD", "correctOption", "correctAnswer", "useOnNextRound", "imageUrl", "imageSource", "imageAttribution", "orderingDirection", "isReplay", "originalQuestionId"];
  for (const field of fields) {
    if (field in updateData) {
      data[field] = updateData[field];
    }
  }
  if ("acceptableAnswers" in updateData) {
    data.acceptableAnswers = updateData.acceptableAnswers
      ? JSON.stringify(updateData.acceptableAnswers)
      : null;
  }
  if ("orderingItems" in updateData) {
    data.orderingItems = updateData.orderingItems
      ? JSON.stringify(updateData.orderingItems)
      : null;
  }
  if ("orderingCorrectOrder" in updateData) {
    data.orderingCorrectOrder = updateData.orderingCorrectOrder
      ? JSON.stringify(updateData.orderingCorrectOrder)
      : null;
  }
  if ("orderingItemValues" in updateData) {
    data.orderingItemValues = updateData.orderingItemValues
      ? JSON.stringify(updateData.orderingItemValues)
      : null;
  }

  const updated = await prisma.questionDraft.update({
    where: { id },
    data,
  });

  return NextResponse.json(updated);
}

// DELETE - Delete a draft
export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json(
      { error: "Draft ID is required" },
      { status: 400 }
    );
  }

  await prisma.questionDraft.deleteMany({
    where: { id, userId: session.user.id },
  });

  return NextResponse.json({ success: true });
}

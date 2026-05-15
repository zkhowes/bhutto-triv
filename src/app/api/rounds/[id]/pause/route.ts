import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const SKIP_TIMER_MS = 24 * 60 * 60 * 1000;

const PAUSEABLE_STATUSES = ["awaiting_question", "question_submitted", "category_revealed"];

async function loadAndAuthorize(roundId: string, userId: string) {
  const round = await prisma.round.findUnique({
    where: { id: roundId },
    select: {
      id: true,
      status: true,
      updatedAt: true,
      pausedAt: true,
      pausedTimerSnapshotMs: true,
      game: {
        select: {
          season: {
            select: {
              league: {
                select: {
                  id: true,
                  players: {
                    where: { userId, role: "commissioner", isActive: true },
                    select: { id: true },
                  },
                },
              },
            },
          },
        },
      },
    },
  });
  if (!round) return { error: NextResponse.json({ error: "Round not found" }, { status: 404 }) };
  if (round.game.season.league.players.length === 0) {
    return { error: NextResponse.json({ error: "Not authorized" }, { status: 403 }) };
  }
  return { round };
}

// POST /api/rounds/[id]/pause — commissioner pauses the round so the auto-skip cron skips it.
// Captures remaining time on the 24h skip clock so resume can choose to preserve it.
export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { round, error } = await loadAndAuthorize(params.id, session.user.id);
  if (error) return error;
  if (!round) return NextResponse.json({ error: "Round not found" }, { status: 404 });

  if (round.pausedAt) {
    return NextResponse.json({ error: "Round is already paused" }, { status: 400 });
  }
  if (!PAUSEABLE_STATUSES.includes(round.status)) {
    return NextResponse.json(
      { error: "Only active (awaiting/answering) rounds can be paused" },
      { status: 400 },
    );
  }

  const elapsedMs = Date.now() - round.updatedAt.getTime();
  const remainingMs = Math.max(0, SKIP_TIMER_MS - elapsedMs);

  await prisma.round.update({
    where: { id: round.id },
    data: {
      pausedAt: new Date(),
      pausedById: session.user.id,
      pausedTimerSnapshotMs: remainingMs,
    },
  });

  return NextResponse.json({ success: true, remainingMs });
}

// DELETE /api/rounds/[id]/pause — commissioner resumes a paused round.
// Body: { mode: "reset" | "preserve" } — "reset" gives a fresh 24h, "preserve" restores the
// remaining time captured at pause.
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { round, error } = await loadAndAuthorize(params.id, session.user.id);
  if (error) return error;
  if (!round) return NextResponse.json({ error: "Round not found" }, { status: 404 });
  if (!round.pausedAt) {
    return NextResponse.json({ error: "Round is not paused" }, { status: 400 });
  }

  const body = await req.json().catch(() => ({}));
  const mode: "reset" | "preserve" = body?.mode === "preserve" ? "preserve" : "reset";

  let newUpdatedAt: Date;
  if (mode === "preserve") {
    const remaining = round.pausedTimerSnapshotMs ?? SKIP_TIMER_MS;
    newUpdatedAt = new Date(Date.now() - (SKIP_TIMER_MS - remaining));
  } else {
    newUpdatedAt = new Date();
  }

  await prisma.round.update({
    where: { id: round.id },
    data: {
      pausedAt: null,
      pausedById: null,
      pausedTimerSnapshotMs: null,
      updatedAt: newUpdatedAt,
    },
  });

  return NextResponse.json({ success: true, mode, updatedAt: newUpdatedAt.toISOString() });
}

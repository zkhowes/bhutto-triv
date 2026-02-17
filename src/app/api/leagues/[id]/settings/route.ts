import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const leagueId = params.id;

  // Verify commissioner
  const commissioner = await prisma.leaguePlayer.findFirst({
    where: {
      leagueId,
      userId: session.user.id,
      role: "commissioner",
      isActive: true,
    },
  });

  if (!commissioner) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  // Check no active season (settings only editable between seasons)
  const activeSeason = await prisma.season.findFirst({
    where: {
      leagueId,
      status: "active",
    },
  });

  if (activeSeason) {
    return NextResponse.json(
      { error: "Settings can only be changed between seasons" },
      { status: 400 }
    );
  }

  const body = await req.json();
  const allowedFields = [
    "gamesPerSeason",
    "dailyDeadline",
    "deadlineTimezone",
    "submissionWindowStart",
    "submissionWindowEnd",
    "categoryRevealTime",
    "answerTimerSeconds",
    "absenteePenaltyType",
  ];

  const updateData: Record<string, unknown> = {};
  for (const field of allowedFields) {
    if (body[field] !== undefined) {
      updateData[field] = body[field];
    }
  }

  const league = await prisma.league.update({
    where: { id: leagueId },
    data: updateData,
  });

  return NextResponse.json(league);
}

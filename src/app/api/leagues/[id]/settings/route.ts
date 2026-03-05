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
    "lightningMode",
  ];

  // Validate field types
  const fieldValidators: Record<string, (v: unknown) => boolean> = {
    gamesPerSeason: (v) => typeof v === "number" && Number.isInteger(v) && v >= 1 && v <= 50,
    dailyDeadline: (v) => typeof v === "string" && /^\d{2}:\d{2}$/.test(v),
    deadlineTimezone: (v) => typeof v === "string" && v.length <= 50,
    submissionWindowStart: (v) => typeof v === "string" || v === null,
    submissionWindowEnd: (v) => typeof v === "string" || v === null,
    categoryRevealTime: (v) => typeof v === "number" && v >= 0 && v <= 300,
    answerTimerSeconds: (v) => typeof v === "number" && v >= 0 && v <= 600,
    absenteePenaltyType: (v) => typeof v === "string" && ["none", "proportional", "fixed"].includes(v),
    lightningMode: (v) => typeof v === "boolean",
  };

  const updateData: Record<string, unknown> = {};
  for (const field of allowedFields) {
    if (body[field] !== undefined) {
      const validator = fieldValidators[field];
      if (validator && !validator(body[field])) {
        return NextResponse.json({ error: `Invalid value for ${field}` }, { status: 400 });
      }
      updateData[field] = body[field];
    }
  }

  const league = await prisma.league.update({
    where: { id: leagueId },
    data: updateData,
  });

  return NextResponse.json(league);
}

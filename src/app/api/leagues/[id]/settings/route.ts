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

  const body = await req.json();

  // Fields that can be changed anytime (even during a season)
  const alwaysAllowedFields = ["maxPlayers", "autoSkipEnabled"];
  // Fields that require no active season
  const seasonLockedFields = [
    "gamesPerSeason",
    "answerTimerSeconds",
  ];
  const allowedFields = [...alwaysAllowedFields, ...seasonLockedFields];

  // Validate field types
  const fieldValidators: Record<string, (v: unknown) => boolean> = {
    maxPlayers: (v) => typeof v === "number" && Number.isInteger(v) && v >= 2 && v <= 10,
    gamesPerSeason: (v) => typeof v === "number" && Number.isInteger(v) && v >= 1 && v <= 50,
    answerTimerSeconds: (v) => typeof v === "number" && v >= 0 && v <= 600,
    autoSkipEnabled: (v) => typeof v === "boolean",
  };

  const updateData: Record<string, unknown> = {};
  for (const field of allowedFields) {
    if (body[field] !== undefined) {
      // Block season-locked fields during active season
      if (activeSeason && seasonLockedFields.includes(field)) {
        return NextResponse.json(
          { error: "Settings can only be changed between seasons" },
          { status: 400 }
        );
      }
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

  // When autoSkipEnabled is toggled, notify all players
  if (updateData.autoSkipEnabled === true || updateData.autoSkipEnabled === false) {
    try {
      const players = await prisma.leaguePlayer.findMany({
        where: { leagueId, isActive: true, isFake: false },
        include: { user: { select: { id: true, phoneNumber: true } } },
      });

      const { createNotification } = await import("@/lib/notifications");
      const enabled = updateData.autoSkipEnabled === true;

      await Promise.all(
        players.map((p) =>
          createNotification({
            userId: p.user.id,
            leagueId,
            type: enabled ? "auto_skip_enabled" : "auto_skip_disabled",
            title: enabled ? "24-Hour Rule Enabled" : "24-Hour Rule Disabled",
            message: enabled
              ? `${league.name} now has the 24-hour rule. You'll be warned after 24h of inactivity and auto-skipped after 27h. Stay on top of your rounds!`
              : `${league.name} no longer has the 24-hour rule. The commissioner will manually progress the game.`,
            destinationUrl: `/leagues/${leagueId}`,
            phoneNumber: p.user.phoneNumber ?? undefined,
          })
        )
      );
    } catch (err) {
      console.error("[Settings] Failed to send auto-skip notifications:", err);
    }
  }

  return NextResponse.json(league);
}

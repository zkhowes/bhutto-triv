import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// PUT - Update league notification mode (commissioner only, no season restriction)
export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const leagueId = params.id;

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

  const body = await req.json();
  const { notificationMode } = body;

  if (!["none", "low", "high"].includes(notificationMode)) {
    return NextResponse.json(
      { error: "Invalid notification mode. Must be none, low, or high." },
      { status: 400 }
    );
  }

  const league = await prisma.league.update({
    where: { id: leagueId },
    data: { notificationMode },
    select: { id: true, notificationMode: true },
  });

  return NextResponse.json(league);
}

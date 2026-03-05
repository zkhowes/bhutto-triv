import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { CATEGORIES } from "@/lib/constants";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const leagueId = params.id;

  // Verify user is an active player in this league
  const player = await prisma.leaguePlayer.findFirst({
    where: {
      leagueId,
      userId: session.user.id,
      isActive: true,
    },
  });

  if (!player) {
    return NextResponse.json({ error: "Not a member of this league" }, { status: 403 });
  }

  const custom = await prisma.leagueCategory.findMany({
    where: { leagueId },
    orderBy: { usageCount: "desc" },
    select: { id: true, name: true, usageCount: true },
    take: 50,
  });

  return NextResponse.json({
    defaults: [...CATEGORIES],
    custom,
  });
}

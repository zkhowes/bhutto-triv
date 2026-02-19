import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// Temporary debug endpoint — commissioner only, returns raw DB state
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const leagueId = params.id;

  const commissioner = await prisma.leaguePlayer.findFirst({
    where: { leagueId, userId: session.user.id, role: "commissioner", isActive: true },
  });
  if (!commissioner) {
    return NextResponse.json({ error: "Commissioner only" }, { status: 403 });
  }

  const league = await prisma.league.findUnique({
    where: { id: leagueId },
    select: { id: true, name: true, gamesPerSeason: true },
  });

  const seasons = await prisma.season.findMany({
    where: { leagueId },
    orderBy: { number: "desc" },
    include: {
      games: {
        orderBy: { number: "desc" },
        include: {
          rounds: {
            orderBy: { number: "asc" },
            select: { id: true, number: true, status: true, isCancelled: true },
          },
        },
      },
    },
  });

  return NextResponse.json({ league, seasons });
}

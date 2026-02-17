import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const leagueId = params.id;

  const seasons = await prisma.season.findMany({
    where: { leagueId },
    orderBy: { number: "desc" },
    include: {
      awards: {
        include: {
          season: true,
        },
      },
    },
  });

  // Get player info for all award winners
  const playerIds = Array.from(
    new Set(seasons.flatMap((s) => s.awards.map((a) => a.playerId)))
  );
  const players = await prisma.leaguePlayer.findMany({
    where: { id: { in: playerIds } },
    include: {
      user: { select: { nickname: true, avatarUrl: true, image: true } },
    },
  });

  const playerMap = new Map(players.map((p) => [p.id, p]));

  const result = seasons
    .filter((s) => s.awards.length > 0)
    .map((s) => ({
      seasonId: s.id,
      seasonNumber: s.number,
      awards: s.awards.map((a) => {
        const player = playerMap.get(a.playerId);
        return {
          id: a.id,
          awardType: a.awardType,
          stat: a.stat,
          value: a.value,
          playerId: a.playerId,
          nickname:
            player?.fakeNickname || player?.user.nickname || "Unknown",
          avatarUrl: player?.user.avatarUrl || player?.user.image || null,
        };
      }),
    }));

  return NextResponse.json(result);
}

import { prisma } from "./prisma";

/**
 * For test leagues, verify that the current user (commissioner) is allowed
 * to act as the given leaguePlayerId. Returns the player if allowed, null otherwise.
 */
export async function resolveTestPlayer(
  leaguePlayerId: string,
  sessionUserId: string
): Promise<{ id: string; userId: string; leagueId: string } | null> {
  if (process.env.NODE_ENV !== "development") return null;

  const player = await prisma.leaguePlayer.findUnique({
    where: { id: leaguePlayerId },
    include: {
      league: {
        include: {
          players: {
            where: { userId: sessionUserId, role: "commissioner", isActive: true },
          },
        },
      },
    },
  });

  if (!player) return null;
  if (player.league.type !== "test") return null;
  // Verify the session user is the commissioner of this test league
  if (player.league.players.length === 0) return null;

  return { id: player.id, userId: player.userId, leagueId: player.leagueId };
}

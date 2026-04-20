import { prisma } from "@/lib/prisma";

/**
 * Manually cascades all league-scoped data before deleting the league itself.
 * The Prisma schema has several relations without `onDelete: Cascade`
 * (Question.roundId, RoundAnswer.questionId/leaguePlayerId/userId, FlagReview.flaggedById,
 * FlagVote.leaguePlayerId), so a bare `league.delete` is rejected by Postgres
 * when those rows exist. This helper wipes them in dependency order inside one
 * transaction.
 */
export async function deleteLeagueCascade(leagueId: string): Promise<void> {
  const seasons = await prisma.season.findMany({
    where: { leagueId },
    select: { id: true },
  });
  const seasonIds = seasons.map((s) => s.id);

  const games = seasonIds.length
    ? await prisma.game.findMany({
        where: { seasonId: { in: seasonIds } },
        select: { id: true },
      })
    : [];
  const gameIds = games.map((g) => g.id);

  const rounds = gameIds.length
    ? await prisma.round.findMany({
        where: { gameId: { in: gameIds } },
        select: { id: true },
      })
    : [];
  const roundIds = rounds.map((r) => r.id);

  const players = await prisma.leaguePlayer.findMany({
    where: { leagueId },
    select: { id: true },
  });
  const playerIds = players.map((p) => p.id);

  await prisma.$transaction(async (tx) => {
    if (roundIds.length) {
      await tx.roundAnswer.deleteMany({ where: { roundId: { in: roundIds } } });
      await tx.flagVote.deleteMany({
        where: { flagReview: { roundId: { in: roundIds } } },
      });
      await tx.flagReview.deleteMany({ where: { roundId: { in: roundIds } } });
      await tx.question.deleteMany({ where: { roundId: { in: roundIds } } });
      await tx.round.deleteMany({ where: { id: { in: roundIds } } });
    }

    if (playerIds.length) {
      // Any drafts / questions authored by league players that never reached a round
      await tx.question.deleteMany({
        where: { leaguePlayerId: { in: playerIds } },
      });
    }

    if (gameIds.length) {
      await tx.battingOrderEntry.deleteMany({
        where: { gameId: { in: gameIds } },
      });
      await tx.gamePlayerState.deleteMany({
        where: { gameId: { in: gameIds } },
      });
      await tx.game.deleteMany({ where: { id: { in: gameIds } } });
    }

    if (seasonIds.length) {
      await tx.seasonAward.deleteMany({
        where: { seasonId: { in: seasonIds } },
      });
      await tx.season.deleteMany({ where: { id: { in: seasonIds } } });
    }

    await tx.notification.deleteMany({ where: { leagueId } });
    await tx.shareableLink.deleteMany({ where: { leagueId } });
    await tx.leagueCategory.deleteMany({ where: { leagueId } });
    await tx.leaguePlayer.deleteMany({ where: { leagueId } });
    await tx.league.delete({ where: { id: leagueId } });
  });
}

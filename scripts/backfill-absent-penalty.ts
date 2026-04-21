/**
 * Backfill for the absentee-penalty bug (introduced 2026-04-17, fixed 2026-04-21).
 *
 * For each RoundAnswer where isAbsent=true, pointsWon=0, round.status=graded,
 * round.updatedAt >= 2026-04-17:
 *   1. Compute the penalty using the same formula closeRound would have used.
 *   2. Update RoundAnswer.pointsWon to -penalty (scorecard correctness).
 *   3. Subtract penalty from GamePlayerState.points, floored at 1 (never
 *      retroactively eliminate a player who has played subsequent rounds).
 *
 * Default: dry-run. Pass --apply to execute.
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const BUG_START = new Date("2026-04-17T00:00:00Z");
const APPLY = process.argv.includes("--apply");

function calculateAbsenteePenalty(currentPoints: number, remainingRounds: number): number {
  if (remainingRounds <= 0 || currentPoints <= 0) return 0;
  const penalty = Math.floor(currentPoints / remainingRounds);
  const maxPenalty = Math.floor(currentPoints * 0.5);
  return Math.max(1, Math.min(penalty, maxPenalty));
}

async function main() {
  console.log(`Mode: ${APPLY ? "APPLY" : "DRY RUN"}\n`);

  const candidates = await prisma.roundAnswer.findMany({
    where: {
      isAbsent: true,
      pointsWon: 0,
      round: { status: "graded", updatedAt: { gte: BUG_START } },
    },
    include: {
      leaguePlayer: { include: { user: { select: { nickname: true } } } },
      round: {
        select: {
          id: true,
          number: true,
          gameId: true,
          game: {
            select: {
              id: true,
              status: true,
              season: { select: { league: { select: { name: true } } } },
              rounds: { select: { id: true, number: true, isCancelled: true, status: true } },
            },
          },
        },
      },
    },
    orderBy: [{ round: { updatedAt: "asc" } }],
  });

  console.log(`Found ${candidates.length} candidate rows.\n`);

  const STARTING_POINTS = 20;
  type Plan = {
    league: string;
    game: string;
    gameStatus: string;
    round: number;
    player: string;
    answerId: string;
    leaguePlayerId: string;
    gameId: string;
    pointsAtClose: number;
    penalty: number;
    currentPoints: number;
    newPoints: number;
    newPointsWon: number;
  };
  const plans: Plan[] = [];

  for (const a of candidates) {
    const prev = await prisma.roundAnswer.findMany({
      where: {
        leaguePlayerId: a.leaguePlayerId,
        round: { gameId: a.round.gameId, number: { lt: a.round.number } },
      },
      select: { pointsWon: true, powerUpCost: true },
    });
    const pointsAtClose = Math.max(
      0,
      STARTING_POINTS + prev.reduce((s, p) => s + (p.pointsWon ?? 0) - (p.powerUpCost ?? 0), 0),
    );

    const remaining = a.round.game.rounds.filter(
      (r) => !r.isCancelled && r.status !== "graded" && r.number > a.round.number,
    ).length;
    const penalty = calculateAbsenteePenalty(pointsAtClose, Math.max(remaining, 1));

    if (penalty === 0) continue; // no-op rows

    const ps = await prisma.gamePlayerState.findUnique({
      where: {
        gameId_leaguePlayerId: {
          gameId: a.round.gameId,
          leaguePlayerId: a.leaguePlayerId,
        },
      },
      select: { points: true },
    });
    const current = ps?.points ?? 0;
    // Floor at 1 so we don't retroactively eliminate a player who has been
    // playing subsequent rounds. If the game is completed, we still use floor
    // 1 for consistency — no current completed games have non-zero penalty.
    const newPoints = Math.max(1, current - penalty);

    plans.push({
      league: a.round.game.season.league.name,
      game: a.round.gameId.slice(0, 8),
      gameStatus: a.round.game.status,
      round: a.round.number,
      player: a.leaguePlayer.fakeNickname ?? a.leaguePlayer.user.nickname ?? "?",
      answerId: a.id,
      leaguePlayerId: a.leaguePlayerId,
      gameId: a.round.gameId,
      pointsAtClose,
      penalty,
      currentPoints: current,
      newPoints,
      newPointsWon: -penalty,
    });
  }

  console.table(
    plans.map((p) => ({
      league: p.league,
      game: p.game,
      status: p.gameStatus,
      round: p.round,
      player: p.player,
      penalty: p.penalty,
      current: p.currentPoints,
      newPoints: p.newPoints,
      pointsWon: p.newPointsWon,
    })),
  );

  if (!APPLY) {
    console.log("\nDry run — no changes written. Re-run with --apply to execute.");
    await prisma.$disconnect();
    return;
  }

  // Apply each plan in a transaction per row so a failure can't leave a row
  // with pointsWon updated but player state not (or vice versa).
  let applied = 0;
  for (const p of plans) {
    await prisma.$transaction([
      prisma.roundAnswer.update({
        where: { id: p.answerId },
        data: { pointsWon: p.newPointsWon },
      }),
      prisma.gamePlayerState.update({
        where: {
          gameId_leaguePlayerId: {
            gameId: p.gameId,
            leaguePlayerId: p.leaguePlayerId,
          },
        },
        data: { points: p.newPoints, isEliminated: p.newPoints === 0 },
      }),
    ]);
    applied++;
    console.log(
      `✓ ${p.league}/${p.player} r${p.round}: pointsWon=${p.newPointsWon}, points ${p.currentPoints}→${p.newPoints}`,
    );
  }

  console.log(`\nApplied ${applied} row(s).`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

/**
 * READ-ONLY survey: find RoundAnswers that got stuck at pointsWon=0 because
 * of the pre-upsert bug (fixed 2026-04-21). Scope: graded rounds closed on or
 * after 2026-04-17 (when the 24hr rule landed).
 *
 * For each affected row, computes what the penalty *should* have been using
 * the same formula as calculateAbsenteePenalty, using the player's points
 * as of that round's close.
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const BUG_START = new Date("2026-04-17T00:00:00Z");

function calculateAbsenteePenalty(currentPoints: number, remainingRounds: number): number {
  if (remainingRounds <= 0 || currentPoints <= 0) return 0;
  const penalty = Math.floor(currentPoints / remainingRounds);
  const maxPenalty = Math.floor(currentPoints * 0.5);
  return Math.min(penalty, maxPenalty);
}

async function main() {
  // Candidate absent rows: isAbsent=true, pointsWon=0, on rounds graded since the bug landed.
  const candidates = await prisma.roundAnswer.findMany({
    where: {
      isAbsent: true,
      pointsWon: 0,
      round: {
        status: "graded",
        updatedAt: { gte: BUG_START },
      },
    },
    include: {
      leaguePlayer: {
        include: { user: { select: { nickname: true } } },
      },
      round: {
        select: {
          id: true,
          number: true,
          updatedAt: true,
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

  console.log(`Found ${candidates.length} candidate absent rows with pointsWon=0 since ${BUG_START.toISOString()}\n`);

  type Row = {
    league: string;
    gameId: string;
    gameStatus: string;
    round: number;
    roundId: string;
    closedAt: string;
    player: string;
    leaguePlayerId: string;
    pointsAtClose: number;
    currentPoints: number;
    remainingAtClose: number;
    estimatedPenalty: number;
  };

  const rows: Row[] = [];

  for (const a of candidates) {
    // Player state (for current points / elimination)
    const ps = await prisma.gamePlayerState.findUnique({
      where: {
        gameId_leaguePlayerId: {
          gameId: a.round.gameId,
          leaguePlayerId: a.leaguePlayerId,
        },
      },
      select: { points: true, isEliminated: true },
    });

    // Reconstruct points at the time this round closed: STARTING_POINTS + sum
    // of pointsWon minus powerUpCost for all earlier rounds in this game.
    const prevAnswers = await prisma.roundAnswer.findMany({
      where: {
        leaguePlayerId: a.leaguePlayerId,
        round: { gameId: a.round.gameId, number: { lt: a.round.number } },
      },
      select: { pointsWon: true, powerUpCost: true },
    });
    const STARTING_POINTS = 20;
    const pointsAtClose = Math.max(
      0,
      STARTING_POINTS +
        prevAnswers.reduce((s, p) => s + (p.pointsWon ?? 0) - (p.powerUpCost ?? 0), 0),
    );

    // remainingRounds: rounds not cancelled, not yet graded, excluding this one.
    // At time of close we don't have that snapshot, so approximate with current
    // state: rounds with status != graded, not cancelled, number > this one.
    const remaining = a.round.game.rounds.filter(
      (r) => !r.isCancelled && r.status !== "graded" && r.number > a.round.number,
    ).length;
    const remainingAtClose = Math.max(remaining, 1);

    const penalty = calculateAbsenteePenalty(pointsAtClose, remainingAtClose);

    rows.push({
      league: a.round.game.season.league.name,
      gameId: a.round.gameId,
      gameStatus: a.round.game.status,
      round: a.round.number,
      roundId: a.round.id,
      closedAt: a.round.updatedAt.toISOString(),
      player: a.leaguePlayer.fakeNickname ?? a.leaguePlayer.user.nickname ?? "?",
      leaguePlayerId: a.leaguePlayerId,
      pointsAtClose,
      currentPoints: ps?.points ?? -1,
      remainingAtClose,
      estimatedPenalty: penalty,
    });
  }

  console.table(rows);

  // Aggregate summary
  const byPlayer = new Map<string, { player: string; league: string; game: string; totalPenalty: number; count: number }>();
  for (const r of rows) {
    const key = `${r.gameId}:${r.leaguePlayerId}`;
    const existing = byPlayer.get(key);
    if (existing) {
      existing.totalPenalty += r.estimatedPenalty;
      existing.count += 1;
    } else {
      byPlayer.set(key, {
        player: r.player,
        league: r.league,
        game: r.gameId.slice(0, 8),
        totalPenalty: r.estimatedPenalty,
        count: 1,
      });
    }
  }

  console.log("\nPer-player totals:");
  console.table(Array.from(byPlayer.values()));

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

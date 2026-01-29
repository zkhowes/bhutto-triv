import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const leagueId = params.id;

  // Get all players in league
  const players = await prisma.leaguePlayer.findMany({
    where: { leagueId },
    include: {
      user: {
        select: { nickname: true, avatarUrl: true, image: true },
      },
    },
  });

  // Get all round answers for this league
  const answers = await prisma.roundAnswer.findMany({
    where: {
      round: {
        game: {
          season: { leagueId },
        },
      },
    },
    include: {
      round: {
        include: {
          question: { select: { category: true } },
          game: {
            include: { season: true },
          },
        },
      },
    },
  });

  // Get all game player states
  const gameStates = await prisma.gamePlayerState.findMany({
    where: {
      game: {
        season: { leagueId },
      },
    },
    include: {
      game: true,
    },
  });

  // Calculate stats per player
  const stats = players.map((player) => {
    const playerAnswers = answers.filter(
      (a) => a.leaguePlayerId === player.id
    );
    const playerGameStates = gameStates.filter(
      (gs) => gs.leaguePlayerId === player.id
    );

    const totalAnswers = playerAnswers.length;
    const correctAnswers = playerAnswers.filter((a) => a.isCorrect).length;
    const totalRoundsPlayed = playerAnswers.filter((a) => !a.isAbsent).length;
    const totalBet = playerAnswers.reduce(
      (sum, a) => sum + (a.betAmount || 0),
      0
    );
    const totalWon = playerAnswers.reduce(
      (sum, a) => sum + (a.pointsWon > 0 ? a.pointsWon : 0),
      0
    );
    const totalF1 = playerGameStates.reduce(
      (sum, gs) => sum + gs.totalF1Points,
      0
    );

    // Calculate per-category stats
    const categoryStats: Record<
      string,
      { total: number; correct: number }
    > = {};
    playerAnswers.forEach((a) => {
      const cat = a.round.question?.category || "Unknown";
      if (!categoryStats[cat]) categoryStats[cat] = { total: 0, correct: 0 };
      categoryStats[cat].total++;
      if (a.isCorrect) categoryStats[cat].correct++;
    });

    // Best category
    let bestCategory = "N/A";
    let bestCategoryPct = 0;
    Object.entries(categoryStats).forEach(([cat, stat]) => {
      const pct = stat.total > 0 ? stat.correct / stat.total : 0;
      if (pct > bestCategoryPct && stat.total >= 2) {
        bestCategoryPct = pct;
        bestCategory = cat;
      }
    });

    // Most used category (for question creators)
    const createdQuestions = answers.filter(
      (a) =>
        a.round.question &&
        a.round.atBatPlayerId === player.id
    );
    const categoryCount: Record<string, number> = {};
    createdQuestions.forEach((a) => {
      const cat = a.round.question?.category || "Unknown";
      categoryCount[cat] = (categoryCount[cat] || 0) + 1;
    });
    const mostUsedCategory =
      Object.entries(categoryCount).sort((a, b) => b[1] - a[1])[0]?.[0] ||
      "N/A";

    // All-in stats
    const allInBets = playerAnswers.filter(
      (a) => a.betAmount && a.betAmount > 0
    );
    const allInWins = allInBets.filter((a) => a.isCorrect).length;
    const clutchFactor =
      allInBets.length > 0 ? allInWins / allInBets.length : 0;

    // Consecutive correct streak
    let maxStreak = 0;
    let currentStreak = 0;
    const sortedAnswers = [...playerAnswers].sort(
      (a, b) =>
        (a.answeredAt?.getTime() || 0) - (b.answeredAt?.getTime() || 0)
    );
    sortedAnswers.forEach((a) => {
      if (a.isCorrect) {
        currentStreak++;
        maxStreak = Math.max(maxStreak, currentStreak);
      } else {
        currentStreak = 0;
      }
    });

    // Iron man streak (no misses)
    let ironManStreak = 0;
    let currentIronMan = 0;
    sortedAnswers.forEach((a) => {
      if (!a.isAbsent) {
        currentIronMan++;
        ironManStreak = Math.max(ironManStreak, currentIronMan);
      } else {
        currentIronMan = 0;
      }
    });

    // Average bet size
    const avgBet =
      totalRoundsPlayed > 0
        ? totalBet / totalRoundsPlayed
        : 0;

    // Placements
    const placements = playerAnswers
      .filter((a) => a.placement)
      .map((a) => a.placement!);
    const avgPlacement =
      placements.length > 0
        ? placements.reduce((a, b) => a + b, 0) / placements.length
        : 0;
    const bestPlacement =
      placements.length > 0 ? Math.min(...placements) : null;

    // Consistency (std dev of placements)
    const variance =
      placements.length > 1
        ? placements.reduce(
            (sum, p) => sum + Math.pow(p - avgPlacement, 2),
            0
          ) / placements.length
        : 0;
    const consistency = Math.sqrt(variance);

    // Perfect rounds
    const perfectRounds = playerAnswers.filter(
      (a) => a.isCorrect && a.placement === 1
    ).length;

    // Best single game F1 points
    const bestGamePoints =
      playerGameStates.length > 0
        ? Math.max(...playerGameStates.map((gs) => gs.totalF1Points))
        : 0;

    // Highest single round score
    const highestRoundScore =
      playerAnswers.length > 0
        ? Math.max(...playerAnswers.map((a) => a.f1Points))
        : 0;

    return {
      playerId: player.id,
      nickname:
        player.fakeNickname ||
        player.user.nickname ||
        "Unknown",
      avatarUrl: player.user.avatarUrl || player.user.image,
      totalF1Points: totalF1,
      totalGames: playerGameStates.length,
      totalRoundsPlayed,
      correctAnswers,
      totalAnswers,
      correctPct:
        totalAnswers > 0 ? correctAnswers / totalAnswers : 0,
      avgPlacement,
      bestPlacement,
      bestCategory,
      bestCategoryPct,
      mostUsedCategory,
      clutchFactor,
      consistency,
      maxStreak,
      ironManStreak,
      avgBet,
      perfectRounds,
      bestGamePoints,
      highestRoundScore,
      totalWon,
      riskProfile: avgBet,
    };
  });

  // Sort by total F1 points
  stats.sort((a, b) => b.totalF1Points - a.totalF1Points);

  return NextResponse.json(stats);
}

import { prisma } from "./prisma";

interface PlayerSeasonStats {
  leaguePlayerId: string;
  totalF1Points: number;
  totalGamesPlayed: number;
  totalCorrect: number;
  totalAnswered: number;
  totalAbsent: number;
  totalBet: number;
  totalWon: number;
  avgPlacement: number;
  allInBets: number;
  allInWins: number;
  avgBet: number;
  isFirstSeason: boolean;
  prevSeasonAvgPlacement: number | null;
  prevSeasonTotalPoints: number | null;
}

export async function generateSeasonAwards(seasonId: string): Promise<void> {
  const season = await prisma.season.findUnique({
    where: { id: seasonId },
    include: {
      league: {
        include: {
          players: { where: { isActive: true } },
          seasons: {
            where: { status: "completed" },
            orderBy: { number: "desc" },
          },
        },
      },
      games: {
        include: {
          playerStates: true,
          rounds: {
            include: {
              answers: true,
            },
          },
        },
      },
    },
  });

  if (!season) return;

  const prevSeason = season.league.seasons.find(
    (s) => s.number === season.number - 1
  );

  // Collect stats per player
  const playerStats: Map<string, PlayerSeasonStats> = new Map();

  for (const player of season.league.players) {
    const stats: PlayerSeasonStats = {
      leaguePlayerId: player.id,
      totalF1Points: 0,
      totalGamesPlayed: 0,
      totalCorrect: 0,
      totalAnswered: 0,
      totalAbsent: 0,
      totalBet: 0,
      totalWon: 0,
      avgPlacement: 0,
      allInBets: 0,
      allInWins: 0,
      avgBet: 0,
      isFirstSeason: !prevSeason,
      prevSeasonAvgPlacement: null,
      prevSeasonTotalPoints: null,
    };

    let placementSum = 0;
    let placementCount = 0;

    for (const game of season.games) {
      const gs = game.playerStates.find(
        (ps) => ps.leaguePlayerId === player.id
      );
      if (gs) {
        stats.totalGamesPlayed++;
        stats.totalF1Points += gs.totalF1Points;
      }

      for (const round of game.rounds) {
        const answer = round.answers.find(
          (a) => a.leaguePlayerId === player.id
        );
        if (answer) {
          stats.totalAnswered++;
          if (answer.isCorrect) stats.totalCorrect++;
          if (answer.isAbsent) stats.totalAbsent++;
          stats.totalBet += answer.betAmount || 0;
          if (answer.pointsWon > 0) stats.totalWon += answer.pointsWon;
          if (answer.placement) {
            placementSum += answer.placement;
            placementCount++;
          }

          // Track big bets (all-in or > 50% of starting points)
          if (answer.betAmount && answer.betAmount >= 10) {
            stats.allInBets++;
            if (answer.isCorrect) stats.allInWins++;
          }
        }
      }
    }

    stats.avgPlacement = placementCount > 0 ? placementSum / placementCount : 0;
    stats.avgBet =
      stats.totalAnswered > 0 ? stats.totalBet / stats.totalAnswered : 0;

    // Get previous season stats if available
    if (prevSeason) {
      const prevGames = await prisma.game.findMany({
        where: { seasonId: prevSeason.id },
        include: {
          playerStates: {
            where: { leaguePlayerId: player.id },
          },
          rounds: {
            include: {
              answers: {
                where: { leaguePlayerId: player.id },
              },
            },
          },
        },
      });

      if (prevGames.length > 0) {
        let prevPlacementSum = 0;
        let prevPlacementCount = 0;
        let prevTotalPoints = 0;

        for (const game of prevGames) {
          const gs = game.playerStates[0];
          if (gs) prevTotalPoints += gs.totalF1Points;

          for (const round of game.rounds) {
            const answer = round.answers[0];
            if (answer?.placement) {
              prevPlacementSum += answer.placement;
              prevPlacementCount++;
            }
          }
        }

        stats.prevSeasonAvgPlacement =
          prevPlacementCount > 0 ? prevPlacementSum / prevPlacementCount : null;
        stats.prevSeasonTotalPoints = prevTotalPoints;
        stats.isFirstSeason = false;
      } else {
        stats.isFirstSeason = true;
      }
    }

    playerStats.set(player.id, stats);
  }

  const allStats = Array.from(playerStats.values());
  if (allStats.length === 0) return;

  // Generate awards
  const awards: Array<{
    awardType: string;
    playerId: string;
    stat: string;
    value: number;
  }> = [];

  // MVP - Most total F1 points
  const mvp = allStats.reduce((best, s) =>
    s.totalF1Points > best.totalF1Points ? s : best
  );
  awards.push({
    awardType: "mvp",
    playerId: mvp.leaguePlayerId,
    stat: `${mvp.totalF1Points} total points`,
    value: mvp.totalF1Points,
  });

  // Iron Man - Perfect attendance
  const ironMan = allStats.reduce((best, s) =>
    s.totalAbsent < best.totalAbsent ? s : best
  );
  const attendance =
    ironMan.totalAnswered > 0
      ? Math.round(
          ((ironMan.totalAnswered - ironMan.totalAbsent) /
            ironMan.totalAnswered) *
            100
        )
      : 0;
  awards.push({
    awardType: "iron_man",
    playerId: ironMan.leaguePlayerId,
    stat: `${attendance}% attendance`,
    value: attendance,
  });

  // Offensive Player - Biggest bets + wins
  const offensive = allStats
    .filter((s) => s.totalAnswered > 0)
    .reduce((best, s) => {
      const score = s.avgBet * (s.totalCorrect / Math.max(s.totalAnswered, 1));
      const bestScore =
        best.avgBet * (best.totalCorrect / Math.max(best.totalAnswered, 1));
      return score > bestScore ? s : best;
    });
  awards.push({
    awardType: "offensive",
    playerId: offensive.leaguePlayerId,
    stat: `Avg bet: ${Math.round(offensive.avgBet)}, ${offensive.totalCorrect} wins`,
    value: offensive.avgBet,
  });

  // Defensive Player - Smallest bets + wins
  const defensive = allStats
    .filter((s) => s.totalAnswered > 0 && s.avgBet > 0)
    .reduce((best, s) => {
      const winRate = s.totalCorrect / Math.max(s.totalAnswered, 1);
      const bestWinRate = best.totalCorrect / Math.max(best.totalAnswered, 1);
      if (winRate > 0.5 && s.avgBet < best.avgBet) return s;
      if (winRate > bestWinRate && s.avgBet <= best.avgBet) return s;
      return best;
    });
  awards.push({
    awardType: "defensive",
    playerId: defensive.leaguePlayerId,
    stat: `Avg bet: ${Math.round(defensive.avgBet)}, ${Math.round((defensive.totalCorrect / Math.max(defensive.totalAnswered, 1)) * 100)}% win rate`,
    value: defensive.avgBet,
  });

  // Clutch Player - All-in win percentage
  const clutchPlayers = allStats.filter((s) => s.allInBets > 0);
  if (clutchPlayers.length > 0) {
    const clutch = clutchPlayers.reduce((best, s) => {
      const pct = s.allInWins / s.allInBets;
      const bestPct = best.allInWins / best.allInBets;
      return pct > bestPct ? s : best;
    });
    const clutchPct = Math.round((clutch.allInWins / clutch.allInBets) * 100);
    awards.push({
      awardType: "clutch",
      playerId: clutch.leaguePlayerId,
      stat: `${clutchPct}% big bet win rate`,
      value: clutchPct,
    });
  }

  // Strategist - Best risk/reward ratio
  const strategist = allStats
    .filter((s) => s.totalBet > 0)
    .reduce((best, s) => {
      const ratio = s.totalWon / Math.max(s.totalBet, 1);
      const bestRatio = best.totalWon / Math.max(best.totalBet, 1);
      return ratio > bestRatio ? s : best;
    });
  const ratioVal = Math.round(
    (strategist.totalWon / Math.max(strategist.totalBet, 1)) * 100
  );
  awards.push({
    awardType: "strategist",
    playerId: strategist.leaguePlayerId,
    stat: `${ratioVal}% return on wagers`,
    value: ratioVal,
  });

  // Comeback / Most Improved (requires previous season)
  const withPrevSeason = allStats.filter(
    (s) => s.prevSeasonAvgPlacement !== null
  );
  if (withPrevSeason.length > 0) {
    const comeback = withPrevSeason.reduce((best, s) => {
      const improvement =
        (s.prevSeasonAvgPlacement || 0) - s.avgPlacement;
      const bestImprovement =
        (best.prevSeasonAvgPlacement || 0) - best.avgPlacement;
      return improvement > bestImprovement ? s : best;
    });
    const improvementVal = Math.round(
      ((comeback.prevSeasonAvgPlacement || 0) - comeback.avgPlacement) * 10
    ) / 10;
    awards.push({
      awardType: "comeback",
      playerId: comeback.leaguePlayerId,
      stat: `Improved placement by ${improvementVal} positions`,
      value: improvementVal,
    });

    awards.push({
      awardType: "most_improved",
      playerId: comeback.leaguePlayerId,
      stat: `From avg #${Math.round((comeback.prevSeasonAvgPlacement || 0) * 10) / 10} to #${Math.round(comeback.avgPlacement * 10) / 10}`,
      value: improvementVal,
    });
  }

  // Rookie of the Year
  const rookies = allStats.filter((s) => s.isFirstSeason);
  if (rookies.length > 0) {
    const rookie = rookies.reduce((best, s) =>
      s.totalF1Points > best.totalF1Points ? s : best
    );
    awards.push({
      awardType: "rookie",
      playerId: rookie.leaguePlayerId,
      stat: `${rookie.totalF1Points} points in first season`,
      value: rookie.totalF1Points,
    });
  }

  // Save awards to database
  for (const award of awards) {
    await prisma.seasonAward.create({
      data: {
        seasonId,
        awardType: award.awardType,
        playerId: award.playerId,
        stat: award.stat,
        value: award.value,
      },
    });
  }
}

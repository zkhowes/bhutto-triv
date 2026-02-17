import { F1_POINTS_SCALE } from "./constants";

interface PlayerRoundResult {
  leaguePlayerId: string;
  isCorrect: boolean;
  betAmount: number;
  answeredAt: Date | null;
  isAbsent: boolean;
  nickname: string;
}

interface ScoredResult {
  leaguePlayerId: string;
  placement: number;
  f1Points: number;
  pointsWon: number;
  fastestLap: boolean;
}

/**
 * Calculate F1 placement points scaled for league size
 */
export function getF1PointsForPlacement(
  placement: number,
  totalPlayers: number
): number {
  if (totalPlayers <= 1) return 25;

  // For leagues smaller than 10, we select positions from the F1 scale
  // e.g., 6 players: positions map to indices 0,1,2,3,4,7 (skip some middle)
  const scale = getScaledF1Points(totalPlayers);
  if (placement < 1 || placement > scale.length) return 0;
  return scale[placement - 1];
}

function getScaledF1Points(playerCount: number): number[] {
  if (playerCount >= 10) return F1_POINTS_SCALE;

  // For smaller leagues, take the top N scores from the full scale
  // but ensure last place gets minimum points
  const result: number[] = [];
  const fullScale = F1_POINTS_SCALE;

  if (playerCount <= 0) return [];

  // First place always gets 25
  result.push(fullScale[0]);

  if (playerCount === 1) return result;

  // Last place gets 1 point for 2 players, scales up
  // Distribute remaining positions evenly across the middle
  const lastPoints =
    playerCount <= 3 ? fullScale[playerCount - 1] : fullScale[playerCount - 1];

  if (playerCount === 2) {
    result.push(lastPoints);
    return result;
  }

  // For 3-9 players, map positions to the scale
  for (let i = 1; i < playerCount - 1; i++) {
    result.push(fullScale[i]);
  }
  result.push(lastPoints);

  return result;
}

/**
 * Score a round: determine placements, F1 points, fastest lap
 */
export function scoreRound(results: PlayerRoundResult[]): ScoredResult[] {
  // Sort players for placement:
  // 1. Correct answers first
  // 2. Among correct: higher bet = better
  // 3. Among same bet: earlier answer = better
  // 4. Among absent/wrong: lower losses (smaller bets)
  // 5. Final tiebreaker: alphabetical nickname

  const sorted = [...results].sort((a, b) => {
    // Absent players go last
    if (a.isAbsent && !b.isAbsent) return 1;
    if (!a.isAbsent && b.isAbsent) return -1;
    if (a.isAbsent && b.isAbsent) return a.nickname.localeCompare(b.nickname);

    // Correct answers ranked above incorrect
    if (a.isCorrect && !b.isCorrect) return -1;
    if (!a.isCorrect && b.isCorrect) return 1;

    if (a.isCorrect && b.isCorrect) {
      // Both correct: higher bet wins more, so rank higher
      if (a.betAmount !== b.betAmount) return b.betAmount - a.betAmount;
      // Same bet: faster answer ranks higher
      if (a.answeredAt && b.answeredAt) {
        return a.answeredAt.getTime() - b.answeredAt.getTime();
      }
      if (a.answeredAt && !b.answeredAt) return -1;
      if (!a.answeredAt && b.answeredAt) return 1;
      return a.nickname.localeCompare(b.nickname);
    }

    // Both incorrect: smaller bet = less loss = better placement
    if (a.betAmount !== b.betAmount) return a.betAmount - b.betAmount;
    return a.nickname.localeCompare(b.nickname);
  });

  const totalPlayers = results.length;

  // Determine fastest lap
  // Player with highest wager who answered correctly, with fastest time as tiebreaker
  let fastestLapPlayerId: string | null = null;
  const correctAnswers = results.filter((r) => r.isCorrect && !r.isAbsent);
  if (correctAnswers.length > 0) {
    const maxBet = Math.max(...correctAnswers.map((r) => r.betAmount));
    const maxBetPlayers = correctAnswers.filter(
      (r) => r.betAmount === maxBet
    );
    if (maxBetPlayers.length === 1) {
      fastestLapPlayerId = maxBetPlayers[0].leaguePlayerId;
    } else {
      // Tie on wager: fastest timestamp wins
      const withTimestamps = maxBetPlayers.filter((r) => r.answeredAt);
      if (withTimestamps.length > 0) {
        withTimestamps.sort(
          (a, b) => a.answeredAt!.getTime() - b.answeredAt!.getTime()
        );
        fastestLapPlayerId = withTimestamps[0].leaguePlayerId;
      } else {
        fastestLapPlayerId = maxBetPlayers[0].leaguePlayerId;
      }
    }
  }

  return sorted.map((player, index) => {
    const placement = index + 1;
    const f1Points =
      getF1PointsForPlacement(placement, totalPlayers) +
      (player.leaguePlayerId === fastestLapPlayerId ? 1 : 0);
    const pointsWon = player.isAbsent
      ? 0
      : player.isCorrect
        ? player.betAmount
        : -player.betAmount;

    return {
      leaguePlayerId: player.leaguePlayerId,
      placement,
      f1Points,
      pointsWon,
      fastestLap: player.leaguePlayerId === fastestLapPlayerId,
    };
  });
}

/**
 * Calculate absentee penalty for missing a bet/answer
 */
export function calculateAbsenteePenalty(
  currentPoints: number,
  remainingRounds: number
): number {
  if (remainingRounds <= 0 || currentPoints <= 0) return 0;
  return Math.floor(currentPoints / remainingRounds);
}


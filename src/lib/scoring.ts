import { F1_POINTS_SCALE } from "./constants";

interface PlayerRoundResult {
  leaguePlayerId: string;
  isCorrect: boolean;
  betAmount: number;
  answeredAt: Date | null;
  isAbsent: boolean;
  isEliminated?: boolean; // Busted players are excluded from placement and F1 scoring
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
    // Absent and busted (eliminated) players go last — they don't compete for placement
    const aOut = a.isAbsent || !!a.isEliminated;
    const bOut = b.isAbsent || !!b.isEliminated;
    if (aOut && !bOut) return 1;
    if (!aOut && bOut) return -1;
    if (aOut && bOut) return a.nickname.localeCompare(b.nickname);

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
  // Player with highest wager who answered correctly, with fastest time as tiebreaker.
  // Busted players don't compete for fastest lap (no bet, no F1 points).
  let fastestLapPlayerId: string | null = null;
  const correctAnswers = results.filter((r) => r.isCorrect && !r.isAbsent && !r.isEliminated);
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
    const isOut = player.isAbsent || !!player.isEliminated;
    const f1Points = isOut
      ? 0
      : getF1PointsForPlacement(placement, totalPlayers) +
        (player.leaguePlayerId === fastestLapPlayerId ? 1 : 0);
    const pointsWon = isOut
      ? 0
      : player.isCorrect
        ? player.betAmount
        : -player.betAmount;

    return {
      leaguePlayerId: player.leaguePlayerId,
      placement,
      f1Points,
      pointsWon,
      fastestLap: !isOut && player.leaguePlayerId === fastestLapPlayerId,
    };
  });
}

/**
 * Compute power-up cost for a player based on parity ranking.
 * Poorest active player pays 1 pt, richest pays 8 pts.
 */
export function computePowerUpCost(
  playerPoints: number,
  allActivePoints: number[]
): number {
  if (allActivePoints.length === 0) return 1;
  const sorted = [...allActivePoints].sort((a, b) => a - b);
  // rank = number of players with points <= player (0-indexed)
  const rank = sorted.filter((p) => p <= playerPoints).length - 1;
  const ratio = sorted.length > 1 ? rank / (sorted.length - 1) : 0;
  return Math.max(1, Math.ceil(1 + 7 * ratio)); // 1–8 pts
}

/**
 * Determine Closest-Guess winners (formerly Price is Right).
 * Rules:
 *   1. Closest guess by absolute distance wins (over or under both fine).
 *   2. All ties at the minimum distance win.
 * Returns the Set of winner IDs.
 */
export function determinePirWinners(
  target: number,
  guesses: Array<{ id: string; value: number }>
): Set<string> {
  const winnerIds = new Set<string>();
  if (isNaN(target) || guesses.length === 0) return winnerIds;

  let minDistance = Infinity;
  for (const g of guesses) {
    const d = Math.abs(g.value - target);
    if (d < minDistance) minDistance = d;
  }

  // Tolerance handles floating-point noise (e.g. |3.14 - 3.13| vs |3.15 - 3.14|),
  // and accepts user-intent ties when the magnitudes are similar.
  const tolerance = Math.max(1e-9, Math.abs(minDistance) * 1e-9);
  for (const g of guesses) {
    if (Math.abs(g.value - target) - minDistance <= tolerance) winnerIds.add(g.id);
  }

  return winnerIds;
}

/**
 * Compare two ordering values. Numeric strings sort numerically; everything
 * else falls back to localeCompare. Mirrors the helper in ai.ts.
 */
function compareOrderingValues(a: string | number, b: string | number): number {
  const aNum = typeof a === "number" ? a : Number(a);
  const bNum = typeof b === "number" ? b : Number(b);
  if (!isNaN(aNum) && !isNaN(bNum)) return aNum - bNum;
  return String(a).localeCompare(String(b));
}

/**
 * Classify an ordering direction string as ascending, descending, or neither
 * based on common phrasings. Returns null when phrasing is unrecognized.
 */
export function classifyOrderingDirection(
  direction: string | null | undefined
): "ascending" | "descending" | null {
  if (!direction) return null;
  const dir = direction.toLowerCase();
  if (
    dir.includes("earliest to latest") ||
    dir.includes("oldest to newest") ||
    dir.includes("least to most") ||
    dir.includes("smallest to largest") ||
    dir.includes("lowest to highest") ||
    dir.includes("shortest to longest")
  ) return "ascending";
  if (
    dir.includes("latest to earliest") ||
    dir.includes("newest to oldest") ||
    dir.includes("most to least") ||
    dir.includes("largest to smallest") ||
    dir.includes("highest to lowest") ||
    dir.includes("longest to shortest")
  ) return "descending";
  return null;
}

/**
 * Derive the canonical position-per-item array from `orderingItemValues` and
 * `orderingDirection`. Returns null when values are missing/incomplete or the
 * direction phrasing isn't recognized — in which case the caller should fall
 * back to the stored `orderingCorrectOrder`.
 *
 * Example: items=[Nigeria, SA, Algeria, DRC], values=[923k, 1.2m, 2.38m, 2.34m],
 * direction="largest to smallest" → returns [4, 3, 1, 2] (Nigeria last,
 * Algeria first by area).
 *
 * This is defense-in-depth against the bug where stored items are inverted
 * relative to the stated direction (Yap S4G2R1, 2026-04-30): when values are
 * present, they are the source of truth, not the stored item order.
 */
export function deriveCanonicalOrder(
  itemValues: Array<string | number | null> | null | undefined,
  direction: string | null | undefined
): number[] | null {
  if (!Array.isArray(itemValues) || itemValues.length === 0) return null;
  if (!itemValues.every((v) => v !== null && v !== undefined && v !== "")) return null;
  const sense = classifyOrderingDirection(direction);
  if (sense === null) return null;

  const typed = itemValues as Array<string | number>;
  // Sort indices by value, ties broken by original index for stability.
  const indices = typed.map((_, i) => i);
  indices.sort((a, b) => {
    const cmp = compareOrderingValues(typed[a], typed[b]);
    if (cmp !== 0) return sense === "ascending" ? cmp : -cmp;
    return a - b;
  });
  // indices[posIdx] = original index that belongs at position posIdx+1.
  // Invert: positionByOriginalIdx[origIdx] = posIdx+1.
  const positionByOriginalIdx = new Array<number>(typed.length);
  for (let posIdx = 0; posIdx < indices.length; posIdx++) {
    positionByOriginalIdx[indices[posIdx]] = posIdx + 1;
  }
  return positionByOriginalIdx;
}

/**
 * Determine Ordering question winners.
 * Rules:
 *   1. Score = number of items in correct position.
 *   2. All-correct players win.
 *   3. If nobody all-correct, player(s) with most correct positions win (min 2 to win).
 *   4. Ties: all tying players win.
 *   5. Everyone below 2 correct: nobody wins.
 *
 * When `itemValues` is supplied (parallel to the original orderingItems array),
 * a position is correct if the value at the player's placement equals the
 * canonical value at that placement. This makes equal-value items
 * interchangeable (e.g. two films released the same year). Null/empty values
 * are NOT treated as equivalent to other nulls.
 *
 * Returns the Set of winner answer IDs and a map of scores.
 */
export function determineOrderingWinners(
  correctOrder: number[],
  submissions: Array<{ id: string; playerOrder: number[] }>,
  itemValues?: Array<string | number | null> | null
): { winners: Set<string>; scores: Map<string, number> } {
  const scores = new Map<string, number>();
  const winners = new Set<string>();

  if (correctOrder.length === 0 || submissions.length === 0) {
    return { winners, scores };
  }

  // Build position -> canonical value lookup when values are present and complete.
  // valueAtPosition[pos] = canonical value at 1-indexed position `pos`.
  const useValues =
    Array.isArray(itemValues) &&
    itemValues.length === correctOrder.length &&
    itemValues.every((v) => v !== null && v !== undefined && v !== "");
  const valueAtPosition = new Map<number, string | number>();
  if (useValues) {
    for (let originalIdx = 0; originalIdx < correctOrder.length; originalIdx++) {
      const pos = correctOrder[originalIdx];
      valueAtPosition.set(pos, itemValues![originalIdx] as string | number);
    }
  }

  // Score each submission: count items in correct position (or correct value-slot)
  for (const sub of submissions) {
    let correct = 0;
    for (let originalIdx = 0; originalIdx < correctOrder.length; originalIdx++) {
      if (useValues) {
        const playerPos = sub.playerOrder[originalIdx];
        const playerValue = itemValues![originalIdx];
        const canonicalValue = valueAtPosition.get(playerPos);
        if (
          playerValue !== null &&
          playerValue !== undefined &&
          playerValue !== "" &&
          canonicalValue !== undefined &&
          playerValue === canonicalValue
        ) {
          correct++;
        }
      } else {
        if (sub.playerOrder[originalIdx] === correctOrder[originalIdx]) correct++;
      }
    }
    scores.set(sub.id, correct);
  }

  const totalItems = correctOrder.length;
  const allCorrectSubs = submissions.filter(s => scores.get(s.id) === totalItems);

  if (allCorrectSubs.length > 0) {
    // All-correct players win
    allCorrectSubs.forEach(s => winners.add(s.id));
  } else {
    // Find max score, must be >= 2
    const maxScore = Math.max(...Array.from(scores.values()));
    if (maxScore >= 2) {
      submissions
        .filter(s => scores.get(s.id) === maxScore)
        .forEach(s => winners.add(s.id));
    }
    // If maxScore < 2, nobody wins (empty set)
  }

  return { winners, scores };
}

/**
 * Calculate absentee penalty for missing a bet/answer
 */
export function calculateAbsenteePenalty(
  currentPoints: number,
  remainingRounds: number
): number {
  if (remainingRounds <= 0 || currentPoints <= 0) return 0;
  const penalty = Math.floor(currentPoints / remainingRounds);
  // Cap at 50% so a single absence doesn't fully eliminate
  const maxPenalty = Math.floor(currentPoints * 0.5);
  // Floor at 1: an absence always costs at least a point so it never goes
  // unpunished (e.g. low remainingRounds or low currentPoints rounding to 0).
  return Math.max(1, Math.min(penalty, maxPenalty));
}

/**
 * Compute question quality composite score (1-5 scale).
 * Blends subjective player ratings (70%) with difficulty balance (30%).
 * For < 3 answerers, uses only subjective ratings (difficulty too noisy).
 */
export function computeQuestionComposite(
  avgRating: number | null,
  answerFormat: string,
  answers: Array<{ isCorrect: boolean | null; freeTextAnswer: string | null }>,
  correctAnswer: string | null
): number | null {
  if (avgRating === null) return null;
  // Slight quality boost for MC and PiR formats to incentivize structured questions
  const formatBoost = answerFormat !== "free_text" ? 0.5 : 0;
  if (answers.length < 3) return Math.round(Math.min(5, avgRating + formatBoost) * 10) / 10;

  let difficultyScore: number | null = null;

  if (answerFormat === "price_is_right") {
    const target = parseFloat(correctAnswer ?? "NaN");
    if (!isNaN(target)) {
      const threshold = Math.max(Math.abs(target) * 0.25, 1);
      const closeCount = answers.filter((a) => {
        const guess = parseFloat(a.freeTextAnswer ?? "NaN");
        return !isNaN(guess) && Math.abs(guess - target) <= threshold;
      }).length;
      const closenessRate = closeCount / answers.length;
      difficultyScore = 5 - Math.abs(closenessRate - 0.5) * 6;
    }
  } else {
    const correctCount = answers.filter((a) => a.isCorrect).length;
    const successRate = correctCount / answers.length;
    difficultyScore = 5 - Math.abs(successRate - 0.5) * 6;
  }

  if (difficultyScore !== null) {
    const raw = avgRating * 0.7 + Math.max(0, difficultyScore) * 0.3 + formatBoost;
    return Math.round(Math.min(5, raw) * 10) / 10;
  }
  return Math.round(Math.min(5, avgRating + formatBoost) * 10) / 10;
}

// ─── Projection: simulate a commissioner regrade ───────────────────────────

export interface ProjectionAnswerInput {
  id: string;
  leaguePlayerId: string;
  nickname: string;
  selectedOption: string | null;
  freeTextAnswer: string | null;
  betAmount: number;
  answeredAt: Date | null;
  isAbsent: boolean;
  isBlindBet: boolean;
  // Current (pre-regrade) values, surfaced in the projection's `before` half.
  isCorrect: boolean | null;
  pointsWon: number;
  f1Points: number;
  placement: number | null;
  fastestLap: boolean;
  // The new isCorrect under the proposed key. For MC, the caller passes
  // selectedOption === newCorrectOption. For closest-guess / ordering, the
  // caller supplies the proposed answer-key fields and the helper recomputes.
  // For free-text the caller must run the AI grader externally and pass the
  // boolean here.
  newIsCorrect: boolean;
}

export interface ProjectionPlayerStateInput {
  leaguePlayerId: string;
  nickname: string;
  /** Current points displayed on the game chart (already includes this round). */
  currentPoints: number;
  /** Whether the player is currently eliminated. */
  isEliminated: boolean;
}

export interface ProjectionAnswerResult {
  answerId: string;
  leaguePlayerId: string;
  nickname: string;
  before: {
    isCorrect: boolean | null;
    pointsWon: number;
    f1Points: number;
    placement: number | null;
    fastestLap: boolean;
  };
  after: {
    isCorrect: boolean;
    pointsWon: number;
    f1Points: number;
    placement: number | null;
    fastestLap: boolean;
  };
}

export interface ProjectionPlayerResult {
  leaguePlayerId: string;
  nickname: string;
  before: { points: number; isEliminated: boolean };
  after: { points: number; isEliminated: boolean };
}

/**
 * Pure projection of what a regrade would do, given the proposed per-answer
 * `newIsCorrect` values. Mirrors closeRound's scoring path: blind-bet 2x
 * multiplier on correct, clamp at -prevPoints on negatives, busted-player
 * path zeros placement/F1/points (correct just earns +1 bonus elsewhere).
 *
 * The caller is responsible for computing each answer's `newIsCorrect`
 * upstream (MC: option compare; closest-guess: determinePirWinners on new
 * target; ordering: determineOrderingWinners on new order/values; free-text:
 * AI grader). This helper does NOT call the AI grader.
 */
export function projectRegrade(input: {
  answers: ProjectionAnswerInput[];
  playerStates: ProjectionPlayerStateInput[];
}): {
  answers: ProjectionAnswerResult[];
  players: ProjectionPlayerResult[];
} {
  const { answers, playerStates } = input;

  const stateByPlayer = new Map(playerStates.map((p) => [p.leaguePlayerId, p]));

  // Reverse each answer's existing pointsWon to derive each player's pre-round points.
  const prevPoints = new Map<string, number>();
  for (const ps of playerStates) prevPoints.set(ps.leaguePlayerId, ps.currentPoints);
  for (const a of answers) {
    const cur = prevPoints.get(a.leaguePlayerId);
    if (cur === undefined) continue;
    prevPoints.set(a.leaguePlayerId, Math.max(0, cur - a.pointsWon));
  }

  // Run scoreRound with the new isCorrect values.
  const scoringInput = answers.map((a) => {
    const ps = stateByPlayer.get(a.leaguePlayerId);
    // Eliminated-before-this-round = pre-round points === 0.
    // (We use the same definition closeRound uses internally: playerState.isEliminated.
    // But after reversal, a player whose only points came from this round drops to 0,
    // so we compute from prevPoints to be safe.)
    const wasElim = (prevPoints.get(a.leaguePlayerId) ?? 0) === 0 && (ps?.isEliminated ?? false);
    return {
      leaguePlayerId: a.leaguePlayerId,
      isCorrect: a.newIsCorrect,
      betAmount: a.betAmount,
      answeredAt: a.answeredAt,
      isAbsent: a.isAbsent,
      isEliminated: wasElim,
      nickname: a.nickname,
    };
  });
  const scored = scoreRound(scoringInput);
  const scoredById = new Map(scored.map((s) => [s.leaguePlayerId, s]));

  // Apply blind multiplier + clamp the same way closeRound does, and compute
  // each answer's after-state pointsWon.
  const afterPointsByPlayer = new Map<string, number>();
  prevPoints.forEach((pts, id) => afterPointsByPlayer.set(id, pts));

  const answerResults: ProjectionAnswerResult[] = answers.map((a) => {
    const score = scoredById.get(a.leaguePlayerId);
    const wasElim = (prevPoints.get(a.leaguePlayerId) ?? 0) === 0;

    let afterPointsWon: number;
    let afterPlacement: number | null;
    let afterF1: number;
    let afterFastest: boolean;

    if (wasElim) {
      afterPointsWon = 0;
      afterPlacement = null;
      afterF1 = 0;
      afterFastest = false;
    } else if (a.isAbsent) {
      // Absentee penalty is computed elsewhere by closeRound; keep current value.
      afterPointsWon = a.pointsWon;
      afterPlacement = score?.placement ?? null;
      afterF1 = score?.f1Points ?? 0;
      afterFastest = score?.fastestLap ?? false;
    } else {
      const blindMul = a.isBlindBet ? 2 : 1;
      const raw = a.newIsCorrect ? a.betAmount * blindMul : -a.betAmount;
      const prev = prevPoints.get(a.leaguePlayerId) ?? 0;
      afterPointsWon = raw < 0 ? Math.max(raw, -prev) : raw;
      afterPlacement = score?.placement ?? null;
      afterF1 = score?.f1Points ?? 0;
      afterFastest = score?.fastestLap ?? false;
    }

    const cur = afterPointsByPlayer.get(a.leaguePlayerId) ?? 0;
    afterPointsByPlayer.set(a.leaguePlayerId, Math.max(0, cur + afterPointsWon));

    return {
      answerId: a.id,
      leaguePlayerId: a.leaguePlayerId,
      nickname: a.nickname,
      before: {
        isCorrect: a.isCorrect,
        pointsWon: a.pointsWon,
        f1Points: a.f1Points,
        placement: a.placement,
        fastestLap: a.fastestLap,
      },
      after: {
        isCorrect: a.newIsCorrect,
        pointsWon: afterPointsWon,
        f1Points: afterF1,
        placement: afterPlacement,
        fastestLap: afterFastest,
      },
    };
  });

  const playerResults: ProjectionPlayerResult[] = playerStates.map((ps) => {
    const afterPts = afterPointsByPlayer.get(ps.leaguePlayerId) ?? ps.currentPoints;
    return {
      leaguePlayerId: ps.leaguePlayerId,
      nickname: ps.nickname,
      before: { points: ps.currentPoints, isEliminated: ps.isEliminated },
      after: { points: afterPts, isEliminated: afterPts === 0 },
    };
  });

  return { answers: answerResults, players: playerResults };
}


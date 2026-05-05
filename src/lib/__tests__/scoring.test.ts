import { describe, it, expect } from "vitest";
import {
  scoreRound,
  getF1PointsForPlacement,
  computePowerUpCost,
  determinePirWinners,
  determineOrderingWinners,
  calculateAbsenteePenalty,
  classifyOrderingDirection,
  deriveCanonicalOrder,
} from "../scoring";

describe("determinePirWinners (closest guess)", () => {
  it("picks the closest guess by absolute distance", () => {
    const target = 151;
    const guesses = [
      { id: "a", value: 89 },
      { id: "b", value: 110 },
      { id: "c", value: 111 },
      { id: "d", value: 117 },
      { id: "e", value: 123 },
      { id: "f", value: 140 },
    ];
    const winners = determinePirWinners(target, guesses);
    expect(winners.size).toBe(1);
    expect(winners.has("f")).toBe(true);
  });

  it("does not penalize going over — closest wins regardless of side", () => {
    // Real-world example: target 1907, guess 1911 (off by 4) beats guess 1200 (off by 707)
    const winners = determinePirWinners(1907, [
      { id: "a", value: 1911 },
      { id: "b", value: 1200 },
    ]);
    expect(winners.size).toBe(1);
    expect(winners.has("a")).toBe(true);
  });

  it("picks exact match over near-misses", () => {
    const winners = determinePirWinners(100, [
      { id: "a", value: 99 },
      { id: "b", value: 100 },
      { id: "c", value: 101 },
    ]);
    expect(winners.size).toBe(1);
    expect(winners.has("b")).toBe(true);
  });

  it("awards all exact matches as winners", () => {
    const winners = determinePirWinners(50, [
      { id: "a", value: 50 },
      { id: "b", value: 50 },
      { id: "c", value: 49 },
    ]);
    expect(winners.size).toBe(2);
    expect(winners.has("a")).toBe(true);
    expect(winners.has("b")).toBe(true);
    expect(winners.has("c")).toBe(false);
  });

  it("ties when guesses are equidistant on opposite sides", () => {
    const winners = determinePirWinners(100, [
      { id: "a", value: 95 },
      { id: "b", value: 105 },
      { id: "c", value: 80 },
    ]);
    expect(winners.size).toBe(2);
    expect(winners.has("a")).toBe(true);
    expect(winners.has("b")).toBe(true);
  });

  it("ties multiple guesses at the same distance on the same side", () => {
    const winners = determinePirWinners(100, [
      { id: "a", value: 95 },
      { id: "b", value: 95 },
      { id: "c", value: 90 },
    ]);
    expect(winners.size).toBe(2);
    expect(winners.has("a")).toBe(true);
    expect(winners.has("b")).toBe(true);
  });

  it("everyone over: closest-over still wins (no auto-loss)", () => {
    const winners = determinePirWinners(50, [
      { id: "a", value: 51 },
      { id: "b", value: 100 },
      { id: "c", value: 200 },
    ]);
    expect(winners.size).toBe(1);
    expect(winners.has("a")).toBe(true);
  });

  it("returns empty set for no guesses", () => {
    const winners = determinePirWinners(100, []);
    expect(winners.size).toBe(0);
  });

  it("returns empty set for NaN target", () => {
    const winners = determinePirWinners(NaN, [
      { id: "a", value: 50 },
    ]);
    expect(winners.size).toBe(0);
  });

  it("handles single guess under target", () => {
    const winners = determinePirWinners(100, [
      { id: "a", value: 1 },
    ]);
    expect(winners.size).toBe(1);
    expect(winners.has("a")).toBe(true);
  });

  it("handles single guess over target", () => {
    const winners = determinePirWinners(100, [
      { id: "a", value: 101 },
    ]);
    expect(winners.size).toBe(1);
    expect(winners.has("a")).toBe(true);
  });

  it("handles single exact match", () => {
    const winners = determinePirWinners(100, [
      { id: "a", value: 100 },
    ]);
    expect(winners.size).toBe(1);
    expect(winners.has("a")).toBe(true);
  });

  it("handles decimals correctly", () => {
    const winners = determinePirWinners(3.14, [
      { id: "a", value: 3.13 },
      { id: "b", value: 3.15 },
      { id: "c", value: 3.0 },
    ]);
    // 3.13 and 3.15 are both 0.01 away
    expect(winners.size).toBe(2);
    expect(winners.has("a")).toBe(true);
    expect(winners.has("b")).toBe(true);
  });

  it("handles zero as target", () => {
    const winners = determinePirWinners(0, [
      { id: "a", value: 0 },
      { id: "b", value: 1 },
      { id: "c", value: -1 },
    ]);
    expect(winners.size).toBe(1);
    expect(winners.has("a")).toBe(true);
  });

  it("handles negative target", () => {
    const winners = determinePirWinners(-10, [
      { id: "a", value: -15 },
      { id: "b", value: -10 },
      { id: "c", value: -5 },
    ]);
    expect(winners.size).toBe(1);
    expect(winners.has("b")).toBe(true);
  });
});

describe("scoreRound", () => {
  const now = new Date();
  const later = new Date(now.getTime() + 5000);

  it("ranks correct answers above incorrect", () => {
    const results = scoreRound([
      { leaguePlayerId: "p1", isCorrect: true, betAmount: 5, answeredAt: now, isAbsent: false, nickname: "Alice" },
      { leaguePlayerId: "p2", isCorrect: false, betAmount: 10, answeredAt: now, isAbsent: false, nickname: "Bob" },
    ]);
    expect(results.find((r) => r.leaguePlayerId === "p1")!.placement).toBe(1);
    expect(results.find((r) => r.leaguePlayerId === "p2")!.placement).toBe(2);
  });

  it("ranks higher bet correct answers above lower bet", () => {
    const results = scoreRound([
      { leaguePlayerId: "p1", isCorrect: true, betAmount: 5, answeredAt: now, isAbsent: false, nickname: "Alice" },
      { leaguePlayerId: "p2", isCorrect: true, betAmount: 10, answeredAt: now, isAbsent: false, nickname: "Bob" },
    ]);
    expect(results.find((r) => r.leaguePlayerId === "p2")!.placement).toBe(1);
    expect(results.find((r) => r.leaguePlayerId === "p1")!.placement).toBe(2);
  });

  it("uses answer time as tiebreaker for same-bet correct answers", () => {
    const results = scoreRound([
      { leaguePlayerId: "p1", isCorrect: true, betAmount: 5, answeredAt: later, isAbsent: false, nickname: "Alice" },
      { leaguePlayerId: "p2", isCorrect: true, betAmount: 5, answeredAt: now, isAbsent: false, nickname: "Bob" },
    ]);
    expect(results.find((r) => r.leaguePlayerId === "p2")!.placement).toBe(1);
  });

  it("ranks absent players last", () => {
    const results = scoreRound([
      { leaguePlayerId: "p1", isCorrect: false, betAmount: 5, answeredAt: now, isAbsent: false, nickname: "Alice" },
      { leaguePlayerId: "p2", isCorrect: false, betAmount: 0, answeredAt: null, isAbsent: true, nickname: "Bob" },
      { leaguePlayerId: "p3", isCorrect: true, betAmount: 3, answeredAt: now, isAbsent: false, nickname: "Charlie" },
    ]);
    expect(results.find((r) => r.leaguePlayerId === "p3")!.placement).toBe(1);
    expect(results.find((r) => r.leaguePlayerId === "p1")!.placement).toBe(2);
    expect(results.find((r) => r.leaguePlayerId === "p2")!.placement).toBe(3);
  });

  it("awards fastest lap to highest-bet correct player", () => {
    const results = scoreRound([
      { leaguePlayerId: "p1", isCorrect: true, betAmount: 10, answeredAt: later, isAbsent: false, nickname: "Alice" },
      { leaguePlayerId: "p2", isCorrect: true, betAmount: 5, answeredAt: now, isAbsent: false, nickname: "Bob" },
    ]);
    expect(results.find((r) => r.leaguePlayerId === "p1")!.fastestLap).toBe(true);
    expect(results.find((r) => r.leaguePlayerId === "p2")!.fastestLap).toBe(false);
  });

  it("breaks fastest lap ties with answer time", () => {
    const results = scoreRound([
      { leaguePlayerId: "p1", isCorrect: true, betAmount: 10, answeredAt: later, isAbsent: false, nickname: "Alice" },
      { leaguePlayerId: "p2", isCorrect: true, betAmount: 10, answeredAt: now, isAbsent: false, nickname: "Bob" },
    ]);
    expect(results.find((r) => r.leaguePlayerId === "p2")!.fastestLap).toBe(true);
  });

  it("gives no fastest lap when no one is correct", () => {
    const results = scoreRound([
      { leaguePlayerId: "p1", isCorrect: false, betAmount: 5, answeredAt: now, isAbsent: false, nickname: "Alice" },
      { leaguePlayerId: "p2", isCorrect: false, betAmount: 3, answeredAt: now, isAbsent: false, nickname: "Bob" },
    ]);
    expect(results.every((r) => !r.fastestLap)).toBe(true);
  });

  it("calculates pointsWon correctly", () => {
    const results = scoreRound([
      { leaguePlayerId: "p1", isCorrect: true, betAmount: 7, answeredAt: now, isAbsent: false, nickname: "Alice" },
      { leaguePlayerId: "p2", isCorrect: false, betAmount: 4, answeredAt: now, isAbsent: false, nickname: "Bob" },
    ]);
    expect(results.find((r) => r.leaguePlayerId === "p1")!.pointsWon).toBe(7);
    expect(results.find((r) => r.leaguePlayerId === "p2")!.pointsWon).toBe(-4);
  });

  it("gives absent players 0 pointsWon", () => {
    const results = scoreRound([
      { leaguePlayerId: "p1", isCorrect: false, betAmount: 0, answeredAt: null, isAbsent: true, nickname: "Alice" },
    ]);
    expect(results[0].pointsWon).toBe(0);
  });

  // Busted player ("eliminated") behavior — they answer for a +1 next-game bonus
  // but earn 0 game-points / 0 F1 / no fastest lap in the current round.
  it("eliminated correct answer gets 0 pointsWon and 0 f1Points", () => {
    const results = scoreRound([
      { leaguePlayerId: "p1", isCorrect: true, betAmount: 5, answeredAt: now, isAbsent: false, nickname: "Alice" },
      { leaguePlayerId: "p2", isCorrect: true, betAmount: 0, answeredAt: now, isAbsent: false, isEliminated: true, nickname: "Bob" },
    ]);
    const bob = results.find((r) => r.leaguePlayerId === "p2")!;
    expect(bob.pointsWon).toBe(0);
    expect(bob.f1Points).toBe(0);
    expect(bob.fastestLap).toBe(false);
  });

  it("eliminated players are excluded from fastest-lap candidacy", () => {
    // Bob's bet would normally win fastest lap (highest bet, fastest time) but he is busted.
    const results = scoreRound([
      { leaguePlayerId: "p1", isCorrect: true, betAmount: 5, answeredAt: later, isAbsent: false, nickname: "Alice" },
      { leaguePlayerId: "p2", isCorrect: true, betAmount: 10, answeredAt: now, isAbsent: false, isEliminated: true, nickname: "Bob" },
    ]);
    expect(results.find((r) => r.leaguePlayerId === "p1")!.fastestLap).toBe(true);
    expect(results.find((r) => r.leaguePlayerId === "p2")!.fastestLap).toBe(false);
  });

  it("ranks eliminated players behind incorrect non-busted players", () => {
    const results = scoreRound([
      { leaguePlayerId: "p1", isCorrect: false, betAmount: 5, answeredAt: now, isAbsent: false, nickname: "Alice" },
      { leaguePlayerId: "p2", isCorrect: true, betAmount: 0, answeredAt: now, isAbsent: false, isEliminated: true, nickname: "Bob" },
    ]);
    expect(results.find((r) => r.leaguePlayerId === "p1")!.placement).toBe(1);
    expect(results.find((r) => r.leaguePlayerId === "p2")!.placement).toBe(2);
  });

  it("eliminated wrong answer gets 0 pointsWon (no penalty)", () => {
    const results = scoreRound([
      { leaguePlayerId: "p1", isCorrect: false, betAmount: 0, answeredAt: now, isAbsent: false, isEliminated: true, nickname: "Alice" },
    ]);
    expect(results[0].pointsWon).toBe(0);
    expect(results[0].f1Points).toBe(0);
  });
});

describe("getF1PointsForPlacement", () => {
  it("gives 25 for first place in 10-player league", () => {
    expect(getF1PointsForPlacement(1, 10)).toBe(25);
  });

  it("gives 1 for last place in 10-player league", () => {
    expect(getF1PointsForPlacement(10, 10)).toBe(1);
  });

  it("gives 25 for sole player", () => {
    expect(getF1PointsForPlacement(1, 1)).toBe(25);
  });

  it("returns 0 for out-of-range placement", () => {
    expect(getF1PointsForPlacement(11, 10)).toBe(0);
    expect(getF1PointsForPlacement(0, 5)).toBe(0);
  });
});

describe("determineOrderingWinners", () => {
  it("all-correct players win", () => {
    const { winners } = determineOrderingWinners(
      [1, 2, 3],
      [
        { id: "a", playerOrder: [1, 2, 3] },
        { id: "b", playerOrder: [3, 2, 1] },
      ]
    );
    expect(winners.has("a")).toBe(true);
    expect(winners.has("b")).toBe(false);
  });

  it("nobody wins if max correct < 2", () => {
    const { winners } = determineOrderingWinners(
      [1, 2, 3],
      [
        { id: "a", playerOrder: [3, 1, 2] },
        { id: "b", playerOrder: [2, 3, 1] },
      ]
    );
    expect(winners.size).toBe(0);
  });

  it("highest partial score wins if >= 2", () => {
    const { winners, scores } = determineOrderingWinners(
      [1, 2, 3, 4],
      [
        { id: "a", playerOrder: [1, 2, 4, 3] },
        { id: "b", playerOrder: [1, 3, 2, 4] },
        { id: "c", playerOrder: [4, 3, 2, 1] },
      ]
    );
    expect(scores.get("a")).toBe(2);
    expect(scores.get("b")).toBe(2);
    expect(winners.has("a")).toBe(true);
    expect(winners.has("b")).toBe(true);
    expect(winners.has("c")).toBe(false);
  });

  it("returns empty sets for no submissions", () => {
    const { winners, scores } = determineOrderingWinners([1, 2, 3], []);
    expect(winners.size).toBe(0);
    expect(scores.size).toBe(0);
  });
});

describe("classifyOrderingDirection", () => {
  it("classifies ascending phrasings", () => {
    expect(classifyOrderingDirection("earliest to latest")).toBe("ascending");
    expect(classifyOrderingDirection("least to most")).toBe("ascending");
    expect(classifyOrderingDirection("smallest to largest")).toBe("ascending");
    expect(classifyOrderingDirection("Lowest to Highest")).toBe("ascending");
  });

  it("classifies descending phrasings", () => {
    expect(classifyOrderingDirection("largest to smallest")).toBe("descending");
    expect(classifyOrderingDirection("most to least")).toBe("descending");
    expect(classifyOrderingDirection("newest to oldest")).toBe("descending");
  });

  it("returns null for unrecognized phrasings", () => {
    expect(classifyOrderingDirection("by alphabet")).toBeNull();
    expect(classifyOrderingDirection("")).toBeNull();
    expect(classifyOrderingDirection(null)).toBeNull();
    expect(classifyOrderingDirection(undefined)).toBeNull();
  });
});

describe("deriveCanonicalOrder", () => {
  it("derives correct positions for descending direction", () => {
    // Items: [Algeria, DRC, SA, Nigeria], values are areas (km²).
    expect(
      deriveCanonicalOrder(
        [2381741, 2344858, 1221037, 923768],
        "largest to smallest"
      )
    ).toEqual([1, 2, 3, 4]);
  });

  it("derives correct positions when stored items are in wrong direction", () => {
    // The Yap bug: items stored smallest→largest but direction says descending.
    // Items: [Nigeria, SA, Algeria, DRC]
    expect(
      deriveCanonicalOrder(
        [923768, 1221037, 2381741, 2344858],
        "largest to smallest"
      )
    ).toEqual([4, 3, 1, 2]);
  });

  it("derives correct positions for ascending direction", () => {
    // Films released [1990, 1977, 2010] in items order — direction earliest first.
    expect(
      deriveCanonicalOrder([1990, 1977, 2010], "earliest to latest")
    ).toEqual([2, 1, 3]);
  });

  it("returns null when values are missing", () => {
    expect(deriveCanonicalOrder(null, "largest to smallest")).toBeNull();
    expect(deriveCanonicalOrder(undefined, "largest to smallest")).toBeNull();
    expect(deriveCanonicalOrder([], "largest to smallest")).toBeNull();
  });

  it("returns null when any value is null/empty", () => {
    expect(
      deriveCanonicalOrder([3, null, 1], "largest to smallest")
    ).toBeNull();
    expect(deriveCanonicalOrder([3, "", 1], "largest to smallest")).toBeNull();
  });

  it("returns null when direction is unrecognized", () => {
    expect(deriveCanonicalOrder([3, 2, 1], "by alphabet")).toBeNull();
    expect(deriveCanonicalOrder([3, 2, 1], null)).toBeNull();
  });

  it("breaks value ties by original index (stable)", () => {
    // Two items share the same value; the lower original index gets the lower position.
    expect(
      deriveCanonicalOrder([2000, 2000, 2010], "earliest to latest")
    ).toEqual([1, 2, 3]);
  });

  it("compares numeric strings numerically", () => {
    expect(
      deriveCanonicalOrder(["100", "20", "3"], "largest to smallest")
    ).toEqual([1, 2, 3]);
  });
});

describe("calculateAbsenteePenalty", () => {
  it("divides current points by remaining rounds", () => {
    expect(calculateAbsenteePenalty(20, 4)).toBe(5);
  });

  it("returns 0 for 0 remaining rounds", () => {
    expect(calculateAbsenteePenalty(20, 0)).toBe(0);
  });

  it("returns 0 for 0 current points", () => {
    expect(calculateAbsenteePenalty(0, 5)).toBe(0);
  });

  it("floors the result", () => {
    expect(calculateAbsenteePenalty(10, 3)).toBe(3);
  });

  it("caps at 50% for last round", () => {
    // With 1 round remaining, penalty would be 100% but capped at 50%
    expect(calculateAbsenteePenalty(20, 1)).toBe(10);
  });

  it("cap does not affect penalties below 50%", () => {
    // 20 / 4 = 5, which is 25% — well below cap
    expect(calculateAbsenteePenalty(20, 4)).toBe(5);
    // 20 / 2 = 10, which is exactly 50% — at the cap
    expect(calculateAbsenteePenalty(20, 2)).toBe(10);
  });

  it("floors at 1 when player has points but math rounds to 0", () => {
    // 3 / 10 = 0 floored; bumped to 1 so absence is never free
    expect(calculateAbsenteePenalty(3, 10)).toBe(1);
    // 1 point, any remaining: still costs 1 (full elimination)
    expect(calculateAbsenteePenalty(1, 5)).toBe(1);
  });
});

describe("computePowerUpCost", () => {
  it("returns 1 for the poorest player", () => {
    expect(computePowerUpCost(5, [5, 10, 15, 20])).toBe(1);
  });

  it("returns 8 for the richest player", () => {
    expect(computePowerUpCost(20, [5, 10, 15, 20])).toBe(8);
  });

  it("returns 1 for empty array", () => {
    expect(computePowerUpCost(10, [])).toBe(1);
  });
});

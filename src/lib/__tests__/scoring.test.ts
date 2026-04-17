import { describe, it, expect } from "vitest";
import {
  scoreRound,
  getF1PointsForPlacement,
  computePowerUpCost,
  determinePirWinners,
  determineOrderingWinners,
  calculateAbsenteePenalty,
} from "../scoring";

describe("determinePirWinners", () => {
  it("picks the closest guess without going over", () => {
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

  it("picks exact match over closer-without-going-over", () => {
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

  it("awards all tied closest-without-going-over as winners", () => {
    const winners = determinePirWinners(100, [
      { id: "a", value: 95 },
      { id: "b", value: 95 },
      { id: "c", value: 90 },
    ]);
    expect(winners.size).toBe(2);
    expect(winners.has("a")).toBe(true);
    expect(winners.has("b")).toBe(true);
  });

  it("returns empty set when all guesses go over", () => {
    const winners = determinePirWinners(50, [
      { id: "a", value: 51 },
      { id: "b", value: 100 },
      { id: "c", value: 200 },
    ]);
    expect(winners.size).toBe(0);
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
    expect(winners.size).toBe(0);
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
    expect(winners.size).toBe(1);
    expect(winners.has("a")).toBe(true);
  });

  it("handles zero as target", () => {
    const winners = determinePirWinners(0, [
      { id: "a", value: 0 },
      { id: "b", value: 1 },
      { id: "c", value: -1 },
    ]);
    // Exact match at 0 wins; -1 is under, 1 is over
    expect(winners.has("a")).toBe(true);
  });

  it("handles negative target", () => {
    const winners = determinePirWinners(-10, [
      { id: "a", value: -15 },
      { id: "b", value: -10 },
      { id: "c", value: -5 },
    ]);
    // -10 is exact, -5 is over (> -10), -15 is under
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

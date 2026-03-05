import { describe, it, expect } from "vitest";
import {
  getF1PointsForPlacement,
  scoreRound,
  computePowerUpCost,
  determinePirWinners,
  calculateAbsenteePenalty,
} from "./scoring";

describe("getF1PointsForPlacement", () => {
  it("returns 25 for first place", () => {
    expect(getF1PointsForPlacement(1, 10)).toBe(25);
    expect(getF1PointsForPlacement(1, 5)).toBe(25);
    expect(getF1PointsForPlacement(1, 1)).toBe(25);
  });

  it("returns correct points for full 10-player scale", () => {
    expect(getF1PointsForPlacement(2, 10)).toBe(18);
    expect(getF1PointsForPlacement(10, 10)).toBe(1);
  });

  it("returns 0 for placement beyond scale", () => {
    expect(getF1PointsForPlacement(11, 10)).toBe(0);
    expect(getF1PointsForPlacement(0, 10)).toBe(0);
  });

  it("handles 2-player league", () => {
    expect(getF1PointsForPlacement(1, 2)).toBe(25);
    expect(getF1PointsForPlacement(2, 2)).toBe(18);
  });
});

describe("scoreRound", () => {
  const makePlayer = (
    id: string,
    isCorrect: boolean,
    betAmount: number,
    answeredAt: Date | null = new Date("2025-01-01T12:00:00Z"),
    isAbsent = false,
    nickname = id
  ) => ({
    leaguePlayerId: id,
    isCorrect,
    betAmount,
    answeredAt,
    isAbsent,
    nickname,
  });

  it("ranks correct above incorrect", () => {
    const results = scoreRound([
      makePlayer("a", false, 5),
      makePlayer("b", true, 5),
    ]);
    expect(results[0].leaguePlayerId).toBe("b");
    expect(results[0].placement).toBe(1);
    expect(results[1].leaguePlayerId).toBe("a");
    expect(results[1].placement).toBe(2);
  });

  it("ranks higher bet above lower bet when both correct", () => {
    const results = scoreRound([
      makePlayer("low", true, 2),
      makePlayer("high", true, 10),
    ]);
    expect(results[0].leaguePlayerId).toBe("high");
  });

  it("ranks faster answer higher when same bet and both correct", () => {
    const results = scoreRound([
      makePlayer("slow", true, 5, new Date("2025-01-01T12:01:00Z")),
      makePlayer("fast", true, 5, new Date("2025-01-01T12:00:00Z")),
    ]);
    expect(results[0].leaguePlayerId).toBe("fast");
  });

  it("ranks smaller bet higher when both incorrect (less loss)", () => {
    const results = scoreRound([
      makePlayer("big-loss", false, 10),
      makePlayer("small-loss", false, 2),
    ]);
    expect(results[0].leaguePlayerId).toBe("small-loss");
  });

  it("ranks absent players last", () => {
    const results = scoreRound([
      makePlayer("absent", false, 0, null, true),
      makePlayer("wrong", false, 5),
      makePlayer("right", true, 5),
    ]);
    expect(results[0].leaguePlayerId).toBe("right");
    expect(results[2].leaguePlayerId).toBe("absent");
  });

  it("calculates pointsWon correctly", () => {
    const results = scoreRound([
      makePlayer("correct", true, 5),
      makePlayer("wrong", false, 3),
      makePlayer("absent", false, 0, null, true),
    ]);
    const correct = results.find((r) => r.leaguePlayerId === "correct")!;
    const wrong = results.find((r) => r.leaguePlayerId === "wrong")!;
    const absent = results.find((r) => r.leaguePlayerId === "absent")!;
    expect(correct.pointsWon).toBe(5);
    expect(wrong.pointsWon).toBe(-3);
    expect(absent.pointsWon).toBe(0);
  });

  it("awards fastest lap to highest-bet correct player", () => {
    const results = scoreRound([
      makePlayer("a", true, 10, new Date("2025-01-01T12:00:00Z")),
      makePlayer("b", true, 5, new Date("2025-01-01T12:00:00Z")),
    ]);
    expect(results.find((r) => r.leaguePlayerId === "a")!.fastestLap).toBe(true);
    expect(results.find((r) => r.leaguePlayerId === "b")!.fastestLap).toBe(false);
  });

  it("breaks fastest lap tie by timestamp", () => {
    const results = scoreRound([
      makePlayer("slow", true, 10, new Date("2025-01-01T12:01:00Z")),
      makePlayer("fast", true, 10, new Date("2025-01-01T12:00:00Z")),
    ]);
    expect(results.find((r) => r.leaguePlayerId === "fast")!.fastestLap).toBe(true);
    expect(results.find((r) => r.leaguePlayerId === "slow")!.fastestLap).toBe(false);
  });

  it("assigns no fastest lap when no correct answers", () => {
    const results = scoreRound([
      makePlayer("a", false, 5),
      makePlayer("b", false, 3),
    ]);
    expect(results.every((r) => !r.fastestLap)).toBe(true);
  });

  it("fastest lap adds +1 F1 point", () => {
    const results = scoreRound([
      makePlayer("a", true, 10),
      makePlayer("b", true, 5),
    ]);
    const a = results.find((r) => r.leaguePlayerId === "a")!;
    expect(a.fastestLap).toBe(true);
    // First place gets 25 + 1 fastest lap = 26
    expect(a.f1Points).toBe(26);
  });
});

describe("computePowerUpCost", () => {
  it("returns 1 for empty active points", () => {
    expect(computePowerUpCost(10, [])).toBe(1);
  });

  it("returns 1 for the poorest player", () => {
    expect(computePowerUpCost(5, [5, 10, 15, 20])).toBe(1);
  });

  it("returns 8 for the richest player", () => {
    expect(computePowerUpCost(20, [5, 10, 15, 20])).toBe(8);
  });

  it("returns intermediate cost for middle players", () => {
    const cost = computePowerUpCost(10, [5, 10, 15, 20]);
    expect(cost).toBeGreaterThanOrEqual(1);
    expect(cost).toBeLessThanOrEqual(8);
  });

  it("returns 1 for single player", () => {
    expect(computePowerUpCost(50, [50])).toBe(1);
  });
});

describe("determinePirWinners", () => {
  it("returns exact matches as winners", () => {
    const winners = determinePirWinners(100, [
      { id: "a", value: 100 },
      { id: "b", value: 50 },
    ]);
    expect(winners.size).toBe(1);
    expect(winners.has("a")).toBe(true);
  });

  it("returns closest-without-going-over when no exact match", () => {
    const winners = determinePirWinners(100, [
      { id: "a", value: 90 },
      { id: "b", value: 80 },
      { id: "c", value: 110 },
    ]);
    expect(winners.size).toBe(1);
    expect(winners.has("a")).toBe(true);
  });

  it("returns empty set when all guesses go over", () => {
    const winners = determinePirWinners(100, [
      { id: "a", value: 101 },
      { id: "b", value: 200 },
    ]);
    expect(winners.size).toBe(0);
  });

  it("handles ties for closest-without-going-over", () => {
    const winners = determinePirWinners(100, [
      { id: "a", value: 90 },
      { id: "b", value: 90 },
    ]);
    expect(winners.size).toBe(2);
  });

  it("returns multiple exact matches", () => {
    const winners = determinePirWinners(50, [
      { id: "a", value: 50 },
      { id: "b", value: 50 },
      { id: "c", value: 30 },
    ]);
    expect(winners.size).toBe(2);
    expect(winners.has("a")).toBe(true);
    expect(winners.has("b")).toBe(true);
  });

  it("returns empty set for NaN target", () => {
    expect(determinePirWinners(NaN, [{ id: "a", value: 10 }]).size).toBe(0);
  });

  it("returns empty set for empty guesses", () => {
    expect(determinePirWinners(100, []).size).toBe(0);
  });
});

describe("calculateAbsenteePenalty", () => {
  it("returns proportional penalty", () => {
    expect(calculateAbsenteePenalty(100, 5)).toBe(20);
  });

  it("returns 0 when no remaining rounds", () => {
    expect(calculateAbsenteePenalty(100, 0)).toBe(0);
  });

  it("returns 0 when player has 0 points", () => {
    expect(calculateAbsenteePenalty(0, 5)).toBe(0);
  });

  it("floors the result", () => {
    expect(calculateAbsenteePenalty(10, 3)).toBe(3);
  });
});

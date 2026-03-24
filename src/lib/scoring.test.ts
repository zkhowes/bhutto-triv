import { describe, it, expect } from "vitest";
import {
  getF1PointsForPlacement,
  scoreRound,
  computePowerUpCost,
  determinePirWinners,
  determineOrderingWinners,
  calculateAbsenteePenalty,
  computeQuestionComposite,
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

describe("computeQuestionComposite", () => {
  const makeAnswers = (correctCount: number, total: number) =>
    Array.from({ length: total }, (_, i) => ({
      isCorrect: i < correctCount,
      freeTextAnswer: null,
    }));

  // --- Null / empty cases ---

  it("returns null when avgRating is null", () => {
    expect(computeQuestionComposite(null, "free_text", makeAnswers(2, 4), "answer")).toBeNull();
  });

  it("returns null for empty answers and null rating", () => {
    expect(computeQuestionComposite(null, "free_text", [], null)).toBeNull();
  });

  // --- Small sample guard (<3 answerers) ---

  it("returns avgRating only for 1 answerer (no difficulty penalty)", () => {
    expect(computeQuestionComposite(4.0, "free_text", makeAnswers(0, 1), "answer")).toBe(4.0);
  });

  it("returns avgRating only for 2 answerers (no difficulty penalty)", () => {
    // MC gets +0.5 format boost → 3.5 + 0.5 = 4.0
    expect(computeQuestionComposite(3.5, "multiple_choice", makeAnswers(1, 2), "B")).toBe(4.0);
  });

  it("returns avgRating for 0 answerers", () => {
    expect(computeQuestionComposite(4.0, "free_text", [], null)).toBe(4.0);
  });

  // --- Standard questions (MC / free text) with >= 3 answerers ---

  it("ideal difficulty (50% correct) maximizes difficulty component", () => {
    // 50% correct → difficultyScore = 5.0
    // composite = 4.0 * 0.7 + 5.0 * 0.3 = 2.8 + 1.5 = 4.3
    const result = computeQuestionComposite(4.0, "free_text", makeAnswers(2, 4), "answer");
    expect(result).toBe(4.3);
  });

  it("100% correct penalizes difficulty (too easy)", () => {
    // 100% correct → difficultyScore = 5 - 0.5 * 6 = 2.0
    // composite = 4.0 * 0.7 + 2.0 * 0.3 = 2.8 + 0.6 = 3.4
    const result = computeQuestionComposite(4.0, "free_text", makeAnswers(4, 4), "answer");
    expect(result).toBe(3.4);
  });

  it("0% correct penalizes difficulty (too hard)", () => {
    // 0% correct → difficultyScore = 5 - 0.5 * 6 = 2.0
    // composite = 4.0 * 0.7 + 2.0 * 0.3 = 2.8 + 0.6 = 3.4
    const result = computeQuestionComposite(4.0, "free_text", makeAnswers(0, 4), "answer");
    expect(result).toBe(3.4);
  });

  it("difficulty score floors at 0 (very skewed success rate)", () => {
    // 1/3 correct → successRate = 0.333
    // difficultyScore = 5 - |0.333 - 0.5| * 6 = 5 - 1.0 = 4.0
    // composite = 5.0 * 0.7 + 4.0 * 0.3 + 0.5 (MC boost) = 3.5 + 1.2 + 0.5 = 5.2 → capped at 5.0
    const result = computeQuestionComposite(5.0, "multiple_choice", makeAnswers(1, 3), "A");
    expect(result).toBe(5.0);
  });

  it("low subjective rating with perfect difficulty still capped by rating weight", () => {
    // 50% correct → difficultyScore = 5.0
    // composite = 1.0 * 0.7 + 5.0 * 0.3 = 0.7 + 1.5 = 2.2
    const result = computeQuestionComposite(1.0, "free_text", makeAnswers(2, 4), "answer");
    expect(result).toBe(2.2);
  });

  // --- Price is Right ---

  it("PIR: uses closeness metric, not binary correct/incorrect", () => {
    // Target = 100, threshold = 25
    // Guesses: 80 (within), 90 (within), 130 (over by 30, outside), 50 (under by 50, outside)
    // closenessRate = 2/4 = 0.5 → difficultyScore = 5.0
    // composite = 4.0 * 0.7 + 5.0 * 0.3 + 0.5 (PiR boost) = 2.8 + 1.5 + 0.5 = 4.8
    const answers = [
      { isCorrect: null, freeTextAnswer: "80" },
      { isCorrect: null, freeTextAnswer: "90" },
      { isCorrect: null, freeTextAnswer: "130" },
      { isCorrect: null, freeTextAnswer: "50" },
    ];
    expect(computeQuestionComposite(4.0, "price_is_right", answers, "100")).toBe(4.8);
  });

  it("PIR: all guesses close → penalizes difficulty (too easy to estimate)", () => {
    // Target = 100, threshold = 25. All within → closenessRate = 1.0
    // difficultyScore = 5 - 0.5 * 6 = 2.0
    // composite = 4.0 * 0.7 + 2.0 * 0.3 + 0.5 (PiR boost) = 2.8 + 0.6 + 0.5 = 3.9
    const answers = [
      { isCorrect: null, freeTextAnswer: "95" },
      { isCorrect: null, freeTextAnswer: "100" },
      { isCorrect: null, freeTextAnswer: "105" },
    ];
    expect(computeQuestionComposite(4.0, "price_is_right", answers, "100")).toBe(3.9);
  });

  it("PIR: no guesses close → penalizes difficulty (too hard to estimate)", () => {
    // Target = 100, threshold = 25. None within → closenessRate = 0.0
    // difficultyScore = 5 - 0.5 * 6 = 2.0
    // composite = 4.0 * 0.7 + 2.0 * 0.3 + 0.5 (PiR boost) = 2.8 + 0.6 + 0.5 = 3.9
    const answers = [
      { isCorrect: null, freeTextAnswer: "10" },
      { isCorrect: null, freeTextAnswer: "200" },
      { isCorrect: null, freeTextAnswer: "500" },
    ];
    expect(computeQuestionComposite(4.0, "price_is_right", answers, "100")).toBe(3.9);
  });

  it("PIR: target = 0 uses minimum threshold of 1", () => {
    // Target = 0, threshold = max(0, 1) = 1
    // Guesses: 0.5 (within 1), 2 (outside), 3 (outside)
    // closenessRate = 1/3 → difficultyScore = 5 - |0.333 - 0.5| * 6 = 4.0
    const answers = [
      { isCorrect: null, freeTextAnswer: "0.5" },
      { isCorrect: null, freeTextAnswer: "2" },
      { isCorrect: null, freeTextAnswer: "3" },
    ];
    const result = computeQuestionComposite(4.0, "price_is_right", answers, "0");
    expect(result).toBeGreaterThan(3.0);
    expect(result).toBeLessThan(5.0);
  });

  it("PIR: NaN correctAnswer returns avgRating only", () => {
    // PiR boost still applies even when difficulty can't be computed → 3.0 + 0.5 = 3.5
    const answers = [
      { isCorrect: null, freeTextAnswer: "50" },
      { isCorrect: null, freeTextAnswer: "60" },
      { isCorrect: null, freeTextAnswer: "70" },
    ];
    expect(computeQuestionComposite(3.0, "price_is_right", answers, "not a number")).toBe(3.5);
  });

  it("PIR: null correctAnswer returns avgRating only", () => {
    // PiR boost still applies even when difficulty can't be computed → 3.0 + 0.5 = 3.5
    const answers = [
      { isCorrect: null, freeTextAnswer: "50" },
      { isCorrect: null, freeTextAnswer: "60" },
      { isCorrect: null, freeTextAnswer: "70" },
    ];
    expect(computeQuestionComposite(3.0, "price_is_right", answers, null)).toBe(3.5);
  });

  // --- Rounding ---

  it("rounds to 1 decimal place", () => {
    // 3/5 correct → successRate = 0.6
    // difficultyScore = 5 - |0.6 - 0.5| * 6 = 5 - 0.6 = 4.4
    // composite = 3.0 * 0.7 + 4.4 * 0.3 = 2.1 + 1.32 = 3.42 → 3.4
    const result = computeQuestionComposite(3.0, "free_text", makeAnswers(3, 5), "answer");
    expect(result).toBe(3.4);
  });
});

describe("determineOrderingWinners", () => {
  it("all players correct → all win", () => {
    const { winners, scores } = determineOrderingWinners(
      [1, 2, 3],
      [
        { id: "a", playerOrder: [1, 2, 3] },
        { id: "b", playerOrder: [1, 2, 3] },
      ]
    );
    expect(winners.size).toBe(2);
    expect(winners.has("a")).toBe(true);
    expect(winners.has("b")).toBe(true);
    expect(scores.get("a")).toBe(3);
    expect(scores.get("b")).toBe(3);
  });

  it("one player has most correct (>= 2) → that player wins", () => {
    const { winners, scores } = determineOrderingWinners(
      [1, 2, 3, 4],
      [
        { id: "a", playerOrder: [1, 2, 4, 3] }, // 2 correct (pos 0,1)
        { id: "b", playerOrder: [1, 3, 2, 4] }, // 2 correct (pos 0,3)
        { id: "c", playerOrder: [1, 2, 3, 1] }, // 3 correct (pos 0,1,2)
      ]
    );
    expect(winners.size).toBe(1);
    expect(winners.has("c")).toBe(true);
    expect(scores.get("c")).toBe(3);
  });

  it("tie for most correct (>= 2) → all tied players win", () => {
    const { winners } = determineOrderingWinners(
      [1, 2, 3],
      [
        { id: "a", playerOrder: [1, 2, 1] }, // 2 correct (pos 0,1)
        { id: "b", playerOrder: [1, 3, 3] }, // 2 correct (pos 0,2)
        { id: "c", playerOrder: [3, 2, 1] }, // 1 correct (pos 1)
      ]
    );
    expect(winners.size).toBe(2);
    expect(winners.has("a")).toBe(true);
    expect(winners.has("b")).toBe(true);
    expect(winners.has("c")).toBe(false);
  });

  it("nobody has >= 2 correct → nobody wins", () => {
    const { winners } = determineOrderingWinners(
      [1, 2, 3],
      [
        { id: "a", playerOrder: [3, 1, 2] }, // 0 correct
        { id: "b", playerOrder: [2, 1, 3] }, // 1 correct (pos 2)
      ]
    );
    expect(winners.size).toBe(0);
  });

  it("empty submissions → nobody wins", () => {
    const { winners, scores } = determineOrderingWinners([1, 2, 3], []);
    expect(winners.size).toBe(0);
    expect(scores.size).toBe(0);
  });

  it("empty correct order → nobody wins", () => {
    const { winners } = determineOrderingWinners(
      [],
      [{ id: "a", playerOrder: [1, 2, 3] }]
    );
    expect(winners.size).toBe(0);
  });

  it("3-item ordering (minimum)", () => {
    const { winners, scores } = determineOrderingWinners(
      [1, 2, 3],
      [
        { id: "a", playerOrder: [1, 2, 3] }, // 3 correct → wins
        { id: "b", playerOrder: [3, 2, 1] }, // 1 correct (pos 1)
      ]
    );
    expect(winners.size).toBe(1);
    expect(winners.has("a")).toBe(true);
    expect(scores.get("a")).toBe(3);
    expect(scores.get("b")).toBe(1);
  });

  it("4-item ordering (maximum)", () => {
    const { winners, scores } = determineOrderingWinners(
      [1, 2, 3, 4],
      [
        { id: "a", playerOrder: [1, 2, 3, 4] }, // 4 correct → wins
        { id: "b", playerOrder: [4, 3, 2, 1] }, // 0 correct
        { id: "c", playerOrder: [1, 2, 4, 3] }, // 2 correct (pos 0,1)
      ]
    );
    expect(winners.size).toBe(1);
    expect(winners.has("a")).toBe(true);
    expect(scores.get("a")).toBe(4);
    expect(scores.get("b")).toBe(0);
    expect(scores.get("c")).toBe(2);
  });

  it("handles mismatched lengths gracefully", () => {
    const correctOrder = [1, 2, 3, 4];
    const submissions = [
      { id: "a1", playerOrder: [1, 2, 3] }, // too short
      { id: "a2", playerOrder: [1, 2, 3, 4] }, // correct length, all correct
    ];
    const { winners, scores } = determineOrderingWinners(correctOrder, submissions);
    expect(winners.has("a2")).toBe(true);
    expect(scores.get("a1")).toBe(3); // matches first 3 positions
  });
});

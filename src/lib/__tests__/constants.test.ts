import { describe, it, expect } from "vitest";
import { ROUND_STATUS, GAME_STATUS, SEASON_STATUS } from "../constants";

describe("ROUND_STATUS", () => {
  it("should not include 'closed' status", () => {
    const values = Object.values(ROUND_STATUS);
    expect(values).not.toContain("closed");
  });

  it("should include all valid statuses in the game flow", () => {
    expect(ROUND_STATUS.PENDING).toBe("pending");
    expect(ROUND_STATUS.AWAITING_QUESTION).toBe("awaiting_question");
    expect(ROUND_STATUS.QUESTION_SUBMITTED).toBe("question_submitted");
    expect(ROUND_STATUS.CATEGORY_REVEALED).toBe("category_revealed");
    expect(ROUND_STATUS.GRADED).toBe("graded");
    expect(ROUND_STATUS.UNDER_REVIEW).toBe("under_review");
    expect(ROUND_STATUS.CANCELLED).toBe("cancelled");
  });

  it("should have exactly 7 statuses", () => {
    expect(Object.keys(ROUND_STATUS)).toHaveLength(7);
  });
});

describe("GAME_STATUS", () => {
  it("should have pending, active, completed", () => {
    expect(Object.values(GAME_STATUS)).toEqual(
      expect.arrayContaining(["pending", "active", "completed"])
    );
  });
});

describe("SEASON_STATUS", () => {
  it("should have pending, active, paused, completed", () => {
    expect(Object.values(SEASON_STATUS)).toEqual(
      expect.arrayContaining(["pending", "active", "paused", "completed"])
    );
  });
});

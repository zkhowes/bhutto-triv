import { describe, it, expect } from "vitest";
import { ROUND_STATUS } from "../constants";

/**
 * These tests codify the round status lifecycle after the removal of the
 * "closed" intermediate status. Rounds now auto-grade directly from
 * category_revealed -> graded when all answers are in.
 *
 * This prevents regressions where code still references the old "closed"
 * status that no longer exists in the game flow.
 */

// Valid transitions in the game flow
const VALID_TRANSITIONS: Record<string, string[]> = {
  [ROUND_STATUS.PENDING]: [ROUND_STATUS.AWAITING_QUESTION],
  [ROUND_STATUS.AWAITING_QUESTION]: [ROUND_STATUS.QUESTION_SUBMITTED],
  [ROUND_STATUS.QUESTION_SUBMITTED]: [ROUND_STATUS.CATEGORY_REVEALED],
  [ROUND_STATUS.CATEGORY_REVEALED]: [ROUND_STATUS.GRADED],
  [ROUND_STATUS.GRADED]: [ROUND_STATUS.UNDER_REVIEW, ROUND_STATUS.GRADED], // re-grade loops back
  [ROUND_STATUS.UNDER_REVIEW]: [ROUND_STATUS.GRADED, ROUND_STATUS.CANCELLED],
  [ROUND_STATUS.CANCELLED]: [],
};

describe("game flow state machine", () => {
  it("does not include 'closed' as a valid status", () => {
    const allStatuses = Object.values(ROUND_STATUS);
    expect(allStatuses).not.toContain("closed");
  });

  it("all ROUND_STATUS values appear in the transition map", () => {
    const allStatuses = Object.values(ROUND_STATUS);
    for (const status of allStatuses) {
      expect(VALID_TRANSITIONS).toHaveProperty(status);
    }
  });

  it("no transition targets a 'closed' status", () => {
    for (const [, targets] of Object.entries(VALID_TRANSITIONS)) {
      expect(targets).not.toContain("closed");
    }
  });

  it("category_revealed transitions directly to graded (no intermediate)", () => {
    const targets = VALID_TRANSITIONS[ROUND_STATUS.CATEGORY_REVEALED];
    expect(targets).toEqual([ROUND_STATUS.GRADED]);
  });

  it("graded can transition to under_review (flag) or re-grade (back to graded)", () => {
    const targets = VALID_TRANSITIONS[ROUND_STATUS.GRADED];
    expect(targets).toContain(ROUND_STATUS.UNDER_REVIEW);
    expect(targets).toContain(ROUND_STATUS.GRADED);
  });

  it("normal happy path: pending -> awaiting_question -> question_submitted -> category_revealed -> graded", () => {
    const happyPath = [
      ROUND_STATUS.PENDING,
      ROUND_STATUS.AWAITING_QUESTION,
      ROUND_STATUS.QUESTION_SUBMITTED,
      ROUND_STATUS.CATEGORY_REVEALED,
      ROUND_STATUS.GRADED,
    ];

    for (let i = 0; i < happyPath.length - 1; i++) {
      const from = happyPath[i];
      const to = happyPath[i + 1];
      expect(
        VALID_TRANSITIONS[from],
        `${from} should transition to ${to}`
      ).toContain(to);
    }
  });

  it("flag path: graded -> under_review -> graded (denied) or cancelled (upheld)", () => {
    expect(VALID_TRANSITIONS[ROUND_STATUS.GRADED]).toContain(ROUND_STATUS.UNDER_REVIEW);
    expect(VALID_TRANSITIONS[ROUND_STATUS.UNDER_REVIEW]).toContain(ROUND_STATUS.GRADED);
    expect(VALID_TRANSITIONS[ROUND_STATUS.UNDER_REVIEW]).toContain(ROUND_STATUS.CANCELLED);
  });
});

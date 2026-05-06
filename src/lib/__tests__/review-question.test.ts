import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { reviewQuestion, type ReviewablePayload } from "../ai";

const ORIGINAL_KEY = process.env.ANTHROPIC_API_KEY;

const baseOrdering: ReviewablePayload = {
  category: "Entertainment",
  questionText: "Put these Disney animated films in order by their original theatrical release date.",
  answerFormat: "ordering",
  orderingItems: ["Frozen", "The Lion King", "Snow White and the Seven Dwarfs", "Moana"],
  orderingCorrectOrder: [1, 2, 3, 4],
  orderingDirection: "earliest to latest",
  // Bug from Triangle Fellas G2R4: 1937 should belong to Snow White, 2013 to Frozen.
  orderingItemValues: [1937, 1994, 2013, 2016],
};

beforeEach(() => {
  vi.resetModules();
});

afterEach(() => {
  vi.unstubAllEnvs();
  process.env.ANTHROPIC_API_KEY = ORIGINAL_KEY;
});

describe("reviewQuestion — graceful fallback paths", () => {
  it("returns review_unavailable when ANTHROPIC_API_KEY is missing", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    const result = await reviewQuestion(baseOrdering);
    expect(result.status).toBe("review_unavailable");
    expect(result.changed).toBe(false);
    expect(result.corrected).toEqual(baseOrdering);
  });
});

describe("reviewQuestion — reviewer rewrites payload", () => {
  it("applies reviewer corrections when changed=true", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "test-key");
    vi.doMock("@anthropic-ai/sdk", () => ({
      default: class MockAnthropic {
        messages = {
          create: vi.fn(async () => ({
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  changed: true,
                  notes: "Frozen is 2013, Snow White is 1937 — values were transposed.",
                  corrected: {
                    ...baseOrdering,
                    // Reviewer re-sorts items + values to match earliest-to-latest
                    orderingItems: ["Snow White and the Seven Dwarfs", "The Lion King", "Frozen", "Moana"],
                    orderingItemValues: [1937, 1994, 2013, 2016],
                    orderingCorrectOrder: [1, 2, 3, 4],
                  },
                }),
              },
            ],
          })),
        };
      },
    }));
    const { reviewQuestion: fresh } = await import("../ai");
    const result = await fresh(baseOrdering);
    expect(result.status).toBe("ok");
    expect(result.changed).toBe(true);
    expect(result.corrected.orderingItems).toEqual([
      "Snow White and the Seven Dwarfs",
      "The Lion King",
      "Frozen",
      "Moana",
    ]);
    expect(result.corrected.orderingItemValues).toEqual([1937, 1994, 2013, 2016]);
    // Defensive invariant: orderingCorrectOrder always [1..n].
    expect(result.corrected.orderingCorrectOrder).toEqual([1, 2, 3, 4]);
    expect(result.notes).toMatch(/Frozen|Snow White/);
  });

  it("returns changed=false when reviewer reports no issues", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "test-key");
    vi.doMock("@anthropic-ai/sdk", () => ({
      default: class MockAnthropic {
        messages = {
          create: vi.fn(async () => ({
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  changed: false,
                  notes: "no issues found",
                  corrected: baseOrdering,
                }),
              },
            ],
          })),
        };
      },
    }));
    const { reviewQuestion: fresh } = await import("../ai");
    const result = await fresh(baseOrdering);
    expect(result.status).toBe("ok");
    expect(result.changed).toBe(false);
    expect(result.corrected).toEqual(baseOrdering);
  });

  it("returns review_error when reviewer returns non-JSON garbage", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "test-key");
    vi.doMock("@anthropic-ai/sdk", () => ({
      default: class MockAnthropic {
        messages = {
          create: vi.fn(async () => ({
            content: [{ type: "text", text: "I'm just chatting, not JSON." }],
          })),
        };
      },
    }));
    const { reviewQuestion: fresh } = await import("../ai");
    const result = await fresh(baseOrdering);
    expect(result.status).toBe("review_error");
    expect(result.changed).toBe(false);
    expect(result.corrected).toEqual(baseOrdering);
  });

  it("returns review_error when API call throws", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "test-key");
    vi.doMock("@anthropic-ai/sdk", () => ({
      default: class MockAnthropic {
        messages = {
          create: vi.fn(async () => {
            throw new Error("network down");
          }),
        };
      },
    }));
    const { reviewQuestion: fresh } = await import("../ai");
    const result = await fresh(baseOrdering);
    expect(result.status).toBe("review_error");
    expect(result.changed).toBe(false);
    expect(result.corrected).toEqual(baseOrdering);
    expect(result.notes).toMatch(/error|timed out/i);
  });

  it("forces orderingCorrectOrder to [1..n] even if reviewer drifts", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "test-key");
    vi.doMock("@anthropic-ai/sdk", () => ({
      default: class MockAnthropic {
        messages = {
          create: vi.fn(async () => ({
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  changed: true,
                  notes: "fixed",
                  corrected: {
                    ...baseOrdering,
                    orderingCorrectOrder: [4, 3, 2, 1], // bad: reviewer drifted
                  },
                }),
              },
            ],
          })),
        };
      },
    }));
    const { reviewQuestion: fresh } = await import("../ai");
    const result = await fresh(baseOrdering);
    expect(result.corrected.orderingCorrectOrder).toEqual([1, 2, 3, 4]);
  });

  it("truncates notes to 240 chars", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "test-key");
    const longNote = "x".repeat(1000);
    vi.doMock("@anthropic-ai/sdk", () => ({
      default: class MockAnthropic {
        messages = {
          create: vi.fn(async () => ({
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  changed: false,
                  notes: longNote,
                  corrected: baseOrdering,
                }),
              },
            ],
          })),
        };
      },
    }));
    const { reviewQuestion: fresh } = await import("../ai");
    const result = await fresh(baseOrdering);
    expect(result.notes.length).toBe(240);
  });
});

describe("reviewQuestion — multiple-choice corrections", () => {
  it("can flip correctOption when reviewer says so", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "test-key");
    const mc: ReviewablePayload = {
      category: "Geography",
      questionText: "What is the capital of Australia?",
      answerFormat: "multiple_choice",
      optionA: "Sydney",
      optionB: "Canberra",
      optionC: "Melbourne",
      optionD: "Perth",
      correctOption: "A", // wrong: should be B
    };
    vi.doMock("@anthropic-ai/sdk", () => ({
      default: class MockAnthropic {
        messages = {
          create: vi.fn(async () => ({
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  changed: true,
                  notes: "Capital of Australia is Canberra (B), not Sydney.",
                  corrected: { ...mc, correctOption: "B" },
                }),
              },
            ],
          })),
        };
      },
    }));
    const { reviewQuestion: fresh } = await import("../ai");
    const result = await fresh(mc);
    expect(result.changed).toBe(true);
    expect(result.corrected.correctOption).toBe("B");
  });
});

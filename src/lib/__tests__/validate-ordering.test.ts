import { describe, it, expect } from "vitest";
import { validateOrderingPayload, type WorkshopVariation } from "../ai";

const base: Omit<WorkshopVariation, "answerFormat"> = {
  category: "Geography",
  questionText: "Order these countries by area, largest to smallest",
  difficulty: "medium",
  hook: "",
};

describe("validateOrderingPayload", () => {
  it("passes a well-formed largest-to-smallest variation", () => {
    expect(
      validateOrderingPayload({
        ...base,
        answerFormat: "ordering",
        orderingItems: ["Algeria", "DRC", "South Africa", "Nigeria"],
        orderingCorrectOrder: [1, 2, 3, 4],
        orderingDirection: "largest to smallest",
        orderingItemValues: [2381741, 2344858, 1221037, 923768],
      })
    ).toBeNull();
  });

  it("passes a well-formed earliest-to-latest variation", () => {
    expect(
      validateOrderingPayload({
        ...base,
        answerFormat: "ordering",
        orderingItems: ["Star Wars", "Goodfellas", "Inception"],
        orderingCorrectOrder: [1, 2, 3],
        orderingDirection: "earliest to latest",
        orderingItemValues: [1977, 1990, 2010],
      } as WorkshopVariation)
    ).toBeNull();
  });

  it("rejects when orderingItemValues is missing", () => {
    const result = validateOrderingPayload({
      ...base,
      answerFormat: "ordering",
      orderingItems: ["A", "B", "C"],
      orderingCorrectOrder: [1, 2, 3],
      orderingDirection: "largest to smallest",
    });
    expect(result).toMatch(/orderingItemValues is required/);
  });

  it("rejects when orderingItemValues has any null entry", () => {
    const result = validateOrderingPayload({
      ...base,
      answerFormat: "ordering",
      orderingItems: ["A", "B", "C"],
      orderingCorrectOrder: [1, 2, 3],
      orderingDirection: "largest to smallest",
      orderingItemValues: [3, null, 1],
    });
    expect(result).toMatch(/value for every item/);
  });

  it("rejects when orderingItemValues length mismatches", () => {
    const result = validateOrderingPayload({
      ...base,
      answerFormat: "ordering",
      orderingItems: ["A", "B", "C"],
      orderingCorrectOrder: [1, 2, 3],
      orderingDirection: "largest to smallest",
      orderingItemValues: [3, 2],
    });
    expect(result).toMatch(/length must match/);
  });

  it("rejects items in opposite of stated direction (the Yap bug)", () => {
    // Items are smallest→largest by area but direction says largest→smallest.
    const result = validateOrderingPayload({
      ...base,
      answerFormat: "ordering",
      orderingItems: ["Nigeria", "South Africa", "Algeria", "DRC"],
      orderingCorrectOrder: [1, 2, 3, 4],
      orderingDirection: "largest to smallest",
      orderingItemValues: [923768, 1221037, 2381741, 2344858],
    });
    expect(result).toMatch(/not in 'largest to smallest' order/);
  });

  it("rejects items not in stated ascending direction", () => {
    const result = validateOrderingPayload({
      ...base,
      answerFormat: "ordering",
      orderingItems: ["B", "A", "C"],
      orderingCorrectOrder: [1, 2, 3],
      orderingDirection: "earliest to latest",
      orderingItemValues: [2000, 1990, 2010],
    });
    expect(result).toMatch(/not in 'earliest to latest' order/);
  });

  it("treats equal values as a tie (allows either order between them)", () => {
    expect(
      validateOrderingPayload({
        ...base,
        answerFormat: "ordering",
        orderingItems: ["A", "B", "C"],
        orderingCorrectOrder: [1, 2, 3],
        orderingDirection: "earliest to latest",
        orderingItemValues: [2000, 2000, 2010],
      })
    ).toBeNull();
  });

  it("passes unrecognized direction phrasing without checking values", () => {
    // Direction we can't classify (e.g. alphabetic) — still requires values to be
    // present, but we don't enforce monotonicity.
    expect(
      validateOrderingPayload({
        ...base,
        answerFormat: "ordering",
        orderingItems: ["B", "A", "C"],
        orderingCorrectOrder: [1, 2, 3],
        orderingDirection: "by alphabet",
        orderingItemValues: ["B", "A", "C"],
      })
    ).toBeNull();
  });

  it("requires 3-4 items", () => {
    expect(
      validateOrderingPayload({
        ...base,
        answerFormat: "ordering",
        orderingItems: ["A", "B"],
        orderingCorrectOrder: [1, 2],
        orderingDirection: "largest to smallest",
        orderingItemValues: [2, 1],
      })
    ).toMatch(/3-4 items/);
  });

  it("requires orderingCorrectOrder to be ascending [1..n]", () => {
    expect(
      validateOrderingPayload({
        ...base,
        answerFormat: "ordering",
        orderingItems: ["A", "B", "C"],
        orderingCorrectOrder: [2, 1, 3],
        orderingDirection: "largest to smallest",
        orderingItemValues: [3, 2, 1],
      })
    ).toMatch(/ascending/);
  });

  it("returns null for non-ordering format (no-op)", () => {
    expect(
      validateOrderingPayload({
        ...base,
        answerFormat: "multiple_choice",
      } as WorkshopVariation)
    ).toBeNull();
  });
});

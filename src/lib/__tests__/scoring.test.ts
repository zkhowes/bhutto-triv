import { describe, it, expect } from "vitest";
import { determinePirWinners } from "../scoring";

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

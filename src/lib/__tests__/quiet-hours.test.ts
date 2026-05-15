import { describe, it, expect } from "vitest";
import {
  isInQuietHours,
  quietEndAt,
  flushTimeFor,
  deferredSkipDeadline,
  type QuietHoursConfig,
} from "../quiet-hours";

const PACIFIC = "America/Los_Angeles";
const EASTERN = "America/New_York";

const DEFAULT_CFG: QuietHoursConfig = {
  quietHoursEnabled: true,
  quietHoursStart: 20,
  quietHoursEnd: 7,
};

// Helper to construct a Date at a given local hour in a specific timezone.
// We use a known UTC instant and verify by reading back via Intl.
function pacificDate(year: number, month: number, day: number, hour: number, minute = 0): Date {
  // Pacific is UTC-8 (or UTC-7 in DST). Try UTC-8 first; tests pick non-DST dates to keep simple.
  // For tests we'll use winter dates (PST = UTC-8).
  return new Date(Date.UTC(year, month - 1, day, hour + 8, minute, 0, 0));
}

function easternDate(year: number, month: number, day: number, hour: number, minute = 0): Date {
  return new Date(Date.UTC(year, month - 1, day, hour + 5, minute, 0, 0));
}

describe("isInQuietHours", () => {
  it("returns false when disabled regardless of hour", () => {
    const date = pacificDate(2026, 1, 15, 3); // 3 AM Pacific
    expect(isInQuietHours(date, { ...DEFAULT_CFG, quietHoursEnabled: false }, PACIFIC)).toBe(false);
  });

  it("treats 3 AM Pacific as quiet (default 20-7 wraparound)", () => {
    const date = pacificDate(2026, 1, 15, 3);
    expect(isInQuietHours(date, DEFAULT_CFG, PACIFIC)).toBe(true);
  });

  it("treats 7 AM Pacific as the boundary — exclusive end, NOT quiet", () => {
    const date = pacificDate(2026, 1, 15, 7);
    expect(isInQuietHours(date, DEFAULT_CFG, PACIFIC)).toBe(false);
  });

  it("treats 6:59 AM as still quiet", () => {
    const date = pacificDate(2026, 1, 15, 6, 59);
    expect(isInQuietHours(date, DEFAULT_CFG, PACIFIC)).toBe(true);
  });

  it("treats 8 PM Pacific as quiet (start hour, inclusive)", () => {
    const date = pacificDate(2026, 1, 15, 20);
    expect(isInQuietHours(date, DEFAULT_CFG, PACIFIC)).toBe(true);
  });

  it("treats 7:59 PM as not quiet", () => {
    const date = pacificDate(2026, 1, 15, 19, 59);
    expect(isInQuietHours(date, DEFAULT_CFG, PACIFIC)).toBe(false);
  });

  it("respects same-day window (start < end, no wraparound)", () => {
    const cfg: QuietHoursConfig = { quietHoursEnabled: true, quietHoursStart: 22, quietHoursEnd: 23 };
    expect(isInQuietHours(pacificDate(2026, 1, 15, 22, 30), cfg, PACIFIC)).toBe(true);
    expect(isInQuietHours(pacificDate(2026, 1, 15, 23, 0), cfg, PACIFIC)).toBe(false);
    expect(isInQuietHours(pacificDate(2026, 1, 15, 21, 59), cfg, PACIFIC)).toBe(false);
  });

  it("evaluates quiet hours in the configured timezone, not the recipient's clock", () => {
    // 10 AM Eastern is 7 AM Pacific. With Pacific TZ, 7 AM is OUT of quiet (boundary).
    // With Eastern TZ, 10 AM is clearly out of quiet. Both should be false.
    const date = easternDate(2026, 1, 15, 10);
    expect(isInQuietHours(date, DEFAULT_CFG, EASTERN)).toBe(false);
    // Same instant, but evaluated in Pacific (= 7 AM there) is also out of quiet (boundary).
    expect(isInQuietHours(date, DEFAULT_CFG, PACIFIC)).toBe(false);
  });

  it("returns false when start equals end (degenerate)", () => {
    const cfg: QuietHoursConfig = { quietHoursEnabled: true, quietHoursStart: 12, quietHoursEnd: 12 };
    expect(isInQuietHours(pacificDate(2026, 1, 15, 12), cfg, PACIFIC)).toBe(false);
  });
});

describe("quietEndAt", () => {
  it("returns same-day quiet-end when called before that hour", () => {
    // 3 AM Pacific → next quiet-end is 7 AM same day Pacific.
    const now = pacificDate(2026, 1, 15, 3);
    const result = quietEndAt(now, DEFAULT_CFG, PACIFIC);
    const expected = pacificDate(2026, 1, 15, 7);
    expect(result.getTime()).toBe(expected.getTime());
  });

  it("returns next-day quiet-end when called after that hour", () => {
    // 11 PM Pacific → next quiet-end is 7 AM next day Pacific.
    const now = pacificDate(2026, 1, 15, 23);
    const result = quietEndAt(now, DEFAULT_CFG, PACIFIC);
    const expected = pacificDate(2026, 1, 16, 7);
    expect(result.getTime()).toBe(expected.getTime());
  });

  it("returns next-day quiet-end when exactly at quiet-end hour", () => {
    // 7 AM exactly → today's 7 AM is now (not >now), so returns next-day 7 AM.
    const now = pacificDate(2026, 1, 15, 7);
    const result = quietEndAt(now, DEFAULT_CFG, PACIFIC);
    const expected = pacificDate(2026, 1, 16, 7);
    expect(result.getTime()).toBe(expected.getTime());
  });
});

describe("flushTimeFor", () => {
  it("equals quietEndAt when preferredSendHour is null", () => {
    const now = pacificDate(2026, 1, 15, 3);
    expect(flushTimeFor(now, DEFAULT_CFG, PACIFIC, null).getTime()).toBe(
      quietEndAt(now, DEFAULT_CFG, PACIFIC).getTime(),
    );
  });

  it("returns the preferred hour after quiet-end when later than quiet-end", () => {
    // 3 AM Pacific, prefer 9 AM → next 9 AM Pacific same day.
    const now = pacificDate(2026, 1, 15, 3);
    const result = flushTimeFor(now, DEFAULT_CFG, PACIFIC, 9);
    const expected = pacificDate(2026, 1, 15, 9);
    expect(result.getTime()).toBe(expected.getTime());
  });

  it("clamps preferred hour below quiet-end up to quiet-end", () => {
    // Prefer 5 AM but quiet-end is 7 AM → returns 7 AM.
    const now = pacificDate(2026, 1, 15, 3);
    const result = flushTimeFor(now, DEFAULT_CFG, PACIFIC, 5);
    const expected = pacificDate(2026, 1, 15, 7);
    expect(result.getTime()).toBe(expected.getTime());
  });

  it("respects preferred hour the day after quiet-end when called late evening", () => {
    // 11 PM Pacific, prefer 9 AM → next 9 AM tomorrow Pacific.
    const now = pacificDate(2026, 1, 15, 23);
    const result = flushTimeFor(now, DEFAULT_CFG, PACIFIC, 9);
    const expected = pacificDate(2026, 1, 16, 9);
    expect(result.getTime()).toBe(expected.getTime());
  });
});

describe("deferredSkipDeadline", () => {
  it("returns staleSince + 24h when that lands outside quiet hours", () => {
    // 11 AM Pacific stale → 11 AM next day, outside quiet.
    const stale = pacificDate(2026, 1, 14, 11);
    const result = deferredSkipDeadline(stale, DEFAULT_CFG, PACIFIC);
    const expected = pacificDate(2026, 1, 15, 11);
    expect(result.getTime()).toBe(expected.getTime());
  });

  it("defers skip to quiet-end + 1h when 24h lands inside quiet hours", () => {
    // 2 AM Pacific stale → 2 AM next day (in quiet) → quiet-end (7 AM) + 1h = 8 AM.
    const stale = pacificDate(2026, 1, 14, 2);
    const result = deferredSkipDeadline(stale, DEFAULT_CFG, PACIFIC);
    const expected = pacificDate(2026, 1, 15, 8);
    expect(result.getTime()).toBe(expected.getTime());
  });

  it("defers when 24h lands at evening quiet start (8 PM)", () => {
    // 8 PM Pacific stale → 8 PM next day (quiet) → quiet-end is 7 AM the FOLLOWING day → 8 AM.
    const stale = pacificDate(2026, 1, 14, 20);
    const result = deferredSkipDeadline(stale, DEFAULT_CFG, PACIFIC);
    const expected = pacificDate(2026, 1, 16, 8);
    expect(result.getTime()).toBe(expected.getTime());
  });

  it("does not defer when quiet hours disabled", () => {
    const cfg: QuietHoursConfig = { ...DEFAULT_CFG, quietHoursEnabled: false };
    const stale = pacificDate(2026, 1, 14, 2);
    const result = deferredSkipDeadline(stale, cfg, PACIFIC);
    const expected = pacificDate(2026, 1, 15, 2);
    expect(result.getTime()).toBe(expected.getTime());
  });
});

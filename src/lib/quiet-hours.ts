export const DEFAULT_QUIET_HOURS_TZ = "America/Los_Angeles";

export interface QuietHoursConfig {
  quietHoursEnabled: boolean;
  quietHoursStart: number;
  quietHoursEnd: number;
}

function localHour(date: Date, timezone: string): number {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hourCycle: "h23",
    hour: "2-digit",
  });
  return parseInt(fmt.format(date), 10);
}

function localYmd(date: Date, timezone: string): { year: number; month: number; day: number } {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = fmt.formatToParts(date);
  const get = (t: string) => parseInt(parts.find((p) => p.type === t)!.value, 10);
  return { year: get("year"), month: get("month"), day: get("day") };
}

function dateAtLocalHour(year: number, month: number, day: number, hour: number, timezone: string): Date {
  // Build a UTC instant near the target wall-clock, then correct for the timezone offset.
  // Iterate twice — DST transitions can move the offset by an hour.
  let utc = Date.UTC(year, month - 1, day, hour, 0, 0, 0);
  for (let i = 0; i < 2; i++) {
    const candidate = new Date(utc);
    const observedHour = localHour(candidate, timezone);
    const observedYmd = localYmd(candidate, timezone);
    const targetMs = Date.UTC(year, month - 1, day, hour, 0, 0, 0);
    const observedMs = Date.UTC(observedYmd.year, observedYmd.month - 1, observedYmd.day, observedHour, 0, 0, 0);
    const drift = targetMs - observedMs;
    if (drift === 0) return candidate;
    utc += drift;
  }
  return new Date(utc);
}

export function isInQuietHours(now: Date, config: QuietHoursConfig, timezone: string): boolean {
  if (!config.quietHoursEnabled) return false;
  const hour = localHour(now, timezone);
  const { quietHoursStart: start, quietHoursEnd: end } = config;
  if (start === end) return false;
  if (start < end) {
    // Same-day window (e.g. 1-5 = 1 AM to 5 AM)
    return hour >= start && hour < end;
  }
  // Wraparound window (e.g. 20-7 = 8 PM to 7 AM next day)
  return hour >= start || hour < end;
}

export function quietEndAt(now: Date, config: QuietHoursConfig, timezone: string): Date {
  const today = localYmd(now, timezone);
  const todayEnd = dateAtLocalHour(today.year, today.month, today.day, config.quietHoursEnd, timezone);
  if (todayEnd > now) return todayEnd;
  // End hour already passed today (typical when called in the evening) — return tomorrow.
  const tomorrow = new Date(todayEnd.getTime() + 24 * 60 * 60 * 1000);
  const tYmd = localYmd(tomorrow, timezone);
  return dateAtLocalHour(tYmd.year, tYmd.month, tYmd.day, config.quietHoursEnd, timezone);
}

export function flushTimeFor(
  now: Date,
  config: QuietHoursConfig,
  timezone: string,
  preferredSendHour: number | null,
): Date {
  const end = quietEndAt(now, config, timezone);
  if (preferredSendHour === null || preferredSendHour === undefined) return end;
  // Clamp preferred hour to the quiet-end hour as a floor — never schedule into quiet hours.
  const targetHour = Math.max(preferredSendHour, config.quietHoursEnd);
  if (targetHour === config.quietHoursEnd) return end;
  const endYmd = localYmd(end, timezone);
  return dateAtLocalHour(endYmd.year, endYmd.month, endYmd.day, targetHour, timezone);
}

export function deferredSkipDeadline(
  staleSince: Date,
  config: QuietHoursConfig,
  timezone: string,
): Date {
  const naturalDeadline = new Date(staleSince.getTime() + 24 * 60 * 60 * 1000);
  if (!isInQuietHours(naturalDeadline, config, timezone)) return naturalDeadline;
  const end = quietEndAt(naturalDeadline, config, timezone);
  return new Date(end.getTime() + 60 * 60 * 1000);
}

// Per-question answer-timer deadline. If it lands inside quiet hours, push to
// quiet-end + 1h so players aren't penalized for a deadline that falls during
// the league's quiet window. Returns { deadline, extended } so the UI can label
// the extension.
export function quietExtendedDeadline(
  naturalDeadline: Date,
  config: QuietHoursConfig,
  timezone: string,
): { deadline: Date; extended: boolean } {
  if (!isInQuietHours(naturalDeadline, config, timezone)) {
    return { deadline: naturalDeadline, extended: false };
  }
  const end = quietEndAt(naturalDeadline, config, timezone);
  return { deadline: new Date(end.getTime() + 60 * 60 * 1000), extended: true };
}

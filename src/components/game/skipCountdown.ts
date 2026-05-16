"use client";

import { useEffect, useState } from "react";
import { deferredSkipDeadline, DEFAULT_QUIET_HOURS_TZ, type QuietHoursConfig } from "@/lib/quiet-hours";

export interface QuietHoursProps {
  enabled: boolean;
  start: number;
  end: number;
  timezone: string;
}

const THREE_HOURS_MS = 3 * 60 * 60 * 1000;
const ONE_HOUR_MS = 60 * 60 * 1000;

export function formatSkipRemaining(ms: number): string {
  if (ms <= 0) return "overdue";
  const totalMinutes = Math.floor(ms / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes >= 15) return `${minutes}m`;
  return "< 15m";
}

export function skipColorClass(remaining: number): string {
  if (remaining <= ONE_HOUR_MS) return "text-red-400 animate-pulse";
  if (remaining <= THREE_HOURS_MS) return "text-amber-400";
  return "text-[#666680]";
}

function computeDeadline(roundUpdatedAt: string, quietHours: QuietHoursProps | null | undefined): number {
  const stale = new Date(roundUpdatedAt);
  const cfg: QuietHoursConfig = {
    quietHoursEnabled: quietHours?.enabled ?? false,
    quietHoursStart: quietHours?.start ?? 20,
    quietHoursEnd: quietHours?.end ?? 7,
  };
  const tz = quietHours?.timezone ?? DEFAULT_QUIET_HOURS_TZ;
  return deferredSkipDeadline(stale, cfg, tz).getTime();
}

// Returns remaining ms until auto-skip (deferred past quiet hours), null on first
// render before the effect runs, or a non-positive number once overdue. Consumers
// typically render null when remaining <= 0 to hide the countdown.
export function useSkipCountdown(
  roundUpdatedAt: string,
  quietHours: QuietHoursProps | null | undefined,
): number | null {
  const [remaining, setRemaining] = useState<number | null>(null);

  useEffect(() => {
    const deadline = computeDeadline(roundUpdatedAt, quietHours);
    const update = () => setRemaining(deadline - Date.now());
    update();
    const interval = setInterval(update, 60000);
    return () => clearInterval(interval);
  }, [roundUpdatedAt, quietHours]);

  return remaining;
}

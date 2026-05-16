"use client";

import {
  formatSkipRemaining,
  skipColorClass,
  useSkipCountdown,
  type QuietHoursProps,
} from "./skipCountdown";

interface DashboardSkipCountdownProps {
  roundUpdatedAt: string;
  quietHours?: QuietHoursProps | null;
}

export default function DashboardSkipCountdown({ roundUpdatedAt, quietHours }: DashboardSkipCountdownProps) {
  const remaining = useSkipCountdown(roundUpdatedAt, quietHours);

  if (remaining === null || remaining <= 0) return null;

  return (
    <p className={`text-xs mt-1 ${skipColorClass(remaining)}`}>
      {formatSkipRemaining(remaining)} until auto-skip
    </p>
  );
}

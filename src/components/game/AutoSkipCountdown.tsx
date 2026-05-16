"use client";

import {
  formatSkipRemaining,
  skipColorClass,
  useSkipCountdown,
  type QuietHoursProps,
} from "./skipCountdown";

interface AutoSkipCountdownProps {
  /** ISO string of round.updatedAt — natural deadline is this + 24 hours,
   *  deferred to quiet-end + 1h if that lands inside the league's quiet hours. */
  roundUpdatedAt: string;
  quietHours?: QuietHoursProps | null;
}

export default function AutoSkipCountdown({ roundUpdatedAt, quietHours }: AutoSkipCountdownProps) {
  const remaining = useSkipCountdown(roundUpdatedAt, quietHours);

  if (remaining === null || remaining <= 0) return null;

  return (
    <div className={`flex items-center gap-1 text-xs ${skipColorClass(remaining)} mt-1`}>
      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      <span>{formatSkipRemaining(remaining)} until auto-skip</span>
    </div>
  );
}

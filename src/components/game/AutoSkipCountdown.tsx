"use client";

import { useEffect, useState } from "react";

interface AutoSkipCountdownProps {
  /** ISO string of round.updatedAt — deadline is this + 27 hours */
  roundUpdatedAt: string;
}

function formatRemaining(ms: number): string {
  if (ms <= 0) return "overdue";
  const totalMinutes = Math.floor(ms / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes >= 15) return `${minutes}m`;
  return "< 15m";
}

export default function AutoSkipCountdown({ roundUpdatedAt }: AutoSkipCountdownProps) {
  const [remaining, setRemaining] = useState<number | null>(null);

  useEffect(() => {
    const deadline = new Date(roundUpdatedAt).getTime() + 27 * 60 * 60 * 1000;
    const update = () => setRemaining(deadline - Date.now());
    update();
    const interval = setInterval(update, 60000);
    return () => clearInterval(interval);
  }, [roundUpdatedAt]);

  if (remaining === null) return null;
  if (remaining <= 0) return null;

  const threeHours = 3 * 60 * 60 * 1000;
  const oneHour = 60 * 60 * 1000;
  const isWarning = remaining <= threeHours;
  const isUrgent = remaining <= oneHour;

  const colorClass = isUrgent
    ? "text-red-400 animate-pulse"
    : isWarning
      ? "text-amber-400"
      : "text-[#666680]";

  return (
    <div className={`flex items-center gap-1 text-xs ${colorClass} mt-1`}>
      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      <span>{formatRemaining(remaining)} until auto-skip</span>
    </div>
  );
}

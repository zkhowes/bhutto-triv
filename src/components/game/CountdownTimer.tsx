"use client";

import { useState, useEffect } from "react";

interface CountdownTimerProps {
  deadlineTime: string; // ISO datetime string
  onExpired?: () => void;
}

export default function CountdownTimer({ deadlineTime, onExpired }: CountdownTimerProps) {
  const [secondsLeft, setSecondsLeft] = useState<number>(() => {
    const diff = Math.floor((new Date(deadlineTime).getTime() - Date.now()) / 1000);
    return Math.max(0, diff);
  });

  useEffect(() => {
    const interval = setInterval(() => {
      const diff = Math.floor((new Date(deadlineTime).getTime() - Date.now()) / 1000);
      const remaining = Math.max(0, diff);
      setSecondsLeft(remaining);
      if (remaining === 0) {
        clearInterval(interval);
        onExpired?.();
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [deadlineTime, onExpired]);

  const minutes = Math.floor(secondsLeft / 60);
  const seconds = secondsLeft % 60;
  const isUrgent = secondsLeft <= 30;
  const isExpired = secondsLeft === 0;

  if (isExpired) {
    return (
      <div className="text-red-400 text-sm font-bold">
        Time&apos;s up!
      </div>
    );
  }

  return (
    <div className={`font-mono text-lg font-bold ${isUrgent ? "text-red-400 animate-pulse" : "text-amber-400"}`}>
      {minutes}:{seconds.toString().padStart(2, "0")}
    </div>
  );
}

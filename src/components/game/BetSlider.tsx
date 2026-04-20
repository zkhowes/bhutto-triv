"use client";

import { useCallback, useEffect, useRef } from "react";

interface BetSliderProps {
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
}

/**
 * Custom bet slider: oversized hit area so both the floating value bubble
 * and the thumb are grabbable, and responds to the first pointer touch
 * without the native-range "scroll vs drag" disambiguation delay.
 */
export default function BetSlider({ value, min, max, onChange }: BetSliderProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);
  const onChangeRef = useRef(onChange);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  const span = Math.max(max - min, 1);
  const percent = ((value - min) / span) * 100;

  const updateFromClientX = useCallback(
    (clientX: number) => {
      const el = trackRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const ratio = Math.min(Math.max((clientX - rect.left) / rect.width, 0), 1);
      const raw = min + ratio * span;
      const next = Math.round(raw);
      if (next >= min && next <= max) onChangeRef.current(next);
    },
    [min, max, span]
  );

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      e.preventDefault();
      draggingRef.current = true;
      (e.target as Element).setPointerCapture?.(e.pointerId);
      updateFromClientX(e.clientX);
    },
    [updateFromClientX]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!draggingRef.current) return;
      updateFromClientX(e.clientX);
    },
    [updateFromClientX]
  );

  const handlePointerUp = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      draggingRef.current = false;
      (e.target as Element).releasePointerCapture?.(e.pointerId);
    },
    []
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (e.key === "ArrowLeft" || e.key === "ArrowDown") {
        e.preventDefault();
        if (value > min) onChangeRef.current(value - 1);
      } else if (e.key === "ArrowRight" || e.key === "ArrowUp") {
        e.preventDefault();
        if (value < max) onChangeRef.current(value + 1);
      } else if (e.key === "Home") {
        e.preventDefault();
        onChangeRef.current(min);
      } else if (e.key === "End") {
        e.preventDefault();
        onChangeRef.current(max);
      }
    },
    [value, min, max]
  );

  return (
    <div
      ref={trackRef}
      role="slider"
      tabIndex={0}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={value}
      aria-label="Bet amount"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onKeyDown={handleKeyDown}
      className="relative w-full select-none cursor-pointer"
      style={{ height: 88, touchAction: "none", WebkitTapHighlightColor: "transparent" }}
    >
      {/* Track */}
      <div
        className="absolute left-0 right-0 rounded-full bg-[#1e3a5f]"
        style={{ height: 12, top: 64 }}
      />
      {/* Filled track */}
      <div
        className="absolute left-0 rounded-full bg-[#fbbf24]/40"
        style={{ height: 12, top: 64, width: `${percent}%` }}
      />
      {/* Thumb + bubble — single visual unit centered on value */}
      <div
        className="absolute -translate-x-1/2 pointer-events-none"
        style={{ left: `${percent}%`, top: 0 }}
      >
        {/* Value bubble */}
        <div className="bg-[#fbbf24] text-black text-sm font-bold px-2.5 py-0.5 rounded-full whitespace-nowrap text-center min-w-[32px]">
          {value}
        </div>
        <div className="w-0 h-0 mx-auto border-l-[5px] border-r-[5px] border-t-[5px] border-transparent border-t-[#fbbf24]" />
        {/* Thumb — aligned to track (track top = 64, track height = 12 → center at 70) */}
        <div
          className="rounded-full bg-[#fbbf24]"
          style={{
            width: 56,
            height: 56,
            marginLeft: -28,
            marginTop: 14,
            boxShadow: "0 0 16px rgba(251, 191, 36, 0.5)",
            border: "4px solid #1a1a2e",
          }}
        />
      </div>
    </div>
  );
}

"use client";

import { useState, useRef, useEffect } from "react";

interface InfoTooltipProps {
  text: string;
}

export default function InfoTooltip({ text }: InfoTooltipProps) {
  const [showTooltip, setShowTooltip] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const iconRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (showTooltip && iconRef.current) {
      const rect = iconRef.current.getBoundingClientRect();
      // Clamp horizontally so the tooltip stays within viewport
      const left = Math.max(140, Math.min(rect.left + rect.width / 2, window.innerWidth - 140));
      setPosition({
        top: rect.top - 10,
        left,
      });
    }
  }, [showTooltip]);

  const toggle = () => setShowTooltip((prev) => !prev);

  return (
    <>
      <span
        ref={iconRef}
        className="inline-flex"
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        onClick={toggle}
      >
        <span className="w-5 h-5 rounded-full bg-[#1e3a5f] text-[#a0a0b8] text-xs font-bold flex items-center justify-center cursor-help">
          i
        </span>
      </span>
      {showTooltip && (
        <span
          className="fixed px-3 py-2 bg-[#0f0f23] border border-[#1e3a5f] rounded-lg text-xs text-[#a0a0b8] shadow-lg pointer-events-none max-w-[280px] text-center leading-relaxed"
          style={{
            top: `${position.top}px`,
            left: `${position.left}px`,
            transform: 'translate(-50%, -100%)',
            zIndex: 9999,
          }}
        >
          {text}
        </span>
      )}
    </>
  );
}

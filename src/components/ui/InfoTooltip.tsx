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
      setPosition({
        top: rect.top - 10,
        left: rect.left + rect.width / 2,
      });
    }
  }, [showTooltip]);

  return (
    <>
      <span
        ref={iconRef}
        className="inline-flex"
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
      >
        <span className="w-4 h-4 rounded-full bg-[#1e3a5f] text-[#a0a0b8] text-[10px] font-bold flex items-center justify-center cursor-help">
          i
        </span>
      </span>
      {showTooltip && (
        <span
          className="fixed px-3 py-2 bg-[#0f0f23] border border-[#1e3a5f] rounded-lg text-xs text-[#a0a0b8] whitespace-nowrap shadow-lg pointer-events-none"
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

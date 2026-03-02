"use client";

import { useState } from "react";

interface StarRatingProps {
  value: number;
  onChange?: (rating: number) => void;
  size?: "sm" | "md";
  showLabel?: boolean;
}

export default function StarRating({
  value,
  onChange,
  size = "md",
  showLabel = false,
}: StarRatingProps) {
  const [hovered, setHovered] = useState(0);
  const interactive = !!onChange;
  const starSize = size === "sm" ? 16 : 24;

  return (
    <div className="inline-flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((star) => {
        const filled = interactive
          ? star <= (hovered || Math.round(value))
          : star <= Math.round(value);
        const partial =
          !interactive && !filled && star - 1 < value && star > value;

        return (
          <button
            key={star}
            type="button"
            disabled={!interactive}
            onClick={() => onChange?.(star)}
            onMouseEnter={() => interactive && setHovered(star)}
            onMouseLeave={() => interactive && setHovered(0)}
            className={`p-0 border-0 bg-transparent ${
              interactive
                ? "cursor-pointer hover:scale-110 transition-transform"
                : "cursor-default"
            }`}
          >
            <svg
              width={starSize}
              height={starSize}
              viewBox="0 0 24 24"
              fill={filled ? "#fbbf24" : partial ? "#fbbf24" : "none"}
              stroke={filled || partial ? "#fbbf24" : "#666680"}
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity={partial ? 0.5 : 1}
            >
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
            </svg>
          </button>
        );
      })}
      {showLabel && value > 0 && (
        <span className="text-sm text-[#fbbf24] font-medium ml-1">
          {value.toFixed(1)}
        </span>
      )}
    </div>
  );
}

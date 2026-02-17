"use client";

interface AvatarProps {
  src?: string | null;
  name?: string | null;
  size?: "sm" | "md" | "lg";
}

const sizeClasses = {
  sm: "w-8 h-8 text-xs",
  md: "w-10 h-10 text-sm",
  lg: "w-16 h-16 text-xl",
};

export default function Avatar({ src, name, size = "sm" }: AvatarProps) {
  const cls = sizeClasses[size];
  const initial = name?.[0]?.toUpperCase() || "?";

  if (src) {
    return (
      <img
        src={src}
        alt={name || "Avatar"}
        className={`${cls} rounded-full object-cover flex-shrink-0`}
      />
    );
  }

  return (
    <div
      className={`${cls} rounded-full bg-[#e94560] flex items-center justify-center font-bold text-white flex-shrink-0`}
    >
      {initial}
    </div>
  );
}

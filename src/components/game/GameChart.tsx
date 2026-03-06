"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { useState } from "react";

const COLORS = [
  "#e94560",
  "#fbbf24",
  "#34d399",
  "#60a5fa",
  "#a78bfa",
  "#f472b6",
  "#fb923c",
  "#2dd4bf",
  "#818cf8",
  "#f87171",
];

interface GameChartProps {
  data: Array<Record<string, number | string>>;
  playerNames: string[];
  playerAvatars: Record<string, string>;
}

function AvatarDot({ cx, cy, avatarUrl, color }: { cx: number; cy: number; avatarUrl: string; color: string }) {
  if (!cx || !cy) return null;
  const size = 20;
  const clipId = `avatar-clip-${cx}-${cy}`;
  return (
    <g>
      <defs>
        <clipPath id={clipId}>
          <circle cx={cx} cy={cy} r={size / 2} />
        </clipPath>
      </defs>
      {avatarUrl ? (
        <>
          <image
            href={avatarUrl}
            x={cx - size / 2}
            y={cy - size / 2}
            width={size}
            height={size}
            clipPath={`url(#${clipId})`}
          />
          <circle cx={cx} cy={cy} r={size / 2} fill="none" stroke={color} strokeWidth={2} />
        </>
      ) : (
        <circle cx={cx} cy={cy} r={size / 2} fill={color} />
      )}
    </g>
  );
}

function CustomDot(props: Record<string, unknown>) {
  const { cx, cy, index, avatarUrl, color } = props as { cx: number; cy: number; index: number; avatarUrl: string; color: string };
  if (index === 0) {
    return <AvatarDot cx={cx} cy={cy} avatarUrl={avatarUrl} color={color} />;
  }
  return <circle cx={cx} cy={cy} r={3} fill={color} stroke={color} />;
}

function CustomTooltip({ active, payload, label, hoveredPlayer }: { active?: boolean; payload?: Array<{ dataKey: string; name: string; value: number; color: string }>; label?: string | number; hoveredPlayer: string | null }) {
  if (!active || !payload || !hoveredPlayer) return null;

  const entry = payload.find((p: { dataKey: string }) => p.dataKey === hoveredPlayer);
  if (!entry) return null;

  return (
    <div
      style={{
        backgroundColor: "#1a1a2e",
        border: "1px solid #1e3a5f",
        borderRadius: "8px",
        padding: "8px 12px",
        fontSize: "12px",
      }}
    >
      <p style={{ color: "#a0a0b8", margin: 0, marginBottom: 4 }}>
        {label === "Start" ? "Start" : `Round ${label}`}
      </p>
      <p style={{ color: entry.color, margin: 0, fontWeight: 600 }}>
        {entry.name}: {entry.value} pts
      </p>
    </div>
  );
}

export default function GameChart({ data, playerNames, playerAvatars }: GameChartProps) {
  const [hoveredPlayer, setHoveredPlayer] = useState<string | null>(null);

  if (data.length < 2) return null;

  return (
    <div className="card p-5">
      <h2 className="text-sm font-semibold text-[#a0a0b8] uppercase tracking-wider mb-4">
        Game Progress
      </h2>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e3a5f" />
            <XAxis
              dataKey="round"
              stroke="#666680"
              tick={{ fill: "#a0a0b8", fontSize: 12 }}
              label={{ value: "Round", position: "insideBottom", offset: -5, fill: "#666680", fontSize: 11 }}
            />
            <YAxis
              stroke="#666680"
              tick={{ fill: "#a0a0b8", fontSize: 12 }}
              label={{ value: "Points", angle: -90, position: "insideLeft", fill: "#666680", fontSize: 11 }}
            />
            <Tooltip
              content={<CustomTooltip hoveredPlayer={hoveredPlayer} />}
            />
            {playerNames.map((name, i) => {
              const color = COLORS[i % COLORS.length];
              return (
                <Line
                  key={name}
                  type="monotone"
                  dataKey={name}
                  stroke={color}
                  strokeWidth={2}
                  dot={<CustomDot avatarUrl={playerAvatars[name]} color={color} />}
                  activeDot={{ r: 5, onMouseOver: () => setHoveredPlayer(name) }}
                  onMouseEnter={() => setHoveredPlayer(name)}
                  onMouseLeave={() => setHoveredPlayer(null)}
                />
              );
            })}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

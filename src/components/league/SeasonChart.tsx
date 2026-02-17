"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

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

interface SeasonChartProps {
  data: Array<Record<string, number>>;
  playerNames: string[];
}

export default function SeasonChart({ data, playerNames }: SeasonChartProps) {
  if (data.length < 2) return null;

  return (
    <div className="card p-5">
      <h2 className="text-sm font-semibold text-[#a0a0b8] uppercase tracking-wider mb-4">
        Season Progress
      </h2>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e3a5f" />
            <XAxis
              dataKey="game"
              stroke="#666680"
              tick={{ fill: "#a0a0b8", fontSize: 12 }}
              label={{ value: "Game", position: "insideBottom", offset: -5, fill: "#666680", fontSize: 11 }}
            />
            <YAxis
              stroke="#666680"
              tick={{ fill: "#a0a0b8", fontSize: 12 }}
              label={{ value: "F1 Points", angle: -90, position: "insideLeft", fill: "#666680", fontSize: 11 }}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "#1a1a2e",
                border: "1px solid #1e3a5f",
                borderRadius: "8px",
                color: "#e8e8e8",
                fontSize: "12px",
              }}
            />
            <Legend
              wrapperStyle={{ fontSize: "12px", color: "#a0a0b8" }}
            />
            {playerNames.map((name, i) => (
              <Line
                key={name}
                type="monotone"
                dataKey={name}
                stroke={COLORS[i % COLORS.length]}
                strokeWidth={2}
                dot={{ r: 3 }}
                activeDot={{ r: 5 }}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

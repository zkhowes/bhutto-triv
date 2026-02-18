"use client";

import { useState, useEffect } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface ChartCardProps {
  title: string;
  metric: "players" | "leagues" | "games_started" | "games_completed" | "questions";
}

export default function ChartCard({ title, metric }: ChartCardProps) {
  const [data, setData] = useState<Array<{ date: string; value: number }>>([]);
  const [range, setRange] = useState<"7d" | "30d" | "90d" | "all">("30d");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/admin/timeseries?metric=${metric}&range=${range}`)
      .then((r) => r.json())
      .then((result) => {
        setData(result.data || []);
      })
      .catch((err) => {
        console.error("Failed to fetch chart data:", err);
        setData([]);
      })
      .finally(() => setLoading(false));
  }, [metric, range]);

  return (
    <div className="bg-[#1e3a5f] rounded-lg p-6 border border-[#2a4a6f]">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold text-amber-400">{title}</h3>
        <select
          value={range}
          onChange={(e) => setRange(e.target.value as any)}
          className="px-3 py-1 bg-[#0d1b2a] border border-[#2a4a6f] rounded-lg text-white text-sm focus:outline-none focus:border-amber-500"
        >
          <option value="7d">7 Days</option>
          <option value="30d">30 Days</option>
          <option value="90d">90 Days</option>
          <option value="all">All Time</option>
        </select>
      </div>

      {loading ? (
        <div className="h-[200px] flex items-center justify-center">
          <div className="animate-pulse text-[#a0a0b8]">Loading...</div>
        </div>
      ) : data.length === 0 ? (
        <div className="h-[200px] flex items-center justify-center">
          <div className="text-[#666680]">No data available</div>
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e3a5f" />
            <XAxis
              dataKey="date"
              stroke="#a0a0b8"
              tick={{ fontSize: 12 }}
              tickFormatter={(value) => {
                // Format date based on range
                const date = new Date(value);
                if (range === "7d" || range === "30d") {
                  return `${date.getMonth() + 1}/${date.getDate()}`;
                } else if (range === "90d") {
                  return `${date.getMonth() + 1}/${date.getDate()}`;
                } else {
                  return `${date.getMonth() + 1}/${date.getFullYear().toString().slice(2)}`;
                }
              }}
            />
            <YAxis stroke="#a0a0b8" tick={{ fontSize: 12 }} />
            <Tooltip
              contentStyle={{
                backgroundColor: "#0d1b2a",
                border: "1px solid #1e3a5f",
                borderRadius: "8px",
              }}
              labelStyle={{ color: "#a0a0b8" }}
              itemStyle={{ color: "#e94560" }}
            />
            <Line
              type="monotone"
              dataKey="value"
              stroke="#e94560"
              strokeWidth={2}
              dot={{ fill: "#e94560", r: 3 }}
              activeDot={{ r: 5 }}
            />
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}

"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { BarChart2, Users, TrendingUp, Zap } from "lucide-react";

const VOLUME_DATA: Record<"7d" | "30d" | "all", { date: string; volume: number }[]> = {
  "7d": [
    { date: "Mon", volume: 1200000 },
    { date: "Tue", volume: 1850000 },
    { date: "Wed", volume: 980000 },
    { date: "Thu", volume: 2100000 },
    { date: "Fri", volume: 1650000 },
    { date: "Sat", volume: 1320000 },
    { date: "Sun", volume: 1780000 },
  ],
  "30d": [
    { date: "W1", volume: 8200000 },
    { date: "W2", volume: 11400000 },
    { date: "W3", volume: 9800000 },
    { date: "W4", volume: 13200000 },
  ],
  "all": [
    { date: "Jan", volume: 28000000 },
    { date: "Feb", volume: 34000000 },
    { date: "Mar", volume: 41000000 },
    { date: "Apr", volume: 38000000 },
    { date: "May", volume: 52000000 },
    { date: "Jun", volume: 47000000 },
  ],
};

const DEX_DISTRIBUTION = [
  { name: "Uniswap V3", value: 45, color: "#FF007A" },
  { name: "Aerodrome", value: 28, color: "#0052FF" },
  { name: "SushiSwap", value: 15, color: "#FA52A0" },
  { name: "PancakeSwap", value: 8, color: "#1FC7D4" },
  { name: "Others", value: 4, color: "#4A4E65" },
];

const TOP_PAIRS = [
  { pair: "ETH / USDC", volume: "$4.2M", trades: 1842, change: "+12.4%" },
  { pair: "WETH / USDC", volume: "$2.8M", trades: 1203, change: "+8.7%" },
  { pair: "ETH / BRETT", volume: "$1.1M", trades: 687, change: "+34.2%" },
  { pair: "USDC / USDT", volume: "$890K", trades: 432, change: "-2.1%" },
  { pair: "ETH / DEGEN", volume: "$650K", trades: 312, change: "+18.9%" },
];

export default function StatsPage() {
  const [period, setPeriod] = useState<"7d" | "30d" | "all">("7d");
  const volumeData = VOLUME_DATA[period];
  const totalVolume = volumeData.reduce((s, d) => s + d.volume, 0);

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10">
      {/* Background */}
      <div
        className="fixed top-1/3 left-1/4 w-[500px] h-[400px] pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse at center, rgba(0,82,255,0.04) 0%, transparent 70%)",
        }}
      />

      {/* Header */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-base-blue/30 bg-base-blue/10 mb-4">
          <BarChart2 className="w-4 h-4 text-base-blue" />
          <span className="text-sm font-medium text-base-blue">Analytics</span>
        </div>
        <h1 className="text-3xl font-bold text-text-primary mb-2">
          Protocol Stats
        </h1>
        <p className="text-text-secondary text-sm">
          Real-time trading statistics for Baseora on Base
        </p>
        {/* Demo data disclaimer */}
        <div className="inline-flex items-center gap-2 mt-3 px-3 py-1.5 rounded-full border border-warning/30 bg-warning/10">
          <span className="text-xs text-warning font-medium">⚠ Demo data — connect Supabase for live stats</span>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          {
            label: "Total Volume (7d)",
            value: "$10.88M",
            change: "+23.4%",
            icon: <TrendingUp className="w-5 h-5 text-success" />,
            positive: true,
          },
          {
            label: "Unique Traders",
            value: "2,847",
            change: "+14.2%",
            icon: <Users className="w-5 h-5 text-base-blue" />,
            positive: true,
          },
          {
            label: "Total Swaps",
            value: "18,432",
            change: "+31.8%",
            icon: <Zap className="w-5 h-5 text-warning" />,
            positive: true,
          },
          {
            label: "Avg. Savings vs Direct",
            value: "$1.42",
            change: "per swap",
            icon: <BarChart2 className="w-5 h-5 text-success" />,
            positive: true,
          },
        ].map((stat) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass-card p-4"
          >
            <div className="flex items-center justify-between mb-3">
              {stat.icon}
              <span
                className={`text-xs font-semibold px-1.5 py-0.5 rounded-full ${
                  stat.positive
                    ? "text-success bg-success/10"
                    : "text-error bg-error/10"
                }`}
              >
                {stat.change}
              </span>
            </div>
            <div className="text-lg sm:text-xl font-bold font-mono text-text-primary">
              {stat.value}
            </div>
            <div className="text-xs text-text-muted mt-0.5">{stat.label}</div>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Volume chart */}
        <div className="lg:col-span-2 glass-card p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold">Trading Volume</h2>
            <div className="flex gap-1">
              {(["7d", "30d", "all"] as const).map((p) => (
                <button
                  key={p}
                  onClick={() => setPeriod(p)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                    period === p
                      ? "bg-base-blue text-white"
                      : "text-text-secondary hover:text-text-primary"
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={volumeData} barSize={24}>
              <XAxis
                dataKey="date"
                axisLine={false}
                tickLine={false}
                tick={{ fill: "#8B8FA8", fontSize: 12 }}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fill: "#8B8FA8", fontSize: 11 }}
                tickFormatter={(v) => `$${(v / 1000000).toFixed(1)}M`}
              />
              <Tooltip
                contentStyle={{
                  background: "#111318",
                  border: "1px solid #252830",
                  borderRadius: 8,
                  color: "#fff",
                }}
                formatter={(v: number) => [`$${(v / 1000000).toFixed(2)}M`, "Volume"]}
              />
              <Bar
                dataKey="volume"
                fill="url(#statsBlueGradient)"
                radius={[4, 4, 0, 0]}
              />
              <defs>
                <linearGradient id="statsBlueGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#0052FF" />
                  <stop offset="100%" stopColor="#0052FF" stopOpacity={0.4} />
                </linearGradient>
              </defs>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* DEX distribution */}
        <div className="glass-card p-4">
          <h2 className="font-semibold mb-4">DEX Distribution</h2>
          <ResponsiveContainer width="100%" height={160}>
            <PieChart>
              <Pie
                data={DEX_DISTRIBUTION}
                dataKey="value"
                innerRadius={45}
                outerRadius={70}
                paddingAngle={2}
              >
                {DEX_DISTRIBUTION.map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  background: "#111318",
                  border: "1px solid #252830",
                  borderRadius: 8,
                  color: "#fff",
                }}
                itemStyle={{ color: "#fff" }}
                labelStyle={{ color: "#8B8FA8" }}
                formatter={(value: number, name: string) => [`${value}%`, name]}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="space-y-2 mt-3">
            {DEX_DISTRIBUTION.map((d) => (
              <div key={d.name} className="flex items-center gap-2">
                <div
                  className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                  style={{ background: d.color }}
                />
                <span className="text-xs text-text-secondary flex-1">{d.name}</span>
                <span className="text-xs font-semibold font-mono text-text-primary">
                  {d.value}%
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Top pairs */}
        <div className="lg:col-span-3 glass-card p-4">
          <h2 className="font-semibold mb-4">Top Trading Pairs</h2>
          <div className="overflow-x-auto -mx-4 px-4">
            <table className="w-full min-w-[400px]">
              <thead>
                <tr className="text-left">
                  {["Pair", "Volume", "Trades", "Change"].map((h) => (
                    <th key={h} className="pb-3 text-xs font-medium text-text-muted uppercase tracking-wide">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {TOP_PAIRS.map((pair) => (
                  <tr key={pair.pair} className="border-t border-border">
                    <td className="py-2.5 font-semibold text-sm">{pair.pair}</td>
                    <td className="py-2.5 font-mono text-sm text-text-secondary">{pair.volume}</td>
                    <td className="py-2.5 font-mono text-sm text-text-secondary">{pair.trades.toLocaleString()}</td>
                    <td className={`py-2.5 font-semibold text-sm font-mono ${pair.change.startsWith("+") ? "text-success" : "text-error"}`}>
                      {pair.change}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

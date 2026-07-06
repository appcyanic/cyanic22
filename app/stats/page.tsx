"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from "recharts";
import { BarChart2, Users, TrendingUp, Zap, RefreshCw } from "lucide-react";
import { supabase } from "@/lib/supabase";

const DEX_COLORS = ["#FF007A", "#0052FF", "#FA52A0", "#1FC7D4", "#4A4E65"];

interface Stats {
  totalSwaps: number;
  totalVolume: number;
  totalUsers: number;
  totalXP: number;
  topTraders: { wallet_address: string; total_xp: number; swap_count: number; total_volume_usd: number }[];
}

export default function StatsPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [xpDistribution, setXpDistribution] = useState<{ name: string; value: number; color: string }[]>([]);

  useEffect(() => {
    const fetchStats = async () => {
      setLoading(true);
      try {
        // Fetch aggregated stats
        const { data: users } = await supabase
          .from("user_points")
          .select("total_xp, swap_count, total_volume_usd")
          .order("total_xp", { ascending: false })
          .limit(100);

        const { data: topTraders } = await supabase
          .from("user_points")
          .select("wallet_address, total_xp, swap_count, total_volume_usd")
          .order("total_xp", { ascending: false })
          .limit(5);

        if (users) {
          const totalSwaps   = users.reduce((s, u) => s + (u.swap_count ?? 0), 0);
          const totalVolume  = users.reduce((s, u) => s + (u.total_volume_usd ?? 0), 0);
          const totalXP      = users.reduce((s, u) => s + (u.total_xp ?? 0), 0);

          setStats({
            totalSwaps,
            totalVolume,
            totalUsers:  users.length,
            totalXP,
            topTraders:  topTraders ?? [],
          });

          // XP level distribution
          const levels = { Bronze: 0, Silver: 0, Gold: 0, Platinum: 0, Diamond: 0, Elite: 0 };
          users.forEach(u => {
            const xp = u.total_xp ?? 0;
            if      (xp >= 50000) levels.Elite++;
            else if (xp >= 25000) levels.Diamond++;
            else if (xp >= 10000) levels.Platinum++;
            else if (xp >= 5000)  levels.Gold++;
            else if (xp >= 1000)  levels.Silver++;
            else                  levels.Bronze++;
          });
          setXpDistribution(
            Object.entries(levels)
              .filter(([, v]) => v > 0)
              .map(([name, value], i) => ({ name, value, color: DEX_COLORS[i % DEX_COLORS.length] }))
          );
        }
      } catch { /* ignore */ }
      finally { setLoading(false); }
    };
    fetchStats();
  }, []);

  const statCards = [
    { label: "Total Users",   value: stats ? stats.totalUsers.toLocaleString()                     : "—", icon: <Users    className="w-5 h-5 text-base-blue"  />, color: "#0052FF" },
    { label: "Total Swaps",   value: stats ? stats.totalSwaps.toLocaleString()                     : "—", icon: <Zap      className="w-5 h-5 text-success"    />, color: "#00C896" },
    { label: "Total Volume",  value: stats ? `$${stats.totalVolume.toLocaleString(undefined, { maximumFractionDigits: 0 })}` : "—", icon: <TrendingUp className="w-5 h-5 text-warning"    />, color: "#FFB547" },
    { label: "Total XP",      value: stats ? stats.totalXP.toLocaleString()                        : "—", icon: <BarChart2 className="w-5 h-5 text-base-blue" />, color: "#0052FF" },
  ];

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10">
      {/* Header */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-base-blue/30 bg-base-blue/10 mb-4">
          <BarChart2 className="w-4 h-4 text-base-blue" />
          <span className="text-sm font-medium text-base-blue">Analytics</span>
        </div>
        <h1 className="text-3xl font-bold text-text-primary mb-2">Protocol Stats</h1>
        <p className="text-text-secondary text-sm">Real-time trading statistics for Cyanic on Base</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {statCards.map((card, i) => (
          <motion.div
            key={card.label}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="glass-card p-5"
          >
            <div className="flex items-center gap-2 mb-3">
              <div className="p-2 rounded-xl" style={{ background: `${card.color}18` }}>
                {card.icon}
              </div>
              <span className="text-xs text-text-muted font-medium">{card.label}</span>
            </div>
            {loading ? (
              <div className="shimmer h-8 w-24 rounded" />
            ) : (
              <div className="text-2xl font-bold text-text-primary font-mono">{card.value}</div>
            )}
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* XP Distribution */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="glass-card p-5"
        >
          <h3 className="font-semibold text-text-primary mb-4">Level Distribution</h3>
          {loading ? (
            <div className="h-48 flex items-center justify-center">
              <RefreshCw className="w-6 h-6 text-text-muted animate-spin" />
            </div>
          ) : xpDistribution.length === 0 ? (
            <div className="h-48 flex items-center justify-center text-text-muted text-sm">No data yet</div>
          ) : (
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie
                  data={xpDistribution}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  dataKey="value"
                  label={({ name, value }) => `${name} (${value})`}
                  labelLine={false}
                >
                  {xpDistribution.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ background: "var(--bg-secondary)", border: "1px solid var(--border)", borderRadius: 8 }}
                  labelStyle={{ color: "var(--text-primary)" }}
                />
              </PieChart>
            </ResponsiveContainer>
          )}
        </motion.div>

        {/* Top Traders */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="glass-card p-5 lg:col-span-2"
        >
          <h3 className="font-semibold text-text-primary mb-4">Top Traders</h3>
          {loading ? (
            <div className="space-y-3">
              {[1,2,3].map(i => <div key={i} className="shimmer h-12 rounded-lg" />)}
            </div>
          ) : !stats?.topTraders.length ? (
            <div className="h-48 flex items-center justify-center text-text-muted text-sm">No traders yet</div>
          ) : (
            <div className="space-y-2">
              {stats.topTraders.map((trader, i) => (
                <div key={trader.wallet_address} className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-bg-tertiary border border-border">
                  <span className="text-sm font-bold text-base-blue w-6 text-center">#{i + 1}</span>
                  <span className="flex-1 font-mono text-xs text-text-primary truncate">
                    {trader.wallet_address.slice(0, 6)}…{trader.wallet_address.slice(-4)}
                  </span>
                  <span className="text-xs text-text-muted">{trader.swap_count} swaps</span>
                  <span className="text-xs font-bold text-success font-mono">{trader.total_xp.toLocaleString()} XP</span>
                </div>
              ))}
            </div>
          )}
        </motion.div>
      </div>

      {/* Swaps per user bar chart */}
      {stats && stats.topTraders.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="glass-card p-5"
        >
          <h3 className="font-semibold text-text-primary mb-4">Top Traders by Swap Count</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={stats.topTraders.map(t => ({
              name: `${t.wallet_address.slice(0, 6)}…`,
              swaps: t.swap_count,
              xp: t.total_xp,
            }))}>
              <XAxis dataKey="name" tick={{ fill: "var(--text-muted)", fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "var(--text-muted)", fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{ background: "var(--bg-secondary)", border: "1px solid var(--border)", borderRadius: 8 }}
                labelStyle={{ color: "var(--text-primary)" }}
              />
              <Bar dataKey="swaps" fill="#0052FF" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </motion.div>
      )}
    </div>
  );
}

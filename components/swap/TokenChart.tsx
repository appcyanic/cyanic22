"use client";

import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip,
  ResponsiveContainer, ReferenceLine,
} from "recharts";
import { TrendingUp, TrendingDown, RefreshCw } from "lucide-react";
import type { Token } from "@/types/token";

const PERIODS = ["1H", "24H", "7D", "30D"] as const;
type Period = typeof PERIODS[number];

interface ChartPoint { time: string; price: number; }

interface Props { sellToken: Token; buyToken: Token; }

function formatPrice(p: number) {
  if (p >= 1000) return p.toLocaleString("en-US", { maximumFractionDigits: 0 });
  if (p >= 1)    return p.toFixed(2);
  if (p >= 0.001)return p.toFixed(4);
  return p.toExponential(3);
}

function formatTime(iso: string, period: Period) {
  const d = new Date(iso);
  if (period === "1H" || period === "24H")
    return d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function CustomTooltip({ active, payload }: { active?: boolean; payload?: { payload: ChartPoint }[] }) {
  if (!active || !payload?.length) return null;
  const pt = payload[0].payload;
  return (
    <div className="glass-card px-3 py-2 text-xs shadow-lg">
      <div className="text-text-muted mb-0.5">{pt.time}</div>
      <div className="font-bold font-mono text-text-primary">${formatPrice(pt.price)}</div>
    </div>
  );
}

export function TokenChart({ sellToken, buyToken }: Props) {
  const [period,  setPeriod]  = useState<Period>("24H");
  const [data,    setData]    = useState<ChartPoint[]>([]);
  const [loading, setLoading] = useState(false);
  const [change,  setChange]  = useState<number | null>(null);
  const [hovered, setHovered] = useState<ChartPoint | null>(null);

  const fetchChart = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        token: sellToken.address.toLowerCase(),
        period,
      });
      const res  = await fetch(`/api/chart?${params}`);
      const json = await res.json();

      const prices: [number, number][] = json.prices ?? [];
      if (prices.length === 0) { setData([]); setChange(null); return; }

      const pts: ChartPoint[] = prices.map(([ts, v]) => ({
        time:  new Date(ts).toISOString(),
        price: v,
      }));

      setData(pts);
      const first = pts[0].price;
      const last  = pts[pts.length - 1].price;
      setChange(((last - first) / first) * 100);
    } catch {
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [sellToken.address, period]);

  useEffect(() => { fetchChart(); }, [fetchChart]);

  const isUp    = (change ?? 0) >= 0;
  const color   = isUp ? "#00C896" : "#FF4D6A";
  const lastPt  = hovered ?? (data.length ? { time: "", price: data[data.length - 1].price } : null);

  return (
    <div className="glass-card p-4 flex flex-col" style={{ height: "100%", minHeight: 240 }}>

      {/* ── Header ── */}
      <div className="flex items-start justify-between mb-3 gap-2">
        <div className="min-w-0">
          {/* Token pair */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold text-text-primary">
              {sellToken.symbol}
              <span className="text-text-muted font-normal text-sm"> / USD</span>
            </span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-base-blue/10 text-base-blue border border-base-blue/20 whitespace-nowrap">
              {sellToken.symbol} → {buyToken.symbol}
            </span>
          </div>

          {/* Price + change */}
          {lastPt && (
            <div className="mt-1 flex items-baseline gap-2 flex-wrap">
              <span className="text-xl font-bold font-mono text-text-primary">
                ${formatPrice(lastPt.price)}
              </span>
              {change !== null && !hovered && (
                <span className="flex items-center gap-0.5 text-sm font-semibold"
                      style={{ color }}>
                  {isUp ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                  {isUp ? "+" : ""}{change.toFixed(2)}%
                </span>
              )}
            </div>
          )}
        </div>

        {/* Period + refresh */}
        <div className="flex items-center gap-1 flex-shrink-0">
          {PERIODS.map(p => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-2 py-1.5 rounded-lg text-xs font-medium transition-all min-h-[32px] min-w-[32px] ${
                period === p
                  ? "bg-base-blue text-white"
                  : "text-text-muted hover:text-text-primary hover:bg-bg-tertiary"
              }`}
            >
              {p}
            </button>
          ))}
          <button
            onClick={fetchChart}
            disabled={loading}
            className="p-2 rounded-lg text-text-muted hover:text-text-primary transition-all hover:bg-bg-tertiary min-h-[32px] min-w-[32px]"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* ── Chart ── */}
      <div className="flex-1" style={{ minHeight: 120 }}>
        <AnimatePresence mode="wait">
          {loading && data.length === 0 ? (
            <motion.div key="loading"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="h-full flex items-center justify-center"
            >
              <RefreshCw className="w-5 h-5 text-text-muted animate-spin" />
            </motion.div>
          ) : data.length === 0 ? (
            <motion.div key="empty"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="h-full flex flex-col items-center justify-center gap-2"
            >
              <p className="text-text-muted text-sm">No chart data for {sellToken.symbol}</p>
              <button onClick={fetchChart}
                      className="text-xs text-base-blue hover:underline">
                Retry
              </button>
            </motion.div>
          ) : (
            <motion.div key={`${sellToken.address}-${period}`}
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="h-full"
            >
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={data}
                  margin={{ top: 8, right: 4, left: 0, bottom: 0 }}
                  onMouseMove={e => { if (e.activePayload?.[0]) setHovered(e.activePayload[0].payload); }}
                  onMouseLeave={() => setHovered(null)}
                >
                  <defs>
                    <linearGradient id={`chartGrad-${sellToken.address.slice(2,8)}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%"   stopColor={color} stopOpacity={0.3} />
                      <stop offset="100%" stopColor={color} stopOpacity={0}   />
                    </linearGradient>
                  </defs>
                  <XAxis
                    dataKey="time"
                    tickFormatter={t => formatTime(t, period)}
                    axisLine={false} tickLine={false}
                    tick={{ fill: "var(--text-muted)", fontSize: 10 }}
                    interval="preserveStartEnd" minTickGap={50}
                  />
                  <YAxis
                    domain={["auto", "auto"]}
                    axisLine={false} tickLine={false}
                    tick={{ fill: "var(--text-muted)", fontSize: 10 }}
                    tickFormatter={v => `$${formatPrice(v)}`}
                    width={48}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <ReferenceLine
                    y={data[0]?.price}
                    stroke="var(--border)"
                    strokeDasharray="3 3"
                    strokeOpacity={0.6}
                  />
                  <Area
                    type="monotone" dataKey="price"
                    stroke={color} strokeWidth={1.5}
                    fill={`url(#chartGrad-${sellToken.address.slice(2,8)})`} dot={false}
                    activeDot={{ r: 4, fill: color, strokeWidth: 0 }}
                    isAnimationActive={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

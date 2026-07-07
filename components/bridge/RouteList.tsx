"use client";

import type { Route } from "@lifi/sdk";
import { formatUnits } from "viem";
import { Clock, Zap, CheckCircle2 } from "lucide-react";
import { getBridgeInfo, formatBridgeDuration } from "@/lib/lifi";
import { cn } from "@/lib/utils";

interface RouteListProps {
  routes: Route[];
  selected: Route | null;
  onSelect: (route: Route) => void;
}

function formatAmount(raw: string, decimals: number): string {
  try {
    const n = Number(formatUnits(BigInt(raw), decimals));
    if (n >= 1000) return n.toLocaleString("en", { maximumFractionDigits: 2 });
    if (n >= 1) return n.toFixed(4);
    return n.toFixed(6);
  } catch { return "0"; }
}

function getTotalCostUSD(route: Route): number {
  try {
    return route.steps.reduce((sum, step) => {
      const gas = parseFloat(step.estimate?.gasCosts?.[0]?.amountUSD ?? "0");
      const fee = parseFloat(step.estimate?.feeCosts?.[0]?.amountUSD ?? "0");
      return sum + gas + fee;
    }, 0);
  } catch { return 0; }
}

function getDuration(route: Route): number {
  return route.steps.reduce((sum, s) => sum + (s.estimate?.executionDuration ?? 0), 0);
}

export function RouteList({ routes, selected, onSelect }: RouteListProps) {
  if (!routes.length) return null;

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold text-text-muted uppercase tracking-wide">
          {routes.length} Route{routes.length > 1 ? "s" : ""} Found
        </span>
        <span className="text-xs text-text-muted">Best output first</span>
      </div>

      {/* Scrollable list */}
      <div className="space-y-1.5 overflow-y-auto" style={{ maxHeight: "min(196px, 40dvh)" }}>
        {routes.map((route, i) => {
          const tool       = route.steps[0]?.tool ?? "unknown";
          const info       = getBridgeInfo(tool);
          const isSelected = selected?.id === route.id;
          const toAmount   = formatAmount(route.toAmountMin ?? "0", route.toToken.decimals);
          const duration   = getDuration(route);
          const totalCost  = getTotalCostUSD(route);
          const isBest     = i === 0;

          return (
            <button
              key={route.id}
              onClick={() => onSelect(route)}
              className={cn(
                "w-full rounded-xl border px-3 py-2.5 text-left transition-all",
                isSelected
                  ? "border-base-blue/50 bg-base-blue/8"
                  : "border-border bg-bg-secondary hover:border-base-blue/30 hover:bg-bg-tertiary"
              )}
            >
              <div className="flex items-center justify-between">
                {/* Left: badge + name */}
                <div className="flex items-center gap-2">
                  {isBest && (
                    <span className="flex items-center gap-1 text-xs font-semibold text-success">
                      <Zap className="w-3 h-3" /> Best
                    </span>
                  )}
                  <span
                    className="text-xs font-semibold px-2 py-0.5 rounded-full"
                    style={{ background: info.color + "18", color: info.color }}
                  >
                    {info.label}
                  </span>
                </div>

                {/* Right: amount + check */}
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-sm text-text-primary font-mono tabular-nums">
                    {toAmount} {route.toToken.symbol}
                  </span>
                  {isSelected && <CheckCircle2 className="w-3.5 h-3.5 text-base-blue flex-shrink-0" />}
                </div>
              </div>

              {/* Stats row */}
              <div className="flex items-center gap-3 mt-1.5 text-xs text-text-muted">
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {formatBridgeDuration(duration)}
                </span>
                <span>·</span>
                <span>~${totalCost.toFixed(2)} fee</span>
                <span>·</span>
                <span style={{ color: info.color }}>{info.security.split(" ")[0]}</span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

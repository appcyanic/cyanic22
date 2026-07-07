"use client";

import { useState, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import { Zap, Target } from "lucide-react";
import { SwapCard }       from "@/components/swap/SwapCard";
import { LimitOrderCard } from "@/components/swap/LimitOrderCard";
import { TokenChart }     from "@/components/swap/TokenChart";
import { BASE_TOKENS }    from "@/lib/tokens";
import { cn } from "@/lib/utils";
import type { Token } from "@/types/token";

const TABS = [
  { id: "swap",  label: "Swap",        icon: Zap,    desc: "Best price across DEXs" },
  { id: "limit", label: "Limit Order", icon: Target, desc: "Auto-execute at target price" },
] as const;

type TabId = typeof TABS[number]["id"];

export default function SwapPage() {
  const [activeTab,  setActiveTab]  = useState<TabId>("swap");
  const [sellToken,  setSellToken]  = useState<Token>(BASE_TOKENS.ETH);
  const [buyToken,   setBuyToken]   = useState<Token>(BASE_TOKENS.USDC);
  const leftRef  = useRef<HTMLDivElement>(null);
  const rightRef = useRef<HTMLDivElement>(null);

  // Sync chart height to left card height — desktop only
  useEffect(() => {
    if (!leftRef.current || !rightRef.current) return;
    const sync = () => {
      // Only sync on desktop (lg breakpoint = 1024px)
      if (window.innerWidth < 1024) {
        rightRef.current!.style.height = "";
        return;
      }
      const h = leftRef.current?.offsetHeight;
      if (h && rightRef.current) {
        rightRef.current.style.height = `${h}px`;
      }
    };
    sync();
    const ro = new ResizeObserver(sync);
    window.addEventListener("resize", sync);
    if (leftRef.current) ro.observe(leftRef.current);
    return () => { ro.disconnect(); window.removeEventListener("resize", sync); };
  }, [activeTab]);

  return (
    <div
      className="px-3 sm:px-6 lg:px-8 py-4 sm:py-6"
      style={{ position: "relative", zIndex: 1, minHeight: "calc(100dvh - 4rem)" }}
    >
      {/* Main layout */}
      <div className="relative z-10 max-w-6xl mx-auto">

        {/* Two-column grid — equal proportions, same height */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">

          {/* ── Left: Swap card ── */}
          <div className="w-full" ref={leftRef}>
            {/* Tab switcher */}
            <div className="flex gap-1 p-1 rounded-2xl border border-border bg-bg-secondary mb-2">
              {TABS.map(tab => {
                const Icon     = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={cn(
                      "relative flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl",
                      "text-sm font-medium transition-all min-h-[44px]",
                      isActive ? "text-white" : "text-text-secondary hover:text-text-primary"
                    )}
                  >
                    {isActive && (
                      <motion.div
                        layoutId="tab-bg"
                        className="absolute inset-0 rounded-xl bg-gradient-base"
                        transition={{ type: "spring", duration: 0.4 }}
                      />
                    )}
                    <Icon className={cn("w-3.5 h-3.5 relative z-10 flex-shrink-0", isActive ? "text-white" : "")} />
                    <span className="relative z-10">{tab.label}</span>
                  </button>
                );
              })}
            </div>

            <p className="text-text-muted text-xs mb-3 text-center hidden">
              {activeTab === "swap" ? "Best price across DEXs" : "Auto-execute at target price"}
            </p>

            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.18 }}
            >
              {activeTab === "swap" && (
                <SwapCard
                  onTokensChange={(sell, buy) => {
                    setSellToken(sell);
                    setBuyToken(buy);
                  }}
                />
              )}
              {activeTab === "limit" && <LimitOrderCard />}
            </motion.div>
          </div>

          {/* ── Right: Token chart — desktop always, mobile below card ── */}
          <motion.div
            key={`chart-${sellToken.address}-${buyToken.address}`}
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.25 }}
            className="w-full overflow-hidden"
            ref={rightRef}
            style={{ minHeight: 260 }}
          >
            <TokenChart sellToken={sellToken} buyToken={buyToken} />
          </motion.div>

        </div>
      </div>
    </div>
  );
}

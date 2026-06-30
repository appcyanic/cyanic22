"use client";

import { motion } from "framer-motion";
import { ArrowLeftRight } from "lucide-react";
import { BridgeCard } from "@/components/bridge/BridgeCard";

export default function BridgePage() {
  return (
    <div
      className="px-3 sm:px-6 lg:px-8 py-6 sm:py-8"
      style={{ position: "relative", zIndex: 1, minHeight: "calc(100dvh - 4rem)" }}
    >
      <div className="max-w-lg mx-auto w-full">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-6"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-base-blue/30 bg-base-blue/10 mb-3">
            <ArrowLeftRight className="w-3.5 h-3.5 text-base-blue" />
            <span className="text-xs font-medium text-base-blue">Cross-Chain Bridge</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-text-primary mb-1">
            Bridge assets, <span className="gradient-text">any chain.</span>
          </h1>
          <p className="text-text-secondary text-xs sm:text-sm">
            Best routes across Across, Stargate, Hop and more — powered by LI.FI.
          </p>
        </motion.div>

        {/* Bridge card */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08 }}
        >
          <BridgeCard />
        </motion.div>

        {/* Info strip */}
        <div className="mt-4 grid grid-cols-3 gap-2 text-center">
          {[
            { emoji: "🔒", label: "Finite Approvals" },
            { emoji: "⚡", label: "30-90s via Across" },
            { emoji: "🌉", label: "32 Bridges" },
          ].map(item => (
            <div key={item.label} className="glass-card py-2.5 px-2">
              <div className="text-base mb-1">{item.emoji}</div>
              <div className="text-xs text-text-muted font-medium">{item.label}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

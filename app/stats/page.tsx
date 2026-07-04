"use client";

import { motion } from "framer-motion";
import { BarChart2 } from "lucide-react";

export default function StatsPage() {
  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10">
      {/* Header */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-base-blue/30 bg-base-blue/10 mb-4">
          <BarChart2 className="w-4 h-4 text-base-blue" />
          <span className="text-sm font-medium text-base-blue">Analytics</span>
        </div>
        <h1 className="text-3xl font-bold text-text-primary mb-2">Protocol Stats</h1>
        <p className="text-text-secondary text-sm">
          Real-time trading statistics for Cyanic on Base
        </p>
      </div>

      {/* Coming soon */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-card p-16 text-center"
      >
        <div className="text-5xl mb-4">📊</div>
        <h2 className="text-xl font-bold text-text-primary mb-2">Coming Soon</h2>
        <p className="text-text-secondary text-sm max-w-sm mx-auto">
          Live protocol analytics will be available once trading activity is recorded on-chain.
        </p>
      </motion.div>
    </div>
  );
}

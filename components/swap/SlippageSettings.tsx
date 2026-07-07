"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Settings, X } from "lucide-react";
import { cn } from "@/lib/utils";

const PRESET_SLIPPAGES = [0.1, 0.5, 1.0, 3.0];

interface SlippageSettingsProps {
  slippage: number;
  onChange: (value: number) => void;
  deadline?: number;
  onDeadlineChange?: (value: number) => void;
}

export function SlippageSettings({
  slippage,
  onChange,
  deadline = 20,
  onDeadlineChange,
}: SlippageSettingsProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [customInput, setCustomInput] = useState("");

  const slippageBps = Math.round(slippage * 100);
  const isHighSlippage = slippage > 2;
  const isVeryHighSlippage = slippage > 5;

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-sm transition-all",
          isHighSlippage
            ? "text-warning bg-warning/10 border border-warning/30"
            : "text-text-secondary hover:text-text-primary hover:bg-bg-secondary border border-transparent"
        )}
      >
        <Settings className="w-3.5 h-3.5" />
        <span>{slippage}%</span>
      </button>

      <AnimatePresence>
        {isOpen && (
          <>
            <div
              className="fixed inset-0 z-40"
              onClick={() => setIsOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, y: -8, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.95 }}
              className="absolute right-0 top-full mt-2 z-50 w-72 max-w-[calc(100vw-2rem)] glass-card p-4"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-sm">Transaction Settings</h3>
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-1 rounded-lg hover:bg-bg-tertiary"
                >
                  <X className="w-3.5 h-3.5 text-text-muted" />
                </button>
              </div>

              {/* Slippage */}
              <div className="mb-4">
                <label className="text-xs text-text-muted mb-2 block font-medium uppercase tracking-wide">
                  Slippage Tolerance
                </label>
                <div className="flex gap-2">
                  {PRESET_SLIPPAGES.map((preset) => (
                    <button
                      key={preset}
                      onClick={() => {
                        onChange(preset);
                        setCustomInput("");
                      }}
                      className={cn(
                        "flex-1 py-1.5 rounded-lg text-xs font-semibold border transition-all",
                        slippage === preset
                          ? "bg-base-blue border-base-blue text-white"
                          : "border-border bg-bg-tertiary text-text-secondary hover:border-border-hover"
                      )}
                    >
                      {preset}%
                    </button>
                  ))}
                </div>
                <div className="mt-2 relative">
                  <input
                    type="number"
                    placeholder="Custom %"
                    min="0.01"
                    max="50"
                    step="0.1"
                    value={customInput}
                    onChange={(e) => {
                      setCustomInput(e.target.value);
                      const val = parseFloat(e.target.value);
                      if (val > 0 && val <= 50) onChange(val);
                    }}
                    className="input-base w-full px-3 py-2 text-sm pr-8"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted text-sm">%</span>
                </div>
                {isVeryHighSlippage && (
                  <p className="text-xs text-error mt-1.5 font-medium">
                    ⚠️ Very high slippage — risk of sandwich attack
                  </p>
                )}
                {isHighSlippage && !isVeryHighSlippage && (
                  <p className="text-xs text-warning mt-1.5">
                    ⚠️ High slippage tolerance
                  </p>
                )}
              </div>

              {/* Deadline */}
              {onDeadlineChange && (
                <div>
                  <label className="text-xs text-text-muted mb-2 block font-medium uppercase tracking-wide">
                    Transaction Deadline
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      min={1}
                      max={60}
                      value={deadline}
                      onChange={(e) =>
                        onDeadlineChange(Math.min(60, Math.max(1, parseInt(e.target.value) || 20)))
                      }
                      className="input-base w-full px-3 py-2 text-sm pr-16"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted text-xs">
                      minutes
                    </span>
                  </div>
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

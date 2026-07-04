"use client";

import { LEVEL_COLORS, LEVEL_THRESHOLDS, type Level } from "@/types/reward";
import { getLevelEmoji } from "@/lib/points";
import { Sparkles, Lock, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface RewardCardProps {
  level: Level;
  unlocked: boolean;
  minted: boolean;
  onMint: () => void;
  isLoading?: boolean;
  /** compact = small card for leaderboard sidebar, default = full card for rewards page */
  compact?: boolean;
}

export function RewardCard({ level, unlocked, minted, onMint, isLoading, compact = false }: RewardCardProps) {
  const color = LEVEL_COLORS[level];
  const emoji = getLevelEmoji(level);

  if (compact) {
    return (
      <div
        className={cn(
          "rounded-xl border flex flex-col items-center gap-1.5 p-2 transition-all",
          unlocked ? "opacity-100" : "opacity-40"
        )}
        style={{
          borderColor: unlocked ? `${color}40` : "var(--border)",
          background: unlocked ? `${color}08` : undefined,
        }}
      >
        {/* Emoji + lock */}
        <div className="relative">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center text-xl"
            style={{ background: `${color}18`, border: `1px solid ${color}25` }}
          >
            {emoji}
          </div>
          {!unlocked && (
            <div className="absolute inset-0 rounded-xl bg-bg-primary/60 flex items-center justify-center">
              <Lock className="w-3 h-3 text-text-muted" />
            </div>
          )}
          {minted && (
            <CheckCircle2 className="absolute -top-1 -right-1 w-4 h-4 text-success bg-bg-primary rounded-full" />
          )}
        </div>

        {/* Level name */}
        <span className="text-xs font-semibold text-text-primary leading-none">{level}</span>

        {/* Action */}
        {minted ? (
          <span className="text-xs text-success">✓ Minted</span>
        ) : unlocked ? (
          <button
            onClick={onMint}
            disabled={isLoading}
            className="w-full py-1 rounded-lg text-xs font-semibold text-white flex items-center justify-center gap-0.5 min-h-[28px]"
            style={{ background: `linear-gradient(135deg, ${color}, ${color}99)` }}
          >
            {isLoading ? "…" : <><Sparkles className="w-2.5 h-2.5" /> Mint</>}
          </button>
        ) : (
          <span className="text-xs text-text-muted font-mono tabular-nums">
            {LEVEL_THRESHOLDS[level].toLocaleString()} XP
          </span>
        )}
      </div>
    );
  }

  // Full card (rewards page)
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl border p-4 transition-all",
        unlocked && !minted ? "cursor-pointer" : "",
        !unlocked && "opacity-60"
      )}
      style={{
        borderColor: unlocked ? `${color}50` : undefined,
        background: unlocked ? `linear-gradient(135deg, ${color}08 0%, transparent 60%)` : undefined,
        boxShadow: unlocked && !minted ? `0 0 20px ${color}15` : undefined,
      }}
    >
      {/* NFT Preview */}
      <div
        className="relative w-full aspect-square rounded-xl mb-3 flex items-center justify-center overflow-hidden"
        style={{
          background: `linear-gradient(135deg, #0A0B0D 0%, ${color}20 100%)`,
          border: `1px solid ${color}30`,
        }}
      >
        <div className="relative z-10 text-center">
          <div className="text-5xl mb-2">{emoji}</div>
          <div className="text-xs font-bold tracking-widest uppercase" style={{ color }}>
            {level}
          </div>
        </div>
        {!unlocked && (
          <div className="absolute inset-0 bg-bg-primary/60 rounded-xl flex items-center justify-center">
            <Lock className="w-8 h-8 text-text-muted" />
          </div>
        )}
        {minted && (
          <div className="absolute top-2 right-2 flex items-center gap-1 px-2 py-0.5 rounded-full bg-success/20 border border-success/30">
            <div className="w-1.5 h-1.5 rounded-full bg-success" />
            <span className="text-xs font-semibold text-success">Minted</span>
          </div>
        )}
      </div>

      <div className="space-y-1">
        <h3 className="font-bold text-sm text-text-primary">{level} Cyanic NFT</h3>
        <p className="text-xs text-text-muted">
          {unlocked ? "On-chain NFT · Dynamic SVG" : `Requires ${LEVEL_THRESHOLDS[level].toLocaleString()} XP`}
        </p>
      </div>

      {unlocked && !minted && (
        <button
          onClick={onMint}
          disabled={isLoading}
          className="mt-3 w-full flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold text-white transition-all"
          style={{ background: `linear-gradient(135deg, ${color} 0%, ${color}cc 100%)` }}
        >
          <Sparkles className="w-3.5 h-3.5" />
          {isLoading ? "Minting…" : "Mint NFT"}
        </button>
      )}
      {minted && (
        <div className="mt-3 w-full flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold text-success border border-success/20 bg-success/5">
          <CheckCircle2 className="w-3.5 h-3.5" /> Minted ✓
        </div>
      )}
    </div>
  );
}

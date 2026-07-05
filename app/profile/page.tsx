"use client";

import { useAccount } from "wagmi";
import { motion } from "framer-motion";
import { ExternalLink, Copy, CheckCircle2, User } from "lucide-react";
import { useState, useEffect } from "react";
import { ConnectButton } from "@/components/ui/ConnectButton";
import { ProgressBar } from "@/components/rewards/ProgressBar";
import { LevelBadge } from "@/components/leaderboard/RankBadge";
import { useUserPoints } from "@/hooks/useUserPoints";
import { shortenAddress } from "@/lib/utils";
import { formatXP, getLevelEmoji } from "@/lib/points";
import { LEVEL_COLORS } from "@/types/reward";
import { supabase } from "@/lib/supabase";

interface SwapRecord {
  id: string;
  amount: number;
  reason: string;
  created_at: string;
}

export default function ProfilePage() {
  const { address, isConnected } = useAccount();
  const { data: userPoints } = useUserPoints();
  const [addressCopied, setAddressCopied] = useState(false);
  const [swapHistory, setSwapHistory] = useState<SwapRecord[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Fetch swap history from xp_transactions
  useEffect(() => {
    if (!address) return;
    setHistoryLoading(true);
    (async () => {
      try {
        const { data } = await supabase
          .from("xp_transactions")
          .select("id, amount, reason, created_at")
          .eq("wallet_address", address.toLowerCase())
          .eq("reason", "swap")
          .order("created_at", { ascending: false })
          .limit(10);
        setSwapHistory((data as SwapRecord[]) ?? []);
      } catch { /* ignore */ }
      finally { setHistoryLoading(false); }
    })();
  }, [address]);

  const copyAddress = async () => {
    if (!address) return;
    await navigator.clipboard.writeText(address);
    setAddressCopied(true);
    setTimeout(() => setAddressCopied(false), 2000);
  };

  if (!isConnected) {
    return (
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-10 text-center">
        <div className="glass-card p-12">
          <User className="w-12 h-12 text-base-blue mx-auto mb-4" />
          <h2 className="text-xl font-bold mb-2">Connect to view profile</h2>
          <p className="text-text-secondary text-sm mb-6">
            Connect your wallet to see your trading stats and NFT collection.
          </p>
          <ConnectButton size="lg" className="mx-auto" />
        </div>
      </div>
    );
  }

  const level = userPoints?.level ?? "Bronze";
  const xp = userPoints?.total_xp ?? 0;
  const levelColor = LEVEL_COLORS[level];

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10">
      {/* Background */}
      <div
        className="fixed top-1/4 left-1/2 -translate-x-1/2 w-[500px] h-[400px] pointer-events-none"
        style={{
          background: `radial-gradient(ellipse at center, ${levelColor}08 0%, transparent 70%)`,
        }}
      />

      {/* Profile header */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-card p-6 mb-6"
      >
        <div className="flex items-start gap-3 sm:gap-5">
          {/* Avatar */}
          <div
            className="w-12 h-12 sm:w-16 sm:h-16 rounded-2xl flex items-center justify-center text-2xl sm:text-3xl flex-shrink-0"
            style={{
              background: `linear-gradient(135deg, ${levelColor}20, ${levelColor}10)`,
              border: `1px solid ${levelColor}30`,
            }}
          >
            {getLevelEmoji(level)}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-bold text-lg font-mono text-text-primary">
                {address ? shortenAddress(address, 6) : "—"}
              </span>
              <button
                onClick={copyAddress}
                className="p-1 rounded-lg hover:bg-bg-secondary transition-all"
              >
                {addressCopied ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-success" />
                ) : (
                  <Copy className="w-3.5 h-3.5 text-text-muted" />
                )}
              </button>
              <a
                href={`https://basescan.org/address/${address}`}
                target="_blank"
                rel="noopener noreferrer"
                className="p-1 rounded-lg hover:bg-bg-secondary transition-all"
              >
                <ExternalLink className="w-3.5 h-3.5 text-text-muted" />
              </a>
            </div>

            <LevelBadge level={level} className="mb-3" />

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-4">
              {[
                { label: "Total XP", value: formatXP(xp) },
                { label: "Volume", value: `$${(userPoints?.total_volume_usd ?? 0).toLocaleString()}` },
                { label: "Swaps", value: userPoints?.swap_count ?? 0 },
                { label: "Streak", value: `${userPoints?.streak_days ?? 0}d 🔥` },
              ].map((stat) => (
                <div key={stat.label}>
                  <div className="font-bold text-sm sm:text-base text-text-primary">{stat.value}</div>
                  <div className="text-xs text-text-muted">{stat.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </motion.div>

      {/* Level Progress */}
      <ProgressBar
        level={level}
        xp={xp}
        progress={userPoints?.level_progress ?? 0}
        xpToNext={userPoints?.xp_to_next ?? 1000}
        className="mb-6"
      />

      {/* Recent activity */}
      <div className="glass-card p-4">
        <h3 className="font-semibold mb-4 flex items-center gap-2">
          📋 Recent Swaps
        </h3>
        {historyLoading ? (
          <div className="space-y-2">
            {[1,2,3].map(i => <div key={i} className="shimmer h-10 rounded-lg" />)}
          </div>
        ) : swapHistory.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 gap-2">
            <span className="text-2xl">🔄</span>
            <p className="text-sm text-text-secondary font-medium">No swaps yet</p>
            <p className="text-xs text-text-muted">Your swap history will appear here after your first transaction.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {swapHistory.map(tx => (
              <div key={tx.id} className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-bg-tertiary border border-border">
                <div className="flex items-center gap-2">
                  <span className="text-lg">🔄</span>
                  <div>
                    <div className="text-xs font-semibold text-text-primary">Swap</div>
                    <div className="text-xs text-text-muted">
                      {new Date(tx.created_at).toLocaleDateString("en-US", {
                        month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
                      })}
                    </div>
                  </div>
                </div>
                <span className="text-xs font-bold text-success">+{tx.amount} XP</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

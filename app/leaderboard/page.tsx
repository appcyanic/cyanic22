"use client";

import { useState, useEffect } from "react";
import { useAccount, useWalletClient, usePublicClient } from "wagmi";
import { motion } from "framer-motion";
import { toast } from "sonner";
import {
  Trophy, Zap, Info,
  Flame, Star, ExternalLink, CheckCircle2,
} from "lucide-react";import { LeaderboardTable } from "@/components/leaderboard/LeaderboardTable";
import { LevelBadge }       from "@/components/leaderboard/RankBadge";
import { ProgressBar }      from "@/components/rewards/ProgressBar";
import { RewardCard }       from "@/components/rewards/RewardCard";
import { ConnectButton }    from "@/components/ui/ConnectButton";
import { useLeaderboard }   from "@/hooks/useLeaderboard";
import { useUserPoints }    from "@/hooks/useUserPoints";
import { formatXP }         from "@/lib/points";
import { shortenAddress }   from "@/lib/utils";
import {
  LEVEL_THRESHOLDS, XP_REWARDS, type Level,
} from "@/types/reward";
const ALL_LEVELS: Level[] = ["Bronze", "Silver", "Gold", "Platinum", "Diamond", "Elite"];

const XP_SOURCES = [
  { icon: "🔄", label: "Each Swap",      desc: "Per swap, no minimum",     xp: XP_REWARDS.PER_SWAP,    color: "#0052FF" },
  { icon: "🤖", label: "AI Agent Swap",  desc: "Swap via AI agent",        xp: XP_REWARDS.AGENT_SWAP,  color: "#00C896" },
  { icon: "🔥", label: "7-Day Streak",   desc: "7 consecutive days",       xp: XP_REWARDS.WEEK_STREAK, color: "#FF6B35" },
  { icon: "⚡", label: "First Swap",     desc: "One-time bonus",           xp: XP_REWARDS.FIRST_SWAP,  color: "#FFB547" },
  { icon: "🐦", label: "Follow on X",    desc: "Follow @cyanic",           xp: XP_REWARDS.X_FOLLOW,    color: "#1DA1F2" },
];

const MINT_ABI = [{
  name: "mint", type: "function", stateMutability: "nonpayable",
  inputs: [
    { name: "level",       type: "uint8"   },
    { name: "totalVolume", type: "uint256" },
    { name: "swapCount",   type: "uint256" },
    { name: "signature",   type: "bytes"   },
  ],
  outputs: [],
}] as const;

const LEVEL_INDEX: Record<Level, number> = {
  Bronze: 0, Silver: 1, Gold: 2, Platinum: 3, Diamond: 4, Elite: 5,
};
const CONTRACT_ADDRESS = (process.env.NEXT_PUBLIC_NFT_CONTRACT_ADDRESS || "") as `0x${string}`;

export default function LeaderboardPage() {
  const { address, isConnected } = useAccount();
  const { data: walletClient }   = useWalletClient();
  const publicClient             = usePublicClient();
  const { leaderboard, userEntry, isLoading } = useLeaderboard();
  const { data: userPoints }     = useUserPoints();

  const [mintingLevel, setMintingLevel] = useState<Level | null>(null);
  const [mintedLevels, setMintedLevels] = useState<Set<Level>>(new Set());
  const [lastTxHash,   setLastTxHash]   = useState<string | null>(null);
  const [xFollowDone,  setXFollowDone]  = useState(false);
  const [xFollowLoading, setXFollowLoading] = useState(false);

  // ── Load on-chain minted status ──
  useEffect(() => {
    if (!address || !publicClient || !CONTRACT_ADDRESS) return;
    const LEVEL_ENUM = [0, 1, 2, 3, 4, 5] as const;
    const HAS_MINTED_ABI = [{
      name: "hasMinted", type: "function", stateMutability: "view",
      inputs: [{ name: "", type: "address" }, { name: "", type: "uint8" }],
      outputs: [{ name: "", type: "bool" }],
    }] as const;

    Promise.all(
      LEVEL_ENUM.map(idx =>
        publicClient.readContract({
          address: CONTRACT_ADDRESS,
          abi: HAS_MINTED_ABI,
          functionName: "hasMinted",
          args: [address, idx],
        })
      )
    ).then(results => {
      const minted = new Set<Level>();
      ALL_LEVELS.forEach((lvl, i) => { if (results[i]) minted.add(lvl); });
      setMintedLevels(minted);
    }).catch(() => {});
  }, [address, publicClient]);

  const xp       = userPoints?.total_xp        ?? 0;
  const level    = userPoints?.level            ?? "Bronze";
  const progress = userPoints?.level_progress   ?? 0;
  const xpToNext = userPoints?.xp_to_next       ?? 1000;

  const handleXFollow = async () => {
    if (!address || !isConnected) { toast.error("Connect wallet first"); return; }
    // Open X profile in new tab
    window.open("https://x.com/cyanic", "_blank");
    setXFollowLoading(true);
    try {
      const res = await fetch("/api/social/follow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wallet: address }),
      });
      const data = await res.json();
      if (data.alreadyClaimed) {
        toast.info("Already claimed! You earned this bonus before.");
        setXFollowDone(true);
      } else if (data.success) {
        toast.success(`+${XP_REWARDS.X_FOLLOW} XP earned for following @cyanic!`, { icon: "🐦" });
        setXFollowDone(true);
      } else {
        toast.error(data.error ?? "Failed to claim");
      }
    } catch {
      toast.error("Something went wrong");
    } finally {
      setXFollowLoading(false);
    }
  };
  const handleMint = async (nftLevel: Level) => {
    if (!isConnected || !address || !walletClient || !publicClient) {
      toast.error("Connect wallet to mint"); return;
    }
    setMintingLevel(nftLevel);
    try {
      const vol   = Math.floor((userPoints?.total_volume_usd ?? 0) * 1e6);
      const swaps = userPoints?.swap_count ?? 0;
      const sigRes = await fetch("/api/mint", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wallet: address, level: nftLevel, totalVolume: vol, swapCount: swaps }),
      });
      const { signature, demo, message } = await sigRes.json();
      if (demo) {
        toast.info(`Demo: ${message || "Deploy contract for real minting."}`);
        setMintedLevels(p => new Set([...p, nftLevel])); return;
      }
      if (!CONTRACT_ADDRESS) { toast.error("NFT contract not deployed"); return; }
      toast.loading(`Minting ${nftLevel}…`, { id: "mint" });
      const tx = await walletClient.writeContract({
        address: CONTRACT_ADDRESS, abi: MINT_ABI, functionName: "mint",
        args: [LEVEL_INDEX[nftLevel], BigInt(vol), BigInt(swaps), signature as `0x${string}`],
      });
      setLastTxHash(tx);
      const r = await publicClient.waitForTransactionReceipt({ hash: tx });
      if (r.status === "success") {
        toast.success(`🎉 ${nftLevel} NFT minted!`, { id: "mint" });
        setMintedLevels(p => new Set([...p, nftLevel]));
      } else toast.error("Mint failed", { id: "mint" });
    } catch (e: unknown) {
      const m = e instanceof Error ? e.message : "";
      toast.error(m.includes("rejected") ? "Cancelled" : "Mint failed", { id: "mint" });
    } finally { setMintingLevel(null); }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">

      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                  className="text-center mb-6">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-base-blue/30 bg-base-blue/10 mb-3">
          <Trophy className="w-3.5 h-3.5 text-base-blue" />
          <span className="text-xs font-medium text-base-blue">Rankings & Rewards</span>
        </div>
        <h1 className="text-2xl font-bold text-text-primary mb-1">Leaderboard</h1>
        <p className="text-text-secondary text-sm">Top traders on Base · Earn XP · Mint NFTs</p>
      </motion.div>

      {/* Main grid: table + rewards panel */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_260px] gap-6 items-start mb-8">

        {/* ── Left: Leaderboard table ── */}
        <div className="min-w-0">
          <LeaderboardTable data={leaderboard} currentWallet={address} isLoading={isLoading} />

          {/* Sticky "You" row — stays above mobile nav */}
          {address && userEntry && (
            <div className="sticky bottom-20 md:bottom-4 mt-3 z-10">
              <div className="glass-card px-3 py-2 flex items-center gap-2.5 backdrop-blur-xl"
                   style={{ borderColor: "rgba(0,82,255,0.35)" }}>
                <span className="text-xs font-bold text-base-blue font-mono w-7 text-center">#{userEntry.rank}</span>
                <div className="flex-1 min-w-0 flex items-center gap-2">
                  <span className="font-mono text-xs text-text-primary truncate">{shortenAddress(address)}</span>
                  <span className="text-base-blue text-xs">(You)</span>
                  <LevelBadge level={userEntry.level as Level} />
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <Zap className="w-3 h-3 text-base-blue" />
                  <span className="text-xs font-bold gradient-text font-mono">{formatXP(userEntry.total_xp)}</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── Right: Rewards panel ── */}
        <div className="space-y-3">
          {isConnected ? (
            <>
              {/* XP Progress + Stats combined */}
              <div className="glass-card p-4">
                <ProgressBar level={level} xp={xp} progress={progress} xpToNext={xpToNext} className="!p-0 !border-0 !shadow-none !bg-transparent" />
                <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-border">
                  {[
                    { label: "Streak",  value: `${userPoints?.streak_days ?? 0}d`,                         icon: <Flame  className="w-3 h-3 text-warning" /> },
                    { label: "Swaps",   value: userPoints?.swap_count ?? 0,                                 icon: <Zap    className="w-3 h-3 text-base-blue" /> },
                    { label: "Volume",  value: `$${(userPoints?.total_volume_usd ?? 0).toLocaleString()}`,  icon: <Trophy className="w-3 h-3 text-success" /> },
                  ].map(s => (
                    <div key={s.label} className="flex items-center gap-1.5 p-1.5 rounded-lg bg-bg-tertiary">
                      {s.icon}
                      <div>
                        <div className="text-xs font-bold text-text-primary">{s.value}</div>
                        <div className="text-xs text-text-muted">{s.label}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* NFT Mint */}
              <div className="glass-card p-3">
                <div className="flex items-center gap-1.5 mb-2">
                  <Star className="w-3.5 h-3.5 text-warning" />
                  <span className="text-xs font-bold text-text-primary">Level NFTs</span>
                </div>
                <div className="grid grid-cols-3 gap-1.5">
                  {ALL_LEVELS.map(n => (
                    <RewardCard
                      key={n}
                      level={n}
                      compact
                      unlocked={xp >= LEVEL_THRESHOLDS[n]}
                      minted={mintedLevels.has(n)}
                      onMint={() => handleMint(n)}
                      isLoading={mintingLevel === n}
                    />
                  ))}
                </div>
                {lastTxHash && (
                  <a href={`https://basescan.org/tx/${lastTxHash}`} target="_blank" rel="noopener noreferrer"
                     className="mt-2 flex items-center justify-center gap-1 text-xs text-success hover:underline">
                    <ExternalLink className="w-3 h-3" /> BaseScan
                  </a>
                )}
              </div>

              {/* X Follow */}
              <div className="glass-card p-3">
                <div className="flex items-center gap-1.5 mb-2">
                  <span className="text-sm">🐦</span>
                  <span className="text-xs font-semibold text-text-primary">Follow on X</span>
                  <span className="ml-auto text-xs text-success font-mono">+1000 XP</span>
                </div>
                <p className="text-xs text-text-muted mb-2">Follow @cyanic and claim your XP reward.</p>
                <button
                  onClick={handleXFollow}
                  disabled={xFollowDone || xFollowLoading || !isConnected}
                  className="w-full py-2 rounded-xl text-xs font-semibold transition-all flex items-center justify-center gap-1.5"
                  style={{
                    background: xFollowDone ? "var(--success)" + "20" : "#1DA1F2",
                    color: xFollowDone ? "var(--success)" : "white",
                    border: xFollowDone ? "1px solid var(--success)" : "none",
                    opacity: (!isConnected || xFollowLoading) ? 0.6 : 1,
                  }}
                >
                  {xFollowDone
                    ? <><CheckCircle2 className="w-3.5 h-3.5" /> Claimed!</>
                    : xFollowLoading
                    ? "Processing…"
                    : <><span>🐦</span> Follow & Claim +1000 XP</>
                  }
                </button>
              </div>
            </>
          ) : (
            <div className="glass-card p-5 text-center">
              <Trophy className="w-8 h-8 text-base-blue mx-auto mb-3" />
              <p className="text-sm font-semibold text-text-primary mb-1">Track your rewards</p>
              <p className="text-xs text-text-muted mb-4">Connect to see XP, level and mint NFTs</p>
              <ConnectButton size="sm" />
            </div>
          )}
        </div>
      </div>

      {/* How to Earn XP */}
      <div className="border-t border-border pt-6">
        <div className="flex items-center gap-2 mb-4">
          <Info className="w-4 h-4 text-base-blue" />
          <h2 className="font-bold text-sm text-text-primary">How to Earn XP</h2>
        </div>
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
          {XP_SOURCES.map(s => (
            <div key={s.label}
                 className="glass-card p-3 flex flex-col items-center text-center gap-2"
                 style={{ borderColor: `${s.color}20` }}>
              <div className="w-9 h-9 rounded-xl flex items-center justify-center text-lg"
                   style={{ background: `${s.color}15`, border: `1px solid ${s.color}20` }}>
                {s.icon}
              </div>
              <div>
                <div className="text-xs font-semibold text-text-primary leading-tight">{s.label}</div>
                <div className="text-xs text-text-muted mt-0.5 leading-tight">{s.desc}</div>
              </div>
              <span className="text-xs font-bold font-mono px-2 py-0.5 rounded-full mt-auto"
                    style={{ color: s.color, background: `${s.color}15`, border: `1px solid ${s.color}20` }}>
                +{s.xp}
              </span>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}

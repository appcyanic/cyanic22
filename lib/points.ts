import { XP_REWARDS, getLevelFromXP, type Level } from "@/types/reward";

export function calculateSwapXP(isFirstSwap: boolean): number {
  let xp = XP_REWARDS.PER_SWAP;
  if (isFirstSwap) xp += XP_REWARDS.FIRST_SWAP;
  return xp;
}

export function calculateAgentSwapXP(): number {
  return XP_REWARDS.AGENT_SWAP;
}

export function generateReferralCode(walletAddress: string): string {
  const hash = walletAddress.slice(2, 8).toUpperCase();
  const suffix = walletAddress.slice(-4).toUpperCase();
  return `CNY${hash}${suffix}`;
}

export function getLevelEmoji(level: Level): string {
  const emojis: Record<Level, string> = {
    Bronze: "🥉",
    Silver: "🥈",
    Gold: "🥇",
    Platinum: "💎",
    Diamond: "💠",
    Elite: "👑",
  };
  return emojis[level];
}

export function formatXP(xp: number): string {
  if (xp >= 1000000) return (xp / 1000000).toFixed(1) + "M";
  if (xp >= 1000) return (xp / 1000).toFixed(1) + "K";
  return xp.toString();
}

export { getLevelFromXP };

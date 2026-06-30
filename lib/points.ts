import { XP_REWARDS, getLevelFromXP, type Level } from "@/types/reward";

export function calculateSwapXP(amountUSD: number, isFirstSwap: boolean): number {
  let xp = XP_REWARDS.PER_SWAP; // 50 XP per swap — no minimum balance requirement
  if (isFirstSwap) xp += XP_REWARDS.FIRST_SWAP;
  return xp;
}

export function calculateAgentSwapXP(): number {
  return XP_REWARDS.AGENT_SWAP; // 250 XP for swaps initiated via AI agent
}

export function calculateStreakXP(streakDays: number): number {
  let xp = XP_REWARDS.DAILY_SWAP;
  if (streakDays > 0 && streakDays % 7 === 0) {
    xp += XP_REWARDS.WEEK_STREAK;
  }
  return xp;
}

export function generateReferralCode(walletAddress: string): string {
  const hash = walletAddress.slice(2, 8).toUpperCase();
  const suffix = walletAddress.slice(-4).toUpperCase();
  return `NXS${hash}${suffix}`;
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

export function getRankEmoji(rank: number): string {
  if (rank === 1) return "🥇";
  if (rank === 2) return "🥈";
  if (rank === 3) return "🥉";
  return `#${rank}`;
}

export function formatXP(xp: number): string {
  if (xp >= 1000000) return (xp / 1000000).toFixed(1) + "M";
  if (xp >= 1000) return (xp / 1000).toFixed(1) + "K";
  return xp.toString();
}

export function formatVolume(usd: number): string {
  if (usd >= 1000000) return "$" + (usd / 1000000).toFixed(1) + "M";
  if (usd >= 1000) return "$" + (usd / 1000).toFixed(1) + "K";
  return "$" + usd.toFixed(2);
}

export function isStreakActive(lastSwapDate: string | null): boolean {
  if (!lastSwapDate) return false;
  const last = new Date(lastSwapDate);
  const now = new Date();
  const diffDays = Math.floor(
    (now.getTime() - last.getTime()) / (1000 * 60 * 60 * 24)
  );
  return diffDays <= 1;
}

export { getLevelFromXP };

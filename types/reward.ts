export type Level =
  | "Bronze"
  | "Silver"
  | "Gold"
  | "Platinum"
  | "Diamond"
  | "Elite";

export interface LeaderboardEntry {
  rank: number;
  wallet_address: string;
  ens_name?: string;
  total_xp: number;
  level: Level;
  total_volume_usd: number;
  swap_count: number;
  referral_count: number;
}

export const LEVEL_THRESHOLDS: Record<Level, number> = {
  Bronze:   0,
  Silver:   1000,
  Gold:     5000,
  Platinum: 10000,
  Diamond:  25000,
  Elite:    50000,
};

export const LEVEL_COLORS: Record<Level, string> = {
  Bronze: "#CD7F32",
  Silver: "#C0C0C0",
  Gold: "#FFA500",
  Platinum: "#E5E4E2",
  Diamond: "#00C2FF",
  Elite: "#FFD700",
};

export const XP_REWARDS = {
  FIRST_SWAP:       500,
  PER_SWAP:         100,
  AGENT_SWAP:       250,
  DAILY_SWAP:       50,
  WEEK_STREAK:      1000,
  REFERRAL:         1000,
  REFERRED_BONUS:   200,
  X_FOLLOW:         1000,
  AGENT_QUERY:      5,
  MULTI_SWAP:       25,
  PROFILE_COMPLETE: 100,
};

export function getLevelFromXP(xp: number): Level {
  if (xp >= 50000) return "Elite";
  if (xp >= 25000) return "Diamond";
  if (xp >= 10000) return "Platinum";
  if (xp >= 5000)  return "Gold";
  if (xp >= 1000)  return "Silver";
  return "Bronze";
}

export function getNextLevel(level: Level): Level | null {
  const levels: Level[] = [
    "Bronze",
    "Silver",
    "Gold",
    "Platinum",
    "Diamond",
    "Elite",
  ];
  const idx = levels.indexOf(level);
  return idx < levels.length - 1 ? levels[idx + 1] : null;
}

export function getXPToNextLevel(xp: number, level: Level): number {
  const nextLevel = getNextLevel(level);
  if (!nextLevel) return 0;
  return LEVEL_THRESHOLDS[nextLevel] - xp;
}

export function getLevelProgress(xp: number, level: Level): number {
  const nextLevel = getNextLevel(level);
  if (!nextLevel) return 100;
  const current = LEVEL_THRESHOLDS[level];
  const next = LEVEL_THRESHOLDS[nextLevel];
  return Math.round(((xp - current) / (next - current)) * 100);
}

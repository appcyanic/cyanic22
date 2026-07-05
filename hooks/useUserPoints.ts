"use client";

import { useState, useEffect } from "react";
import { useAccount } from "wagmi";
import type { Level } from "@/types/reward";

interface UserPointsData {
  total_xp: number;
  level: Level;
  level_progress: number;
  xp_to_next: number;
  streak_days: number;
  swap_count: number;
  total_volume_usd: number;
  referral_code: string;
  referral_count: number;
  x_follow_claimed: boolean;
}

export function useUserPoints() {
  const { address } = useAccount();
  const [data, setData] = useState<UserPointsData | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!address) {
      setData(null);
      return;
    }

    const fetch = async () => {
      setIsLoading(true);
      try {
        const res = await window.fetch(`/api/user?wallet=${address}`);
        if (res.ok) {
          const json = await res.json();
          setData(json);
        }
      } catch {
        // silently fail
      } finally {
        setIsLoading(false);
      }
    };

    fetch();
  }, [address]);

  const awardXP = async (xp_amount: number, event_type: string, volume_usd?: number) => {
    if (!address) return;
    try {
      const res = await window.fetch("/api/user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wallet: address, xp_amount, event_type, volume_usd: volume_usd ?? 0 }),
      });
      if (res.ok) {
        const json = await res.json();
        setData((prev) =>
          prev
            ? {
                ...prev,
                total_xp: json.new_xp,
                level: json.new_level,
              }
            : null
        );
        return json;
      }
    } catch {
      // silently fail
    }
  };

  return { data, isLoading, awardXP };
}

import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";
import {
  getLevelFromXP,
  getXPToNextLevel,
  getLevelProgress,
  XP_REWARDS,
} from "@/types/reward";
import { generateReferralCode } from "@/lib/points";

// ── GET /api/user?wallet=0x... ──────────────────────────────────────
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const wallet = searchParams.get("wallet")?.toLowerCase();

  if (!wallet) {
    return NextResponse.json({ error: "Wallet required" }, { status: 400 });
  }

  try {
    const supabase = createServiceClient();

    // Upsert: kullanıcı yoksa oluştur, varsa getir
    const { data, error } = await supabase
      .from("user_points")
      .upsert(
        {
          wallet_address: wallet,
          referral_code: generateReferralCode(wallet),
        },
        {
          onConflict: "wallet_address",
          ignoreDuplicates: true,
        }
      )
      .select()
      .single();

    if (error && error.code !== "23505") {
      // 23505 = unique violation (already exists) — fetch separately
      const { data: existing } = await supabase
        .from("user_points")
        .select("*")
        .eq("wallet_address", wallet)
        .single();

      if (existing) return buildResponse(existing);
      throw error;
    }

    const row = data ?? (await supabase
      .from("user_points")
      .select("*")
      .eq("wallet_address", wallet)
      .single()).data;

    return buildResponse(row);
  } catch (err) {
    console.error("GET /api/user error:", err);
    // Fallback: return empty profile so UI doesn't break
    return NextResponse.json(emptyProfile(wallet));
  }
}

// ── POST /api/user — award XP ───────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const { wallet, xp_amount, event_type, volume_usd } = await req.json();
    const addr = wallet?.toLowerCase();

    // Input validation
    if (!addr || typeof addr !== "string" || !/^0x[0-9a-fA-F]{40}$/.test(addr)) {
      return NextResponse.json({ error: "Invalid wallet address" }, { status: 400 });
    }
    if (typeof xp_amount !== "number" || xp_amount <= 0 || xp_amount > 10_000) {
      return NextResponse.json({ error: "Invalid xp_amount" }, { status: 400 });
    }
    const VALID_EVENTS = ["swap", "streak", "referral", "agent", "mint", "multi_swap", "profile"];
    if (!event_type || !VALID_EVENTS.includes(event_type)) {
      return NextResponse.json({ error: "Invalid event_type" }, { status: 400 });
    }
    if (volume_usd !== undefined && (typeof volume_usd !== "number" || volume_usd < 0 || volume_usd > 1e9)) {
      return NextResponse.json({ error: "Invalid volume_usd" }, { status: 400 });
    }

    const supabase = createServiceClient();

    // Fetch current row
    const { data: current } = await supabase
      .from("user_points")
      .select("*")
      .eq("wallet_address", addr)
      .single();

    const base = current ?? {
      wallet_address: addr,
      total_xp: 0,
      total_volume_usd: 0,
      swap_count: 0,
      referral_count: 0,
      streak_days: 0,
      last_swap_date: null,
      referral_code: generateReferralCode(addr),
    };

    const newVolume = (base.total_volume_usd ?? 0) + (volume_usd ?? 0);
    const newSwaps  = event_type === "swap" ? (base.swap_count ?? 0) + 1 : (base.swap_count ?? 0);

    // Streak logic
    let newStreak  = base.streak_days ?? 0;
    const today    = new Date().toISOString().split("T")[0];
    const lastDate = base.last_swap_date;
    if (event_type === "swap") {
      if (!lastDate) {
        newStreak = 1;
      } else {
        const diff = Math.floor(
          (new Date(today).getTime() - new Date(lastDate).getTime()) / 86400000
        );
        if (diff === 1) newStreak += 1;
        else if (diff > 1) newStreak = 1;
        // diff === 0 means already swapped today, keep streak
      }
    }

    // ── 7-day streak bonus ────────────────────────────────────────
    let streakBonusXP = 0;
    if (event_type === "swap" && newStreak > 0 && newStreak % 7 === 0) {
      streakBonusXP = XP_REWARDS.WEEK_STREAK;
    }

    const newXP = (base.total_xp ?? 0) + xp_amount + streakBonusXP;

    const updates = {
      wallet_address:   addr,
      total_xp:         newXP,
      total_volume_usd: newVolume,
      swap_count:       newSwaps,
      streak_days:      newStreak,
      last_swap_date:   event_type === "swap" ? today : lastDate,
      referral_code:    base.referral_code ?? generateReferralCode(addr),
      updated_at:       new Date().toISOString(),
    };

    const { error } = await supabase
      .from("user_points")
      .upsert(updates, { onConflict: "wallet_address" });

    if (error) throw error;

    // Log XP transaction
    await supabase.from("xp_transactions").insert({
      wallet_address: addr,
      amount:         xp_amount,
      reason:         event_type,
    }).throwOnError();

    // Log streak bonus separately if earned
    if (streakBonusXP > 0) {
      await supabase.from("xp_transactions").insert({
        wallet_address: addr,
        amount:         streakBonusXP,
        reason:         "streak",
      }).throwOnError();
    }

    const newLevel = getLevelFromXP(newXP);

    return NextResponse.json({
      success:      true,
      new_xp:       newXP,
      new_level:    newLevel,
      xp_earned:    xp_amount,
      streak_bonus: streakBonusXP,
      streak_days:  newStreak,
    });
  } catch (err) {
    console.error("POST /api/user error:", err);
    return NextResponse.json({ error: "Failed to award XP" }, { status: 500 });
  }
}

// ── Helpers ─────────────────────────────────────────────────────────

function buildResponse(row: Record<string, unknown>) {
  const xp      = (row.total_xp as number) ?? 0;
  const level   = getLevelFromXP(xp);
  const xpNext  = getXPToNextLevel(xp, level);
  const progress = getLevelProgress(xp, level);

  return NextResponse.json({
    ...row,
    level,
    xp_to_next:     xpNext,
    level_progress: progress,
    referral_code:  (row.referral_code as string) ?? generateReferralCode(row.wallet_address as string),
  });
}

function emptyProfile(wallet: string) {
  return {
    wallet_address:   wallet,
    total_xp:         0,
    level:            "Bronze",
    xp_to_next:       1000,
    level_progress:   0,
    streak_days:      0,
    swap_count:       0,
    total_volume_usd: 0,
    referral_count:   0,
    referral_code:    generateReferralCode(wallet),
  };
}

import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";
import { XP_REWARDS } from "@/types/reward";
import { generateReferralCode } from "@/lib/points";

/**
 * POST /api/social/follow
 * Awards 1000 XP for following @baseora on X (one-time per wallet).
 * Body: { wallet: string }
 *
 * Note: We can't programmatically verify Twitter follows without OAuth.
 * This uses an honor system — wallet can only claim once (stored in Supabase).
 */
export async function POST(req: NextRequest) {
  try {
    const { wallet } = await req.json();

    if (!wallet || typeof wallet !== "string" || !/^0x[0-9a-fA-F]{40}$/.test(wallet)) {
      return NextResponse.json({ error: "Invalid wallet address" }, { status: 400 });
    }

    const addr     = wallet.toLowerCase();
    const supabase = createServiceClient();

    // Check if already claimed
    const { data: existing } = await supabase
      .from("user_points")
      .select("x_follow_claimed, total_xp")
      .eq("wallet_address", addr)
      .single();

    if (existing?.x_follow_claimed) {
      return NextResponse.json({ error: "Already claimed", alreadyClaimed: true }, { status: 409 });
    }

    const currentXP = existing?.total_xp ?? 0;
    const newXP     = currentXP + XP_REWARDS.X_FOLLOW;

    // Upsert with x_follow_claimed = true
    const { error } = await supabase
      .from("user_points")
      .upsert({
        wallet_address:    addr,
        total_xp:          newXP,
        x_follow_claimed:  true,
        referral_code:     generateReferralCode(addr),
        updated_at:        new Date().toISOString(),
      }, { onConflict: "wallet_address" });

    if (error) throw error;

    // Log XP transaction
    await supabase.from("xp_transactions").insert({
      wallet_address: addr,
      amount:         XP_REWARDS.X_FOLLOW,
      reason:         "x_follow",
    });

    return NextResponse.json({ success: true, xp_earned: XP_REWARDS.X_FOLLOW, new_xp: newXP });
  } catch (err) {
    console.error("social/follow error:", err);
    return NextResponse.json({ error: "Failed to process request" }, { status: 500 });
  }
}

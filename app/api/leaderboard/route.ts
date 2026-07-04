import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";
import { getLevelFromXP } from "@/types/reward";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const sortBy = searchParams.get("sortBy") || "xp";
  const wallet = searchParams.get("wallet")?.toLowerCase();

  try {
    const supabase = createServiceClient();

    const orderCol =
      sortBy === "volume" ? "total_volume_usd" :
      sortBy === "swaps"  ? "swap_count" :
      "total_xp";

    const { data, error } = await supabase
      .from("user_points")
      .select("wallet_address, total_xp, total_volume_usd, swap_count, referral_count")
      .order(orderCol, { ascending: false })
      .limit(500);

    if (error) throw error;

    const rows = (data ?? []).map((row, i) => ({
      rank:             i + 1,
      wallet_address:   row.wallet_address,
      ens_name:         null,
      total_xp:         row.total_xp ?? 0,
      level:            getLevelFromXP(row.total_xp ?? 0),
      total_volume_usd: row.total_volume_usd ?? 0,
      swap_count:       row.swap_count ?? 0,
      referral_count:   row.referral_count ?? 0,
    }));

    let userEntry = null;
    if (wallet) {
      userEntry = rows.find(r => r.wallet_address.toLowerCase() === wallet);
      if (!userEntry) {
        userEntry = {
          rank:             rows.length + 1,
          wallet_address:   wallet,
          ens_name:         null,
          total_xp:         0,
          level:            "Bronze",
          total_volume_usd: 0,
          swap_count:       0,
          referral_count:   0,
        };
      }
    }

    return NextResponse.json({
      leaderboard: rows,
      userEntry,
      total: rows.length,
      source: "live",
    });
  } catch (err) {
    console.error("Leaderboard error:", err);
    return NextResponse.json({
      leaderboard: [],
      userEntry: null,
      total: 0,
      source: "error",
    });
  }
}

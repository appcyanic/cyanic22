import { NextRequest, NextResponse } from "next/server";
import { POPULAR_TOKENS, BASE_TOKENS } from "@/lib/tokens";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const query = searchParams.get("q")?.toLowerCase();

  let tokens = Object.values(BASE_TOKENS);

  if (query) {
    tokens = tokens.filter(
      (t) =>
        t.symbol.toLowerCase().includes(query) ||
        t.name.toLowerCase().includes(query) ||
        t.address.toLowerCase() === query
    );
  }

  // Fetch extended list from CoinGecko if no query filter
  if (!query) {
    try {
      const res = await fetch("https://tokens.coingecko.com/base/all.json", {
        next: { revalidate: 3600 },
      });
      if (res.ok) {
        const data = await res.json();
        const cgTokens = data.tokens
          ?.slice(0, 200)
          .filter((t: { address?: string; symbol?: string; decimals?: number }) =>
            // Validate required fields to prevent XSS/injection
            t.address && typeof t.address === "string" && /^0x[0-9a-fA-F]{40}$/.test(t.address) &&
            t.symbol && typeof t.symbol === "string" && t.symbol.length <= 20 &&
            typeof t.decimals === "number" && t.decimals >= 0 && t.decimals <= 36 &&
            !Object.values(BASE_TOKENS).find(bt => bt.address.toLowerCase() === t.address?.toLowerCase())
          )
          .map((t: { address: string; symbol: string; name?: string; decimals: number; logoURI?: string }) => ({
            address:  t.address,
            symbol:   t.symbol.slice(0, 20),
            name:     typeof t.name === "string" ? t.name.slice(0, 50) : t.symbol,
            decimals: t.decimals,
            logoURI:  typeof t.logoURI === "string" && t.logoURI.startsWith("https://") ? t.logoURI : undefined,
            chainId:  8453,
          }));
        tokens = [...tokens, ...(cgTokens || [])];
      }
    } catch {
      // Fallback to BASE_TOKENS only
    }
  }

  return NextResponse.json({
    tokens,
    popular: POPULAR_TOKENS,
  });
}

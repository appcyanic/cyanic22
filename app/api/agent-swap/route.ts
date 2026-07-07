import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

/**
 * POST /api/agent-swap
 *
 * x402-protected endpoint — the middleware.ts verifies & settles the $0.10 USDC
 * payment via https://x402.org/facilitator before this handler runs.
 *
 * In development (localhost) x402 middleware is disabled, so this handler
 * runs freely — useful for local testing without real payments.
 *
 * Receives swap params, fetches a quote from 0x Protocol v2,
 * and returns it to the frontend so wagmi can send the on-chain tx.
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const { sellToken, buyToken, sellAmount, taker } = await req.json();

    if (!sellToken || !buyToken || !sellAmount || !taker) {
      return NextResponse.json({ error: "Missing params: sellToken, buyToken, sellAmount, taker" }, { status: 400 });
    }

    const params = new URLSearchParams({
      sellToken,
      buyToken,
      sellAmount,
      taker,
      slippageBps: "50",
      chainId: "8453",
    });

    const quoteRes = await fetch(
      `https://api.0x.org/swap/allowance-holder/quote?${params}`,
      {
        headers: {
          "0x-api-key": process.env.ZEROX_API_KEY ?? "",
          "0x-version": "v2",
        },
      }
    );

    if (!quoteRes.ok) {
      const err = await quoteRes.json().catch(() => ({}));
      return NextResponse.json({ error: "Quote failed", details: err }, { status: 502 });
    }

    const quote = await quoteRes.json();
    return NextResponse.json({ quote });
  } catch (err) {
    console.error("agent-swap error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

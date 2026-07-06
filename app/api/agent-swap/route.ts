import { NextRequest, NextResponse } from "next/server";

const payTo   = (process.env.X402_PAY_TO_ADDRESS ?? "0x0000000000000000000000000000000000000000") as `0x${string}`;
const network = (process.env.X402_NETWORK ?? "base") as "base" | "base-sepolia";

export const runtime = "nodejs";

/**
 * POST /api/agent-swap
 * Protected by x402: $0.10 USDC per agent swap.
 */
async function handler(req: NextRequest): Promise<NextResponse> {
  try {
    const { sellToken, buyToken, sellAmount, taker } = await req.json();

    if (!sellToken || !buyToken || !sellAmount || !taker) {
      return NextResponse.json({ error: "Missing params" }, { status: 400 });
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
          "0x-api-key":  process.env.ZEROX_API_KEY ?? "",
          "0x-version":  "v2",
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

export async function POST(req: NextRequest): Promise<NextResponse> {
  // x402 payment verification via dynamic import (keeps x402-next out of webpack)
  try {
    const { paymentMiddleware } = await import("x402-next");
    const middleware = paymentMiddleware(payTo, {
      "/api/agent-swap": {
        price: "$0.10",
        network,
        config: {
          description: "Cyanic AI Agent Swap — $0.10 USDC per execution",
          maxTimeoutSeconds: 120,
        },
      },
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const paymentResponse = await (middleware as any)(req);
    if (paymentResponse && paymentResponse.status !== 200) {
      return paymentResponse as NextResponse;
    }
  } catch { /* x402 not available, proceed without payment */ }

  return handler(req);
}

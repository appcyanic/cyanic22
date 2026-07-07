import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

const payTo   = (process.env.X402_PAY_TO_ADDRESS ?? "0x0000000000000000000000000000000000000000") as `0x${string}`;
const network = process.env.X402_NETWORK ?? "base";

/**
 * POST /api/agent-swap
 *
 * Returns x402-compatible 402 response if no X-PAYMENT header.
 * Frontend uses x402/client to sign and retry with X-PAYMENT header.
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  // ── x402 payment check ─────────────────────────────────────────
  const paymentHeader = req.headers.get("X-PAYMENT") ?? req.headers.get("x-payment");
  const fallbackHeader = req.headers.get("X-Payment-TxHash");

  const isProduction = process.env.NODE_ENV === "production";
  const hasPayment   = !!paymentHeader || !!fallbackHeader;

  if (isProduction && !hasPayment && payTo !== "0x0000000000000000000000000000000000000000") {
    // Return x402-compatible 402 — frontend's x402/client handles this
    return NextResponse.json(
      {
        x402Version: 1,
        error:       "Payment Required",
        accepts: [
          {
            scheme:  "exact",
            network: `eip155:${network === "base" ? "8453" : "84532"}`,
            amount:  "100000",   // 0.1 USDC (6 decimals)
            asset:   "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", // USDC on Base
            payTo,
            maxTimeoutSeconds: 120,
            description: "Cyanic AI Agent Swap — $0.10 USDC per execution",
          },
        ],
      },
      {
        status: 402,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  // ── Fetch swap quote ────────────────────────────────────────────
  try {
    const { sellToken, buyToken, sellAmount, taker } = await req.json();

    if (!sellToken || !buyToken || !sellAmount || !taker) {
      return NextResponse.json({ error: "Missing params" }, { status: 400 });
    }

    const params = new URLSearchParams({
      sellToken, buyToken, sellAmount, taker,
      slippageBps: "50",
      chainId:     "8453",
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

import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

/**
 * POST /api/agent-swap
 *
 * x402-compatible protected endpoint — $0.10 USDC per execution.
 *
 * Why not x402-next's paymentMiddleware?
 * - In Edge runtime: @coinbase/cdp-sdk bundle exceeds 1 MB limit
 * - In nodejs route: x402-next ESM imports 'next/server' (no extension)
 *   which breaks Next.js 15 module resolution at build time
 *
 * Solution: implement the x402 protocol manually —
 *   1. No X-PAYMENT header → return 402 with x402-compatible requirements JSON
 *   2. Client signs with createPaymentHeader (x402/client) and retries
 *   3. Verify signed header via x402.org/facilitator REST API
 *   4. On success: fetch 0x quote and return it
 */

const PAYMENT_WALLET = process.env.X402_PAY_TO_ADDRESS as `0x${string}` | undefined;
const APP_URL        = process.env.NEXT_PUBLIC_APP_URL ?? "";
const FACILITATOR    = "https://x402.org/facilitator";

const isPublicUrl =
  APP_URL.startsWith("https://") &&
  !APP_URL.includes("localhost") &&
  !APP_URL.includes("127.0.0.1");

const x402Enabled =
  !!PAYMENT_WALLET &&
  /^0x[0-9a-fA-F]{40}$/.test(PAYMENT_WALLET) &&
  isPublicUrl;

const PAYMENT_REQUIREMENTS = {
  x402Version: 1,
  accepts: [
    {
      scheme:            "exact",
      network:           "eip155:8453",   // Base mainnet
      maxAmountRequired: "100000",        // 0.1 USDC (6 decimals)
      resource:          `${APP_URL}/api/agent-swap`,
      description:       "Cyanic AI Agent Swap — best route on Base network",
      mimeType:          "application/json",
      payTo:             PAYMENT_WALLET ?? "0x0000000000000000000000000000000000000000",
      maxTimeoutSeconds: 300,
      asset:             "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", // USDC on Base
      extra: {
        name:    "USD Coin",
        version: "2",
      },
    },
  ],
};

async function verifyX402Payment(paymentHeader: string): Promise<boolean> {
  try {
    const res = await fetch(`${FACILITATOR}/verify`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        x402Version:         PAYMENT_REQUIREMENTS.x402Version,
        paymentPayload:      paymentHeader,
        paymentRequirements: PAYMENT_REQUIREMENTS.accepts,
      }),
    });
    if (!res.ok) return false;
    const data = await res.json() as { isValid?: boolean };
    return data.isValid === true;
  } catch (err) {
    console.error("x402 verify error:", err);
    return false;
  }
}

async function settleX402Payment(paymentHeader: string): Promise<void> {
  try {
    await fetch(`${FACILITATOR}/settle`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        x402Version:         PAYMENT_REQUIREMENTS.x402Version,
        paymentPayload:      paymentHeader,
        paymentRequirements: PAYMENT_REQUIREMENTS.accepts,
      }),
    });
  } catch (err) {
    console.error("x402 settle error:", err);
  }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const paymentHeader = req.headers.get("X-PAYMENT") ?? req.headers.get("x-payment");

  // ── x402 gate ─────────────────────────────────────────────────────
  if (x402Enabled) {
    if (!paymentHeader) {
      // Return 402 with x402-compatible requirements
      return NextResponse.json(PAYMENT_REQUIREMENTS, {
        status:  402,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Verify the signed payment header via x402.org/facilitator
    const isValid = await verifyX402Payment(paymentHeader);
    if (!isValid) {
      return NextResponse.json(
        { x402Version: 1, error: "Payment verification failed" },
        { status: 402 }
      );
    }
  }

  // ── Fetch 0x quote ────────────────────────────────────────────────
  try {
    const { sellToken, buyToken, sellAmount, taker } = await req.json();

    if (!sellToken || !buyToken || !sellAmount || !taker) {
      return NextResponse.json(
        { error: "Missing params: sellToken, buyToken, sellAmount, taker" },
        { status: 400 }
      );
    }

    const params = new URLSearchParams({
      sellToken,
      buyToken,
      sellAmount,
      taker,
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

    // Settle payment async after successful quote (don't block response)
    if (x402Enabled && paymentHeader) {
      settleX402Payment(paymentHeader).catch(console.error);
    }

    return NextResponse.json({ quote });
  } catch (err) {
    console.error("agent-swap error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

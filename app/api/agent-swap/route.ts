import { NextRequest, NextResponse } from "next/server";
import { paymentMiddleware } from "x402-next";

export const runtime = "nodejs";

/**
 * POST /api/agent-swap
 *
 * x402-protected endpoint — $0.10 USDC per execution.
 *
 * paymentMiddleware runs inside this nodejs route handler (NOT in Edge middleware)
 * because @coinbase/cdp-sdk exceeds the 1 MB Edge Function bundle limit.
 *
 * Flow:
 * 1. First call: no X-PAYMENT header → paymentMiddleware returns 402 with requirements
 * 2. Client signs payment with createPaymentHeader (x402/client)
 * 3. Retry with X-PAYMENT header → middleware verifies via x402.org/facilitator
 * 4. On success: fetch 0x quote and return it
 */

const PAYMENT_WALLET = process.env.X402_PAY_TO_ADDRESS as `0x${string}` | undefined;
const APP_URL        = process.env.NEXT_PUBLIC_APP_URL ?? "";

// x402 requires a valid wallet + public HTTPS URL (facilitator can't reach localhost)
const isPublicUrl =
  APP_URL.startsWith("https://") &&
  !APP_URL.includes("localhost") &&
  !APP_URL.includes("127.0.0.1");

const x402Enabled =
  !!PAYMENT_WALLET &&
  /^0x[0-9a-fA-F]{40}$/.test(PAYMENT_WALLET) &&
  isPublicUrl;

// Build the paymentMiddleware handler once (module-level, not per request)
const x402Handler = x402Enabled
  ? paymentMiddleware(
      PAYMENT_WALLET!,
      {
        "/api/agent-swap": {
          price: "$0.10",
          network: "base",
          config: {
            description: "Cyanic AI Agent Swap — best route on Base network",
          },
        },
      },
      { url: "https://x402.org/facilitator" }
    )
  : null;

export async function POST(req: NextRequest): Promise<NextResponse> {
  // ── x402 payment gate ─────────────────────────────────────────────
  if (x402Handler) {
    const paymentResult = await x402Handler(req);
    // paymentMiddleware returns a Response only when payment is required/invalid
    if (paymentResult && (paymentResult as Response).status !== 200) {
      return paymentResult as unknown as NextResponse;
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

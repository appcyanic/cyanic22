import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

const payTo   = (process.env.X402_PAY_TO_ADDRESS ?? "0x0000000000000000000000000000000000000000") as `0x${string}`;
const network = process.env.X402_NETWORK ?? "base";
const CDP_API_KEY_ID     = process.env.CDP_API_KEY_ID ?? "";
const CDP_API_KEY_SECRET = process.env.CDP_API_KEY_SECRET ?? "";
const CDP_FACILITATOR    = "https://api.cdp.coinbase.com/platform/v2/x402";

// ── CDP Facilitator auth header ────────────────────────────────────
async function getCdpAuthHeader(): Promise<string> {
  // CDP uses JWT auth — for simple cases, Basic auth with key:secret works
  const credentials = Buffer.from(`${CDP_API_KEY_ID}:${CDP_API_KEY_SECRET}`).toString("base64");
  return `Basic ${credentials}`;
}

// ── Verify payment via CDP Facilitator ─────────────────────────────
async function verifyPayment(paymentHeader: string, paymentRequired: Record<string, unknown>): Promise<boolean> {
  if (!CDP_API_KEY_ID || !CDP_API_KEY_SECRET) return true; // skip if not configured

  try {
    const auth = await getCdpAuthHeader();
    const res = await fetch(`${CDP_FACILITATOR}/verify`, {
      method:  "POST",
      headers: { "Content-Type": "application/json", "Authorization": auth },
      body:    JSON.stringify({
        x402Version:        paymentRequired.x402Version ?? 1,
        paymentPayload:     paymentHeader,
        paymentRequirements: paymentRequired.accepts,
      }),
    });

    if (!res.ok) {
      console.error("CDP verify failed:", res.status, await res.text().catch(() => ""));
      return false;
    }

    const data = await res.json() as { isValid?: boolean };
    return data.isValid === true;
  } catch (err) {
    console.error("CDP verify error:", err);
    return false;
  }
}

// ── Settle payment via CDP Facilitator ─────────────────────────────
async function settlePayment(paymentHeader: string, paymentRequired: Record<string, unknown>): Promise<void> {
  if (!CDP_API_KEY_ID || !CDP_API_KEY_SECRET) return;

  try {
    const auth = await getCdpAuthHeader();
    await fetch(`${CDP_FACILITATOR}/settle`, {
      method:  "POST",
      headers: { "Content-Type": "application/json", "Authorization": auth },
      body:    JSON.stringify({
        x402Version:        paymentRequired.x402Version ?? 1,
        paymentPayload:     paymentHeader,
        paymentRequirements: paymentRequired.accepts,
      }),
    });
  } catch (err) {
    console.error("CDP settle error:", err);
  }
}

const PAYMENT_REQUIREMENTS = {
  x402Version: 1,
  accepts: [
    {
      scheme:  "exact",
      network: `eip155:${network === "base" ? "8453" : "84532"}`,
      amount:  "100000",   // 0.1 USDC (6 decimals)
      asset:   "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
      payTo,
      maxTimeoutSeconds: 120,
      description: "Cyanic AI Agent Swap — $0.10 USDC per execution",
    },
  ],
};

/**
 * POST /api/agent-swap
 * x402-protected: returns 402 if no X-PAYMENT header.
 * CDP Facilitator verifies & settles the payment.
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  const paymentHeader  = req.headers.get("X-PAYMENT") ?? req.headers.get("x-payment");
  const fallbackHeader = req.headers.get("X-Payment-TxHash");
  const isProduction   = process.env.NODE_ENV === "production";
  const hasPayment     = !!paymentHeader || !!fallbackHeader;

  if (isProduction && !hasPayment && payTo !== "0x0000000000000000000000000000000000000000") {
    return NextResponse.json(PAYMENT_REQUIREMENTS, {
      status: 402,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Verify payment via CDP Facilitator
  if (isProduction && paymentHeader) {
    const isValid = await verifyPayment(paymentHeader, PAYMENT_REQUIREMENTS);
    if (!isValid) {
      return NextResponse.json({ error: "Payment verification failed" }, { status: 402 });
    }
  }

  // Fetch swap quote
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
      { headers: { "0x-api-key": process.env.ZEROX_API_KEY ?? "", "0x-version": "v2" } }
    );

    if (!quoteRes.ok) {
      const err = await quoteRes.json().catch(() => ({}));
      return NextResponse.json({ error: "Quote failed", details: err }, { status: 502 });
    }

    const quote = await quoteRes.json();

    // Settle payment after successful quote (async, don't block response)
    if (isProduction && paymentHeader) {
      settlePayment(paymentHeader, PAYMENT_REQUIREMENTS).catch(console.error);
    }

    return NextResponse.json({ quote });
  } catch (err) {
    console.error("agent-swap error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

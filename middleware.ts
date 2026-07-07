import { paymentMiddleware } from "x402-next";
import { type NextRequest, NextResponse } from "next/server";

/**
 * x402 Payment Middleware — protects /api/agent-swap with $0.10 USDC
 * Only active on public HTTPS URLs (not localhost)
 */

const PAYMENT_WALLET = process.env.X402_PAY_TO_ADDRESS;
const APP_URL        = process.env.NEXT_PUBLIC_BASE_URL ?? "";

const isPublicUrl =
  APP_URL.startsWith("https://") &&
  !APP_URL.includes("localhost") &&
  !APP_URL.includes("127.0.0.1");

const isX402Enabled =
  typeof PAYMENT_WALLET === "string" &&
  /^0x[0-9a-fA-F]{40}$/.test(PAYMENT_WALLET) &&
  isPublicUrl;

const x402Handler = isX402Enabled
  ? paymentMiddleware(
      PAYMENT_WALLET as `0x${string}`,
      {
        "/api/agent-swap": {
          price:   "$0.10",
          network: (process.env.X402_NETWORK || "base") as "base" | "base-sepolia",
          config: {
            description: "Cyanic AI Agent Swap — $0.10 USDC per execution",
            maxTimeoutSeconds: 120,
          },
        },
      }
    )
  : null;

export const runtime = "nodejs";

export default async function middleware(req: NextRequest) {
  if (x402Handler) {
    return x402Handler(req);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/api/agent-swap"],
};

import { paymentMiddleware } from "x402-next";
import { type NextRequest, NextResponse } from "next/server";

/**
 * x402 Payment Middleware
 *
 * Protects POST /api/agent-swap with a $0.10 USDC payment.
 * All other routes (chat, quote, price, etc.) remain free.
 *
 * Network: 'base' (Base mainnet) + https://x402.org/facilitator
 *
 * REQUIREMENTS to activate:
 * 1. X402_PAY_TO_ADDRESS — valid EIP-55 checksummed wallet address in .env.local
 * 2. NEXT_PUBLIC_APP_URL — must be a public HTTPS URL (not localhost)
 *    The x402 facilitator must reach your endpoint to verify payments.
 *    In development (localhost) x402 middleware is automatically disabled.
 */

const PAYMENT_WALLET = process.env.X402_PAY_TO_ADDRESS;
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "";

// x402 requires a valid wallet address AND a public HTTPS URL
// (facilitator cannot reach localhost to verify payments)
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
          price: "$0.10",
          network: "base",
          config: {
            description: "Cyanic AI Agent Swap — best route on Base network",
          },
        },
      },
      {
        url: "https://x402.org/facilitator",
      }
    )
  : null;

export default async function middleware(request: NextRequest) {
  if (x402Handler) {
    return x402Handler(request);
  }
  // x402 disabled: wallet not configured or running on localhost
  return NextResponse.next();
}

export const config = {
  matcher: ["/api/agent-swap"],
};

import { NextRequest, NextResponse } from "next/server";
import { withX402 } from "x402-next";

const payTo = (process.env.X402_PAY_TO_ADDRESS || "0x0000000000000000000000000000000000000000") as `0x${string}`;
const network = (process.env.X402_NETWORK || "base-sepolia") as "base" | "base-sepolia";

/**
 * POST /api/swap-fee
 *
 * Called by the frontend after a swap transaction is confirmed on-chain.
 * Protected by x402: costs $0.10 USDC per confirmed swap.
 */
async function swapFeeHandler(req: NextRequest): Promise<NextResponse> {
  const { txHash, sellToken, buyToken, sellAmount, buyAmount } = await req.json().catch(() => ({}));

  return NextResponse.json({
    success: true,
    message: "Swap fee collected",
    txHash,
    sellToken,
    buyToken,
    sellAmount,
    buyAmount,
  });
}

export const POST = withX402(
  swapFeeHandler,
  payTo,
  {
    price: "$0.10",
    network,
    config: {
      description: "Cyanic Swap Fee — $0.10 USDC per confirmed swap",
      maxTimeoutSeconds: 120,
    },
  }
);

import { paymentMiddleware } from "x402-next";

const payTo   = (process.env.X402_PAY_TO_ADDRESS || "0x0000000000000000000000000000000000000000") as `0x${string}`;
const network = (process.env.X402_NETWORK || "base") as "base" | "base-sepolia";

export const middleware = paymentMiddleware(
  payTo,
  {
    "/api/agent": {
      price: "$0.10",
      network,
      config: {
        description: "Cyanic AI Agent — $0.10 USDC per message",
        maxTimeoutSeconds: 120,
      },
    },
  }
);

export const runtime = "nodejs";

export const config = {
  matcher: ["/api/agent"],
};

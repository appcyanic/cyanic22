import { paymentProxy, x402ResourceServer } from "@x402/next";
import { ExactEvmScheme } from "@x402/evm/exact/server";
import { HTTPFacilitatorClient } from "@x402/core/http";
import { facilitator } from "@coinbase/x402";

const payTo = (process.env.X402_PAY_TO_ADDRESS || "0x0000000000000000000000000000000000000000") as `0x${string}`;

// CDP facilitator (mainnet Base + Base Sepolia)
const facilitatorClient = new HTTPFacilitatorClient(facilitator);

const server = new x402ResourceServer(facilitatorClient)
  .register("eip155:8453", new ExactEvmScheme()); // Base mainnet

export const middleware = paymentProxy(
  {
    "/api/agent": {
      accepts: [
        {
          scheme:  "exact",
          price:   "$0.10",
          network: "eip155:8453",
          payTo,
        },
      ],
      description: "Cyanic AI Agent — $0.10 USDC per message (covers Anthropic API cost)",
      mimeType:    "application/json",
    },
  },
  server,
);

export const config = {
  matcher: ["/api/agent"],
};

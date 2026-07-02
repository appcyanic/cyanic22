import { createClient, getRoutes, getStatus } from "@lifi/sdk";
import type { RoutesRequest, Route, GetStatusRequest } from "@lifi/sdk";

// Allowed bridges — exclude known-risky bridges
export const ALLOWED_BRIDGES = [
  "across",
  "stargate",
  "hop",
  "connext",
  "wormhole",
  "celer",
  "allbridge",
  "synapse",
  "relay",
  "gaszipbridge",
  "gaszip",
];

export const BRIDGE_INFO: Record<string, { label: string; color: string; security: string }> = {
  across:   { label: "Across",   color: "#00C896", security: "⭐⭐⭐⭐⭐ No hacks" },
  stargate: { label: "Stargate", color: "#FF6B6B", security: "⭐⭐⭐⭐  Audited" },
  hop:      { label: "Hop",      color: "#E85FFF", security: "⭐⭐⭐⭐  Safe" },
  connext:  { label: "Connext",  color: "#FFB547", security: "⭐⭐⭐⭐  Safe" },
  celer:    { label: "Celer",    color: "#00A3FF", security: "⭐⭐⭐   Caution" },
  wormhole: { label: "Wormhole", color: "#9B59B6", security: "⭐⭐⭐⭐  Audited" },
  relay:    { label: "Relay",    color: "#0052FF", security: "⭐⭐⭐⭐  Safe" },
};

// Initialize LI.FI client once (v4 API)
let lifiClient: ReturnType<typeof createClient> | null = null;

export function getLifiClient() {
  if (!lifiClient) {
    lifiClient = createClient({
      integrator: process.env.NEXT_PUBLIC_LIFI_INTEGRATOR ?? "cyanic",
    });
  }
  return lifiClient;
}

// Keep initLifi for backwards compatibility with BridgeCard useEffect
export function initLifi() {
  getLifiClient();
}

export interface BridgeRouteParams {
  fromChainId: number;
  toChainId: number;
  fromTokenAddress: string;
  toTokenAddress: string;
  fromAmount: string;    // wei string
  fromAddress: string;
  slippage?: number;
}

export async function fetchBridgeRoutes(params: BridgeRouteParams): Promise<Route[]> {
  const client = getLifiClient();

  const request: RoutesRequest = {
    fromChainId: params.fromChainId,
    toChainId:   params.toChainId,
    fromTokenAddress: params.fromTokenAddress,
    toTokenAddress:   params.toTokenAddress,
    fromAmount:  params.fromAmount,
    fromAddress: params.fromAddress,
    options: {
      slippage:           params.slippage ?? 0.005,
      maxPriceImpact:     0.05,
      allowSwitchChain:   false,
      integrator:         process.env.NEXT_PUBLIC_LIFI_INTEGRATOR ?? "cyanic",
      // fee removed — requires portal.li.fi registration to collect integrator fees
    },
  };

  const response = await getRoutes(client, request);
  return response.routes ?? [];
}

export async function fetchBridgeStatus(req: GetStatusRequest) {
  const client = getLifiClient();
  return getStatus(client, req);
}

export function formatBridgeDuration(seconds: number): string {
  if (seconds < 60) return `~${seconds}s`;
  return `~${Math.round(seconds / 60)}min`;
}

export function getBridgeInfo(tool: string) {
  return BRIDGE_INFO[tool.toLowerCase()] ?? {
    label: tool,
    color: "#8B8FA8",
    security: "⭐⭐⭐  Unknown",
  };
}

import type { BridgeChain } from "@/types/bridge";

export const SUPPORTED_CHAINS: BridgeChain[] = [
  { id: 1,      name: "Ethereum",  icon: "⟠", rpc: "https://eth.llamarpc.com",                  blockExplorer: "https://etherscan.io",             logoURI: "https://assets.coingecko.com/coins/images/279/small/ethereum.png" },
  { id: 8453,   name: "Base",      icon: "🔵", rpc: "https://mainnet.base.org",                  blockExplorer: "https://basescan.org",              logoURI: "https://assets.coingecko.com/asset_platforms/images/131/small/base-network.png" },
  { id: 42161,  name: "Arbitrum",  icon: "🔷", rpc: "https://arb1.arbitrum.io/rpc",              blockExplorer: "https://arbiscan.io",               logoURI: "https://assets.coingecko.com/coins/images/16547/small/photo_2023-03-29_21.47.00.jpeg" },
  { id: 10,     name: "Optimism",  icon: "🔴", rpc: "https://mainnet.optimism.io",               blockExplorer: "https://optimistic.etherscan.io",   logoURI: "https://assets.coingecko.com/coins/images/25244/small/Optimism.png" },
  { id: 137,    name: "Polygon",   icon: "🟣", rpc: "https://polygon-rpc.com",                   blockExplorer: "https://polygonscan.com",            logoURI: "https://assets.coingecko.com/coins/images/4713/small/polygon.png" },
  { id: 56,     name: "BNB Chain", icon: "🟡", rpc: "https://bsc-dataseed.binance.org",          blockExplorer: "https://bscscan.com",                logoURI: "https://assets.coingecko.com/coins/images/825/small/bnb-icon2_2x.png" },
  { id: 43114,  name: "Avalanche", icon: "🔺", rpc: "https://api.avax.network/ext/bc/C/rpc",     blockExplorer: "https://snowtrace.io",              logoURI: "https://assets.coingecko.com/coins/images/12559/small/Avalanche_Circle_RedWhite_Trans.png" },
  { id: 59144,  name: "Linea",     icon: "🔷", rpc: "https://rpc.linea.build",                   blockExplorer: "https://lineascan.build",            logoURI: "https://assets.coingecko.com/asset_platforms/images/135/small/linea.jpeg" },
  { id: 534352, name: "Scroll",    icon: "📜", rpc: "https://rpc.scroll.io",                     blockExplorer: "https://scrollscan.com",             logoURI: "https://assets.coingecko.com/asset_platforms/images/134/small/scroll.jpeg" },
];

export const CHAIN_MAP: Record<number, BridgeChain> = Object.fromEntries(
  SUPPORTED_CHAINS.map(c => [c.id, c])
);

export function getChain(id: number): BridgeChain | undefined {
  return CHAIN_MAP[id];
}

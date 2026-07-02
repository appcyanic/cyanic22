import { http } from "wagmi";
import {
  base, mainnet, optimism, arbitrum, polygon, bsc, avalanche, linea, scroll,
} from "wagmi/chains";
import { getDefaultConfig } from "@rainbow-me/rainbowkit";

export const wagmiConfig = getDefaultConfig({
  appName: "Cyanic DEX Aggregator",
  projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || "demo_project_id",
  chains: [base, mainnet, optimism, arbitrum, polygon, bsc, avalanche, linea, scroll],
  transports: {
    [base.id]:      http(process.env.NEXT_PUBLIC_BASE_RPC_URL || "https://mainnet.base.org"),
    [mainnet.id]:   http("https://eth.llamarpc.com"),
    [optimism.id]:  http("https://mainnet.optimism.io"),
    [arbitrum.id]:  http("https://arb1.arbitrum.io/rpc"),
    [polygon.id]:   http("https://polygon-rpc.com"),
    [bsc.id]:       http("https://bsc-dataseed.binance.org"),
    [avalanche.id]: http("https://api.avax.network/ext/bc/C/rpc"),
    [linea.id]:     http("https://rpc.linea.build"),
    [scroll.id]:    http("https://rpc.scroll.io"),
  },
  ssr: true,
});

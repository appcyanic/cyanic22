import type { Token } from "@/types/token";

export const BASE_NATIVE_TOKEN_ADDRESS =
  "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE";

export const BASE_TOKENS: Record<string, Token> = {
  ETH: {
    address: BASE_NATIVE_TOKEN_ADDRESS,
    symbol: "ETH",
    name: "Ethereum",
    decimals: 18,
    logoURI: "https://assets.coingecko.com/coins/images/279/large/ethereum.png",
    chainId: 8453,
  },
  USDC: {
    address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    symbol: "USDC",
    name: "USD Coin",
    decimals: 6,
    logoURI: "https://assets.coingecko.com/coins/images/6319/large/usdc.png",
    chainId: 8453,
  },
  WETH: {
    address: "0x4200000000000000000000000000000000000006",
    symbol: "WETH",
    name: "Wrapped Ether",
    decimals: 18,
    logoURI: "https://assets.coingecko.com/coins/images/2518/large/weth.png",
    chainId: 8453,
  },
  cbETH: {
    address: "0x2Ae3F1Ec7F1F5012CFEab0185bfc7aa3cf0DEc22",
    symbol: "cbETH",
    name: "Coinbase Wrapped Staked ETH",
    decimals: 18,
    logoURI: "https://assets.coingecko.com/coins/images/27008/large/cbeth.png",
    chainId: 8453,
  },
  USDT: {
    address: "0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2",
    symbol: "USDT",
    name: "Tether USD",
    decimals: 6,
    logoURI: "https://assets.coingecko.com/coins/images/325/large/tether.png",
    chainId: 8453,
  },
  BRETT: {
    address: "0x532f27101965dd16442E59d40670FaF5eBB142E4",
    symbol: "BRETT",
    name: "Brett",
    decimals: 18,
    logoURI: "https://assets.coingecko.com/coins/images/35529/large/brett.jpeg",
    chainId: 8453,
  },
  DEGEN: {
    address: "0x4ed4E862860beD51a9570b96d89aF5E1B0Efefed",
    symbol: "DEGEN",
    name: "Degen",
    decimals: 18,
    logoURI: "https://assets.coingecko.com/coins/images/34515/large/android-chrome-512x512.png",
    chainId: 8453,
  },
  DAI: {
    address: "0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb",
    symbol: "DAI",
    name: "Dai Stablecoin",
    decimals: 18,
    logoURI: "https://assets.coingecko.com/coins/images/9956/large/Badge_Dai.png",
    chainId: 8453,
  },
  AERO: {
    address: "0x940181a94A35A4569E4529A3CDfB74e38FD98631",
    symbol: "AERO",
    name: "Aerodrome Finance",
    decimals: 18,
    logoURI: "https://assets.coingecko.com/coins/images/31745/large/token.png",
    chainId: 8453,
  },
  HIGHER: {
    address: "0x0578d8A44db98B23BF096A382e016e29a5Ce0ffe",
    symbol: "HIGHER",
    name: "Higher",
    decimals: 18,
    logoURI: "https://assets.coingecko.com/coins/images/36103/large/200x200logo.png",
    chainId: 8453,
  },
};

export const POPULAR_TOKENS: Token[] = [
  BASE_TOKENS.ETH,
  BASE_TOKENS.USDC,
  BASE_TOKENS.USDT,
  BASE_TOKENS.WETH,
  BASE_TOKENS.cbETH,
  BASE_TOKENS.DEGEN,
  BASE_TOKENS.BRETT,
  BASE_TOKENS.AERO,
];

export function getTokenByAddress(address: string): Token | undefined {
  return Object.values(BASE_TOKENS).find(
    (t) => t.address.toLowerCase() === address.toLowerCase()
  );
}

export function getTokenBySymbol(symbol: string): Token | undefined {
  return BASE_TOKENS[symbol.toUpperCase()];
}

export function formatTokenAmount(
  amount: string | bigint,
  decimals: number,
  precision = 6
): string {
  const n =
    typeof amount === "bigint"
      ? Number(amount) / Math.pow(10, decimals)
      : Number(amount) / Math.pow(10, decimals);
  if (n === 0) return "0";
  if (n < 0.000001) return "< 0.000001";
  if (n < 1) return n.toFixed(precision);
  if (n < 1000) return n.toFixed(4);
  if (n < 1000000) return (n / 1000).toFixed(2) + "K";
  return (n / 1000000).toFixed(2) + "M";
}

export function parseTokenAmount(amount: string, decimals: number): bigint {
  const [integer, decimal = ""] = amount.split(".");
  const paddedDecimal = decimal.padEnd(decimals, "0").slice(0, decimals);
  return BigInt(integer + paddedDecimal);
}

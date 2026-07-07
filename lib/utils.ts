import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function shortenAddress(address: string, chars = 4): string {
  return `${address.slice(0, chars + 2)}...${address.slice(-chars)}`;
}

export function formatUSD(amount: number, decimals = 2): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(amount);
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function debounce<T extends (...args: unknown[]) => unknown>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timer: ReturnType<typeof setTimeout>;
  return (...args: Parameters<T>) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

export function isValidAddress(address: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
}

// Stablecoin and ETH-like token lists for volume estimation
const STABLE_SYMBOLS = ["USDC", "USDT", "DAI", "USDS", "USDBC", "USD+", "CUSD", "CRVUSD", "EURC"];
const ETH_SYMBOLS    = ["ETH", "WETH", "CBETH", "WSTETH"];

/**
 * Estimate swap volume in USD without needing a price feed.
 * - If either token is a stablecoin → use its human-readable amount directly as USD
 * - If either token is ETH/WETH → multiply by a conservative ETH price estimate
 * - Otherwise → return 0 (unknown pair, don't guess)
 *
 * @param sellSymbol  e.g. "ETH"
 * @param buySymbol   e.g. "USDC"
 * @param sellAmountHuman  human-readable sell amount, e.g. "0.5"
 * @param buyAmountHuman   human-readable buy amount,  e.g. "1250.00"
 * @param ethPriceUSD  optional live ETH price (defaults to 2500 as conservative estimate)
 */
export function estimateVolumeUSD(
  sellSymbol: string,
  buySymbol: string,
  sellAmountHuman: string,
  buyAmountHuman: string,
  ethPriceUSD = 2500
): number {
  const sell = sellSymbol.toUpperCase();
  const buy  = buySymbol.toUpperCase();
  const sellAmt = parseFloat(sellAmountHuman) || 0;
  const buyAmt  = parseFloat(buyAmountHuman)  || 0;

  // Stablecoin out → most reliable
  if (STABLE_SYMBOLS.includes(buy))  return Math.max(buyAmt,  0.01);
  // Stablecoin in → reliable
  if (STABLE_SYMBOLS.includes(sell)) return Math.max(sellAmt, 0.01);
  // ETH-like in
  if (ETH_SYMBOLS.includes(sell))    return Math.max(sellAmt * ethPriceUSD, 0.01);
  // ETH-like out
  if (ETH_SYMBOLS.includes(buy))     return Math.max(buyAmt  * ethPriceUSD, 0.01);

  return 0;
}

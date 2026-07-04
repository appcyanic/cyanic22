"use client";

import { useState, useEffect, useCallback } from "react";
import type { SwapQuote } from "@/types/swap";
import { getBestRouteDisplay } from "@/lib/0x";
import { formatTokenAmount } from "@/lib/tokens";

export interface DexQuote {
  dex: string;           // "Uniswap_V3"
  label: string;         // "Uniswap V3"
  proportion: number;    // 0-1
  buyAmount: string;     // human-readable
  buyAmountRaw: string;  // raw bigint string
  isBest: boolean;
}

interface UseSwapQuoteParams {
  sellToken?: string;
  buyToken?: string;
  sellAmount?: string;
  takerAddress?: string;
  slippageBps?: number;
  enabled?: boolean;
  buyDecimals?: number;
}

interface UseSwapQuoteResult {
  quote: SwapQuote | null;
  isLoading: boolean;
  error: string | null;
  routes: string[];
  dexQuotes: DexQuote[];
  selectedDex: string | null;
  setSelectedDex: (dex: string | null) => void;
  effectiveBuyAmount: string;
  refetch: () => void;
}

function buildDexQuotes(
  sources: { name: string; proportion: string }[],
  totalBuyAmountRaw: string,
  buyDecimals: number
): DexQuote[] {
  const active = sources.filter(s => parseFloat(s.proportion) > 0);
  if (active.length === 0) return [];

  const totalRaw = BigInt(totalBuyAmountRaw || "0");

  // Find best (highest proportion)
  const bestProportion = Math.max(...active.map(s => parseFloat(s.proportion)));

  return active
    .sort((a, b) => parseFloat(b.proportion) - parseFloat(a.proportion))
    .map(s => {
      const prop = parseFloat(s.proportion);
      // Each DEX's buy amount is proportional share of the aggregated total
      // To simulate individual DEX price: assume each DEX alone would give
      // their proportion * total / their proportion = total (but adjusted for efficiency)
      // We use: dex_buyAmount = totalBuyAmount * (1 / proportion) * proportion
      // Simpler: if this DEX handled 100% of the swap, scale accordingly
      // proportion = their liquidity share, so solo price ≈ total * proportion_factor
      // We'll show: "if only this DEX" = total * (prop / bestProportion) * 0.98 for non-best
      const scaleFactor = s.name === active.find(a => parseFloat(a.proportion) === bestProportion)?.name
        ? 1.0
        : prop / bestProportion * 0.98;

      const rawScaled = BigInt(Math.floor(Number(totalRaw) * scaleFactor));
      const human = formatTokenAmount(rawScaled.toString(), buyDecimals);

      return {
        dex: s.name,
        label: s.name
          .replace("_V3", " V3")
          .replace("_V2", " V2")
          .replace("_", " "),
        proportion: prop,
        buyAmount: human,
        buyAmountRaw: rawScaled.toString(),
        isBest: prop === bestProportion,
      };
    });
}

export function useSwapQuote({
  sellToken,
  buyToken,
  sellAmount,
  takerAddress,
  slippageBps = 50,
  enabled = true,
  buyDecimals = 18,
}: UseSwapQuoteParams): UseSwapQuoteResult {
  const [quote, setQuote]           = useState<SwapQuote | null>(null);
  const [isLoading, setIsLoading]   = useState(false);
  const [error, setError]           = useState<string | null>(null);
  const [selectedDex, setSelectedDex] = useState<string | null>(null);

  const fetchQuote = useCallback(async () => {
    if (!sellToken || !buyToken || !sellAmount || !enabled) return;

    let amount: bigint;
    try {
      // sellAmount must be an integer string (wei units); guard against floats
      amount = BigInt(Math.floor(Number(sellAmount || "0")));
    } catch {
      amount = BigInt(0);
    }
    if (amount === BigInt(0)) {
      setQuote(null);
      setSelectedDex(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        sellToken,
        buyToken,
        sellAmount,
        slippageBps: slippageBps.toString(),
        chainId: "8453",
      });
      if (takerAddress) params.set("taker", takerAddress);

      const endpoint = takerAddress ? "/api/quote" : "/api/price";
      const res  = await fetch(`${endpoint}?${params.toString()}`);
      const data = await res.json();

      if (!res.ok) throw new Error(data.reason || "Failed to fetch quote");

      setQuote(data);
      setSelectedDex(null); // reset selection on new quote
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      setQuote(null);
    } finally {
      setIsLoading(false);
    }
  }, [sellToken, buyToken, sellAmount, takerAddress, slippageBps, enabled]);

  useEffect(() => {
    const timer = setTimeout(fetchQuote, 500);
    return () => clearTimeout(timer);
  }, [fetchQuote]);

  const routes = quote?.sources ? getBestRouteDisplay(quote.sources) : [];

  const dexQuotes = quote?.sources && quote.buyAmount
    ? buildDexQuotes(quote.sources, quote.buyAmount, buyDecimals)
    : [];

  // Effective buy amount: if user selected a specific DEX use that, else best (quote default)
  const effectiveBuyAmount = (() => {
    if (selectedDex && dexQuotes.length > 0) {
      const found = dexQuotes.find(d => d.dex === selectedDex);
      if (found) return found.buyAmount;
    }
    return quote?.buyAmount
      ? formatTokenAmount(quote.buyAmount, buyDecimals)
      : "";
  })();

  return {
    quote,
    isLoading,
    error,
    routes,
    dexQuotes,
    selectedDex,
    setSelectedDex,
    effectiveBuyAmount,
    refetch: fetchQuote,
  };
}

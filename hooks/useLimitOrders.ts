"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useAccount, useWalletClient, usePublicClient } from "wagmi";
import { parseUnits } from "viem";
import { toast } from "sonner";
import type { LimitOrder } from "@/types/limit-order";
import type { Token } from "@/types/token";
import { formatTokenAmount } from "@/lib/tokens";

const PRICE_POLL_INTERVAL = 15_000; // 15s

/* fetch current market price for a token pair via our /api/price endpoint */
async function fetchCurrentPrice(
  sellToken: string,
  buyToken: string,
  sellAmount: string
): Promise<{ exchangeRate: number; sellRate: number; buyRate: number } | null> {
  try {
    const params = new URLSearchParams({
      sellToken,
      buyToken,
      sellAmount,
      chainId: "8453",
    });
    const res = await fetch(`/api/price?${params}`);
    if (!res.ok) return null;
    const data = await res.json();
    const sellRate = parseFloat(data.sellTokenToEthRate || "0");
    const buyRate  = parseFloat(data.buyTokenToEthRate  || "0");
    // Calculate exchange rate: how many buyTokens per 1 sellToken
    // sellAmount is already in raw units, so we divide by its decimals
    // data.buyAmount is also in raw units
    const rate =
      buyRate > 0 && sellRate > 0
        ? sellRate / buyRate
        : 0;
    return { exchangeRate: rate, sellRate, buyRate };
  } catch {
    return null;
  }
}

export function useLimitOrders() {
  const { address, isConnected } = useAccount();
  const { data: walletClient }   = useWalletClient();
  const publicClient             = usePublicClient();

  const [orders, setOrders] = useState<LimitOrder[]>([]);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  /* ── load orders from localStorage on mount ── */
  useEffect(() => {
    if (!address) return;
    try {
      const stored = localStorage.getItem(`cyanic_limit_orders_${address}`);
      if (stored) {
        const parsed: LimitOrder[] = JSON.parse(stored);
        // only keep active orders
        setOrders(parsed.filter(o => o.status === "pending"));
      }
    } catch { /* ignore */ }
  }, [address]);

  /* ── persist orders ── */
  const saveOrders = useCallback((newOrders: LimitOrder[]) => {
    if (!address) return;
    setOrders(newOrders);
    try {
      localStorage.setItem(
        `cyanic_limit_orders_${address}`,
        JSON.stringify(newOrders)
      );
    } catch { /* ignore */ }
  }, [address]);

  /* ── create a new limit order ── */
  const createOrder = useCallback((
    sellToken: Token,
    buyToken: Token,
    sellAmount: string,
    targetPrice: string,
    slippageBps: number,
    expiresInHours: number
  ) => {
    if (!sellAmount || !targetPrice) return;
    const order: LimitOrder = {
      id:           crypto.randomUUID(),
      sellToken,
      buyToken,
      sellAmount,
      targetPrice,
      currentPrice: "0",
      slippageBps,
      status:       "pending",
      createdAt:    Date.now(),
      expiresAt:    Date.now() + expiresInHours * 3_600_000,
    };
    saveOrders([...orders, order]);
    toast.success(`Limit order created: sell ${sellAmount} ${sellToken.symbol} at ${targetPrice} ${buyToken.symbol}`);
    return order.id;
  }, [orders, saveOrders]);

  /* ── cancel an order ── */
  const cancelOrder = useCallback((id: string) => {
    saveOrders(orders.map(o => o.id === id ? { ...o, status: "cancelled" as const } : o)
               .filter(o => o.status === "pending"));
    toast.info("Limit order cancelled");
  }, [orders, saveOrders]);

  /* ── execute swap for a triggered order ── */
  const executeOrder = useCallback(async (order: LimitOrder) => {
    if (!address || !walletClient || !publicClient) return;

    try {
      const sellAmountRaw = parseUnits(order.sellAmount, order.sellToken.decimals).toString();
      const params = new URLSearchParams({
        sellToken:    order.sellToken.address,
        buyToken:     order.buyToken.address,
        sellAmount:   sellAmountRaw,
        slippageBps:  order.slippageBps.toString(),
        taker:        address,
        chainId:      "8453",
      });

      const res = await fetch(`/api/quote?${params}`);
      if (!res.ok) throw new Error("Failed to get quote");
      const quote = await res.json();

      const txData = quote.transaction || {
        to: quote.to, data: quote.data,
        gas: quote.gas, value: quote.value,
      };

      toast.loading(`Executing limit order: ${order.sellAmount} ${order.sellToken.symbol} → ${order.buyToken.symbol}`, {
        id: `limit-${order.id}`
      });

      const txHash = await walletClient.sendTransaction({
        to:    txData.to    as `0x${string}`,
        data:  txData.data  as `0x${string}`,
        value: txData.value ? BigInt(txData.value) : BigInt(0),
        gas:   txData.gas   ? BigInt(txData.gas)   : undefined,
      });

      const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });

      if (receipt.status === "success") {
        toast.success(`✅ Limit order filled! ${order.sellAmount} ${order.sellToken.symbol} → ${order.buyToken.symbol}`, {
          id: `limit-${order.id}`, duration: 6000
        });
        saveOrders(orders.filter(o => o.id !== order.id));
      } else {
        throw new Error("Transaction failed");
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      if (!msg.includes("User rejected")) {
        toast.error(`Limit order execution failed: ${msg}`, { id: `limit-${order.id}` });
      }
      // keep order as pending on failure
    }
  }, [address, walletClient, publicClient, orders, saveOrders]);

  /* ── price monitoring loop ── */
  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (!isConnected || orders.length === 0) return;

    const checkPrices = async () => {
      const now = Date.now();
      const updated = [...orders];
      let changed = false;

      for (let i = 0; i < updated.length; i++) {
        const order = updated[i];
        if (order.status !== "pending") continue;

        // check expiry
        if (now > order.expiresAt) {
          updated[i] = { ...order, status: "expired" };
          toast.info(`Limit order expired: ${order.sellAmount} ${order.sellToken.symbol}`);
          changed = true;
          continue;
        }

        // fetch current price
        try {
          const sellAmountRaw = parseUnits("1", order.sellToken.decimals).toString(); // use 1 unit for rate
          const priceData = await fetchCurrentPrice(
            order.sellToken.address,
            order.buyToken.address,
            sellAmountRaw
          );
          if (!priceData) continue;

          const currentRate = priceData.exchangeRate;
          const targetRate  = parseFloat(order.targetPrice);

          updated[i] = { ...order, currentPrice: currentRate.toFixed(6) };
          changed = true;

          // check if target reached (sell when price >= target)
          if (currentRate >= targetRate) {
            toast.info(`🎯 Limit order triggered! Current: ${currentRate.toFixed(4)} ≥ Target: ${targetRate}`);
            await executeOrder(order);
            return; // re-check will happen on next interval
          }
        } catch { /* ignore individual errors */ }
      }

      if (changed) {
        saveOrders(updated.filter(o => o.status === "pending"));
      }
    };

    checkPrices(); // immediate check
    intervalRef.current = setInterval(checkPrices, PRICE_POLL_INTERVAL);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isConnected, orders, executeOrder, saveOrders]);

  return {
    orders,
    createOrder,
    cancelOrder,
    hasActiveOrders: orders.length > 0,
  };
}

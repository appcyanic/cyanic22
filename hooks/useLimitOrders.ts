"use client";

import { useState, useEffect, useCallback } from "react";
import { useAccount, useWalletClient, usePublicClient } from "wagmi";
import { parseUnits, erc20Abi, maxUint256 } from "viem";
import { toast } from "sonner";
import type { Token } from "@/types/token";

// CoW Protocol order kind
type CowOrderStatus = "pending" | "open" | "filled" | "cancelled" | "expired";

export interface CowLimitOrder {
  id: string;           // CoW order UID
  sellToken: Token;
  buyToken: Token;
  sellAmount: string;   // human-readable
  buyAmount: string;    // human-readable (min receive)
  targetPrice: string;  // 1 sellToken = X buyToken
  status: CowOrderStatus;
  createdAt: number;
  validTo: number;      // unix seconds
  txHash?: string;
}

const COW_API = "https://api.cow.fi/base/api/v1";
const COW_VAULT_RELAYER = "0xC92E8bdf79f0507f65a392b0ab4667716BFE0110" as const;

// EIP-712 domain for CoW Protocol on Base
const COW_DOMAIN = {
  name: "Gnosis Protocol",
  version: "v2",
  chainId: 8453,
  verifyingContract: "0x9008D19f58AAbD9eD0D60971565AA8510560ab41" as `0x${string}`,
} as const;

const ORDER_TYPES = {
  Order: [
    { name: "sellToken",         type: "address" },
    { name: "buyToken",          type: "address" },
    { name: "receiver",          type: "address" },
    { name: "sellAmount",        type: "uint256" },
    { name: "buyAmount",         type: "uint256" },
    { name: "validTo",           type: "uint32"  },
    { name: "appData",           type: "bytes32" },
    { name: "feeAmount",         type: "uint256" },
    { name: "kind",              type: "bytes32" },
    { name: "partiallyFillable", type: "bool"    },
    { name: "sellTokenBalance",  type: "bytes32" },
    { name: "buyTokenBalance",   type: "bytes32" },
  ],
} as const;

// CoW Protocol order kind hashes
const ORDER_KIND_SELL = "0xf3b277728b3fee749481eb3e0b3b48980dbbab78659fc8fd35d39bf3532f2000" as `0x${string}`;
const BALANCE_ERC20   = "0x5a28e9363bb942b639270062aa6bb295f434bcdfc42c97267bf003f272060dc9" as `0x${string}`;
const APP_DATA        = "0x0000000000000000000000000000000000000000000000000000000000000000" as `0x${string}`;

export function useLimitOrders() {
  const { address, isConnected } = useAccount();
  const { data: walletClient }   = useWalletClient();
  const publicClient             = usePublicClient();

  const [orders, setOrders] = useState<CowLimitOrder[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // ── Fetch active orders from CoW API ──────────────────────────────
  const fetchOrders = useCallback(async () => {
    if (!address) return;
    try {
      const res = await fetch(`${COW_API}/account/${address}/orders?limit=20`);
      if (!res.ok) return;
      const data = await res.json();

      // Map CoW API orders to our format — we only track what we created
      const stored = getStoredOrders(address);
      const storedIds = new Set(stored.map(o => o.id));

      const updated: CowLimitOrder[] = data
        .filter((o: { uid: string }) => storedIds.has(o.uid))
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .map((o: any) => {
          const local = stored.find(s => s.id === o.uid)!;
          return {
            ...local,
            status: mapCowStatus(o.status),
            txHash: o.executionDigest ?? local.txHash,
          };
        });

      // Include locally stored orders not yet confirmed by API
      const apiIds = new Set(updated.map(o => o.id));
      const pendingLocal = stored.filter(o => !apiIds.has(o.id) && o.status === "pending");

      const merged = [...updated, ...pendingLocal];
      setOrders(merged);
      saveStoredOrders(address, merged);
    } catch { /* ignore */ }
  }, [address]);

  useEffect(() => {
    fetchOrders();
    const t = setInterval(fetchOrders, 30_000);
    return () => clearInterval(t);
  }, [fetchOrders]);

  // ── Create limit order via CoW Protocol ──────────────────────────
  const createOrder = useCallback(async (
    sellToken: Token,
    buyToken: Token,
    sellAmountHuman: string,
    targetPrice: string,     // 1 sellToken = X buyToken (human)
    expiresInHours: number
  ): Promise<string | undefined> => {
    if (!address || !walletClient || !publicClient) {
      toast.error("Connect wallet to create limit orders");
      return;
    }

    setIsLoading(true);
    const toastId = "cow-limit-order";

    try {
      // Convert to raw amounts
      const sellAmountRaw = parseUnits(sellAmountHuman.replace(",", "."), sellToken.decimals);
      const price          = parseFloat(targetPrice);
      const buyAmountHuman = (parseFloat(sellAmountHuman) * price).toFixed(buyToken.decimals);
      const buyAmountRaw   = parseUnits(buyAmountHuman, buyToken.decimals);

      // validTo = now + hours (CoW uses unix seconds)
      const validTo = Math.floor(Date.now() / 1000) + expiresInHours * 3600;

      // ── Step 1: Approve Vault Relayer ────────────────────────────
      const isNative = sellToken.address.toLowerCase() === "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee";

      if (!isNative) {
        toast.loading("Checking token approval…", { id: toastId });
        const allowance = await publicClient.readContract({
          address: sellToken.address as `0x${string}`,
          abi: erc20Abi,
          functionName: "allowance",
          args: [address, COW_VAULT_RELAYER],
        });

        if ((allowance as bigint) < sellAmountRaw) {
          toast.loading("Approving token for CoW Protocol…", { id: toastId });
          const approveTx = await walletClient.writeContract({
            address: sellToken.address as `0x${string}`,
            abi: erc20Abi,
            functionName: "approve",
            args: [COW_VAULT_RELAYER, maxUint256],
          });
          await publicClient.waitForTransactionReceipt({ hash: approveTx });
          toast.loading("Token approved ✓ Signing order…", { id: toastId });
        }
      }

      // ── Step 2: Sign the order via EIP-712 ──────────────────────
      toast.loading("Sign order in wallet…", { id: toastId });

      const orderMessage = {
        sellToken:         sellToken.address as `0x${string}`,
        buyToken:          buyToken.address  as `0x${string}`,
        receiver:          address,
        sellAmount:        sellAmountRaw,
        buyAmount:         buyAmountRaw,
        validTo:           validTo,
        appData:           APP_DATA,
        feeAmount:         BigInt(0),
        kind:              ORDER_KIND_SELL,
        partiallyFillable: false,
        sellTokenBalance:  BALANCE_ERC20,
        buyTokenBalance:   BALANCE_ERC20,
      };

      const signature = await walletClient.signTypedData({
        domain:      COW_DOMAIN,
        types:       ORDER_TYPES,
        primaryType: "Order",
        message:     orderMessage,
      });

      // ── Step 3: Post order to CoW API ───────────────────────────
      toast.loading("Submitting to CoW Protocol…", { id: toastId });

      const orderPayload = {
        sellToken:         sellToken.address.toLowerCase(),
        buyToken:          buyToken.address.toLowerCase(),
        receiver:          address.toLowerCase(),
        sellAmount:        sellAmountRaw.toString(),
        buyAmount:         buyAmountRaw.toString(),
        validTo,
        appData:           APP_DATA,
        feeAmount:         "0",
        kind:              "sell",
        partiallyFillable: false,
        sellTokenBalance:  "erc20",
        buyTokenBalance:   "erc20",
        signingScheme:     "eip712",
        signature,
        from:              address.toLowerCase(),
      };

      const res = await fetch(`${COW_API}/orders`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(orderPayload),
      });

      const body = await res.json();

      if (!res.ok) {
        throw new Error(body.description || body.errorType || "Failed to submit order");
      }

      const orderId: string = body; // CoW returns the UID as a plain string

      // ── Step 4: Save locally ─────────────────────────────────────
      const newOrder: CowLimitOrder = {
        id:          orderId,
        sellToken,
        buyToken,
        sellAmount:  sellAmountHuman,
        buyAmount:   buyAmountHuman,
        targetPrice,
        status:      "pending",
        createdAt:   Date.now(),
        validTo:     validTo * 1000,
      };

      const existing = getStoredOrders(address);
      const updated  = [newOrder, ...existing];
      saveStoredOrders(address, updated);
      setOrders(updated);

      toast.success(
        `✅ Limit order created! Will execute when 1 ${sellToken.symbol} ≥ ${targetPrice} ${buyToken.symbol}`,
        { id: toastId, duration: 6000 }
      );

      return orderId;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      if (!msg.toLowerCase().includes("rejected") && !msg.toLowerCase().includes("denied")) {
        toast.error(`Failed to create order: ${msg}`, { id: toastId });
      } else {
        toast.dismiss(toastId);
      }
    } finally {
      setIsLoading(false);
    }
  }, [address, walletClient, publicClient]);

  // ── Cancel order via CoW API ──────────────────────────────────────
  const cancelOrder = useCallback(async (orderId: string) => {
    if (!address || !walletClient) return;

    try {
      // Sign cancellation
      const cancellationMessage = { orderUid: orderId as `0x${string}` };
      const cancellationTypes = {
        OrderCancellations: [{ name: "orderUid", type: "bytes" }],
      };

      const signature = await walletClient.signTypedData({
        domain:      COW_DOMAIN,
        types:       cancellationTypes,
        primaryType: "OrderCancellations",
        message:     cancellationMessage,
      });

      const res = await fetch(`${COW_API}/orders/${orderId}`, {
        method:  "DELETE",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ signature, signingScheme: "eip712" }),
      });

      if (res.ok || res.status === 200) {
        const updated = getStoredOrders(address).map(o =>
          o.id === orderId ? { ...o, status: "cancelled" as const } : o
        );
        saveStoredOrders(address, updated);
        setOrders(updated.filter(o => o.status !== "cancelled"));
        toast.success("Order cancelled");
      } else {
        // Remove locally even if API fails
        const updated = getStoredOrders(address).filter(o => o.id !== orderId);
        saveStoredOrders(address, updated);
        setOrders(updated);
        toast.info("Order removed");
      }
    } catch {
      toast.error("Failed to cancel order");
    }
  }, [address, walletClient]);

  const activeOrders = orders.filter(o => o.status === "pending" || o.status === "open");

  return {
    orders: activeOrders,
    allOrders: orders,
    createOrder,
    cancelOrder,
    isLoading,
    hasActiveOrders: activeOrders.length > 0,
    refetch: fetchOrders,
  };
}

// ── Helpers ──────────────────────────────────────────────────────────

function mapCowStatus(s: string): CowOrderStatus {
  if (s === "fulfilled") return "filled";
  if (s === "cancelled") return "cancelled";
  if (s === "expired")   return "expired";
  if (s === "open")      return "open";
  return "pending";
}

function getStoredOrders(address: string): CowLimitOrder[] {
  try {
    const raw = localStorage.getItem(`cyanic_cow_orders_${address.toLowerCase()}`);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveStoredOrders(address: string, orders: CowLimitOrder[]) {
  try {
    localStorage.setItem(
      `cyanic_cow_orders_${address.toLowerCase()}`,
      JSON.stringify(orders.slice(0, 50)) // keep last 50
    );
  } catch { /* ignore */ }
}

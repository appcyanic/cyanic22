"use client";

import { useState, useEffect, useCallback } from "react";
import { useAccount, useWalletClient, usePublicClient } from "wagmi";
import { parseUnits, erc20Abi, maxUint256, getAddress } from "viem";
import { toast } from "sonner";
import { OrderBookApi, SupportedChainId, SigningScheme } from "@cowprotocol/cow-sdk";
import type { Token } from "@/types/token";

type CowOrderStatus = "pending" | "open" | "filled" | "cancelled" | "expired";

export interface CowLimitOrder {
  id: string;
  sellToken: Token;
  buyToken: Token;
  sellAmount: string;
  buyAmount: string;
  targetPrice: string;
  status: CowOrderStatus;
  createdAt: number;
  validTo: number;      // unix ms
  txHash?: string;
}

const CHAIN_ID         = SupportedChainId.BASE;
const COW_VAULT_RELAYER = "0xC92E8bdf79f0507f65a392b0ab4667716BFE0110" as const;

// Singleton OrderBookApi
const orderBookApi = new OrderBookApi({ chainId: CHAIN_ID });

export function useLimitOrders() {
  const { address, isConnected } = useAccount();
  const { data: walletClient }   = useWalletClient();
  const publicClient             = usePublicClient();

  const [orders,    setOrders]    = useState<CowLimitOrder[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // ── Fetch order statuses from CoW API ────────────────────────────
  const fetchOrders = useCallback(async () => {
    if (!address) return;
    const stored = getStoredOrders(address);
    if (stored.length === 0) return;

    try {
      const updated = await Promise.all(
        stored.map(async (local) => {
          try {
            const cowOrder = await orderBookApi.getOrder(local.id);
            return {
              ...local,
              status:  mapCowStatus(cowOrder.status),
              txHash:  (cowOrder as { executionDigest?: string }).executionDigest ?? local.txHash,
            };
          } catch {
            return local;
          }
        })
      );
      setOrders(updated);
      saveStoredOrders(address, updated);
    } catch { /* ignore */ }
  }, [address]);

  useEffect(() => {
    if (!address) { setOrders([]); return; }
    const stored = getStoredOrders(address);
    setOrders(stored);
    fetchOrders();
    const t = setInterval(fetchOrders, 30_000);
    return () => clearInterval(t);
  }, [address, fetchOrders]);

  // ── Create limit order ───────────────────────────────────────────
  const createOrder = useCallback(async (
    sellToken: Token,
    buyToken: Token,
    sellAmountHuman: string,
    targetPrice: string,
    expiresInHours: number
  ): Promise<string | undefined> => {
    if (!address || !walletClient || !publicClient) {
      toast.error("Connect wallet to create limit orders");
      return;
    }

    setIsLoading(true);
    const toastId = "cow-limit-order";

    try {
      const sellAmountRaw  = parseUnits(sellAmountHuman.replace(",", "."), sellToken.decimals);
      const price          = parseFloat(targetPrice);
      const buyAmountHuman = (parseFloat(sellAmountHuman) * price).toFixed(buyToken.decimals);
      const buyAmountRaw   = parseUnits(buyAmountHuman, buyToken.decimals);
      const validTo        = Math.floor(Date.now() / 1000) + expiresInHours * 3600;

      // ── ERC-20 approval ────────────────────────────────────────
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
          toast.loading("Approving token…", { id: toastId });
          const approveTx = await walletClient.writeContract({
            address: sellToken.address as `0x${string}`,
            abi: erc20Abi,
            functionName: "approve",
            args: [COW_VAULT_RELAYER, maxUint256],
          });
          await publicClient.waitForTransactionReceipt({ hash: approveTx });
        }
      }

      // ── Build order struct ─────────────────────────────────────
      // Use checksummed addresses everywhere for consistent EIP-712 hashing
      const sellTokenAddr = getAddress(sellToken.address);
      const buyTokenAddr  = getAddress(buyToken.address);

      const order = {
        sellToken:         sellTokenAddr,
        buyToken:          buyTokenAddr,
        sellAmount:        sellAmountRaw.toString(),
        buyAmount:         buyAmountRaw.toString(),
        validTo,
        appData:           "0x0000000000000000000000000000000000000000000000000000000000000000",
        feeAmount:         "0",
        kind:              "sell" as const,
        receiver:          getAddress(address),
        partiallyFillable: false,
        sellTokenBalance:  "erc20" as const,
        buyTokenBalance:   "erc20" as const,
      };

      // ── Sign using EIP-712 signTypedData ───────────────────────
      toast.loading("Sign order in wallet…", { id: toastId });

      // Hardcode CoW Protocol domain for Base — avoids async RPC call
      const cowDomain = {
        name:              "Gnosis Protocol",
        version:           "v2",
        chainId:           8453,
        verifyingContract: "0x9008D19f58AAbD9eD0D60971565AA8510560ab41" as `0x${string}`,
      };

      const cowTypes = {
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

      const signature = await walletClient.signTypedData({
        domain:      cowDomain,
        types:       cowTypes,
        primaryType: "Order",
        message: {
          sellToken:         order.sellToken as `0x${string}`,
          buyToken:          order.buyToken  as `0x${string}`,
          receiver:          getAddress(order.receiver),
          sellAmount:        BigInt(order.sellAmount),
          buyAmount:         BigInt(order.buyAmount),
          validTo:           order.validTo,
          appData:           order.appData as `0x${string}`,
          feeAmount:         BigInt(0),
          kind:              "0xf3b277728b3fee749481eb3e0b3b48980dbbab78659fc8fd35d39bf3532f2000" as `0x${string}`,
          partiallyFillable: false,
          sellTokenBalance:  "0x5a28e9363bb942b639270062aa6bb295f434bcdfc42c97267bf003f272060dc9" as `0x${string}`,
          buyTokenBalance:   "0x5a28e9363bb942b639270062aa6bb295f434bcdfc42c97267bf003f272060dc9" as `0x${string}`,
        },
      });

      // ── Submit to CoW API ──────────────────────────────────────
      toast.loading("Submitting to CoW Protocol…", { id: toastId });

      const sendRes = await orderBookApi.sendOrder({
        ...order,
        signingScheme: SigningScheme.EIP712,
        signature,
        from: getAddress(address),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any).catch(async (e: unknown) => {
        console.error("CoW sendOrder full error:", JSON.stringify(e, Object.getOwnPropertyNames(e as object)));
        const errObj = e as Record<string, unknown>;
        console.error("CoW error keys:", Object.getOwnPropertyNames(e as object));
        console.error("CoW error body:", errObj?.body);
        console.error("CoW error message:", errObj?.message);
        console.error("CoW error responseBody:", errObj?.responseBody);
        throw e;
      });

      const orderId: string = sendRes;

      // ── Save locally ───────────────────────────────────────────
      const newOrder: CowLimitOrder = {
        id:          orderId,
        sellToken,
        buyToken,
        sellAmount:  sellAmountHuman,
        buyAmount:   buyAmountHuman,
        targetPrice,
        status:      "open",
        createdAt:   Date.now(),
        validTo:     validTo * 1000,
      };

      const updated = [newOrder, ...getStoredOrders(address)];
      saveStoredOrders(address, updated);
      setOrders(updated);

      toast.success(
        `✅ Limit order live! CoW Protocol will execute when 1 ${sellToken.symbol} ≥ ${targetPrice} ${buyToken.symbol}`,
        { id: toastId, duration: 6000 }
      );

      return orderId;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (!msg.toLowerCase().includes("rejected") && !msg.toLowerCase().includes("denied")) {
        toast.error(`Order failed: ${msg.slice(0, 120)}`, { id: toastId });
      } else {
        toast.dismiss(toastId);
      }
    } finally {
      setIsLoading(false);
    }
  }, [address, walletClient, publicClient]);

  // ── Cancel order ─────────────────────────────────────────────────
  const cancelOrder = useCallback(async (orderId: string) => {
    if (!address || !walletClient) return;
    try {
      const types  = {
        OrderCancellations: [{ name: "orderUids", type: "bytes[]" }],
      };

      const signature = await walletClient.signTypedData({
        domain: {
          name:              "Gnosis Protocol",
          version:           "v2",
          chainId:           8453,
          verifyingContract: "0x9008D19f58AAbD9eD0D60971565AA8510560ab41" as `0x${string}`,
        },
        types,
        primaryType: "OrderCancellations",
        message:     { orderUids: [orderId as `0x${string}`] },
      });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (orderBookApi as any).sendSignedOrderCancellations({
        orderUids: [orderId],
        signature,
        signingScheme: SigningScheme.EIP712,
      });

      const updated = getStoredOrders(address).filter(o => o.id !== orderId);
      saveStoredOrders(address, updated);
      setOrders(updated);
      toast.success("Order cancelled");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      if (!msg.includes("rejected")) toast.error("Cancel failed");
      // Remove locally anyway
      const updated = getStoredOrders(address).filter(o => o.id !== orderId);
      saveStoredOrders(address, updated);
      setOrders(updated);
    }
  }, [address, walletClient]);

  const activeOrders = orders.filter(o => o.status === "open" || o.status === "pending");

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
      JSON.stringify(orders.slice(0, 50))
    );
  } catch { /* ignore */ }
}

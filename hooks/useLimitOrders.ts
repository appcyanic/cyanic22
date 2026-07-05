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
  validTo: number;
  txHash?: string;
}

const CHAIN_ID          = SupportedChainId.BASE;
const COW_VAULT_RELAYER = "0xC92E8bdf79f0507f65a392b0ab4667716BFE0110" as const;
const NATIVE_ETH        = "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee";
const WETH_BASE         = "0x4200000000000000000000000000000000000006";

const COW_DOMAIN = {
  name:              "Gnosis Protocol",
  version:           "v2",
  chainId:           8453,
  verifyingContract: "0x9008D19f58AAbD9eD0D60971565AA8510560ab41" as `0x${string}`,
} as const;

const COW_ORDER_TYPES = {
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

// keccak256("sell")
const KIND_SELL   = "0xf3b277728b3fee749481eb3e0b3b48980dbbab78659fc8fd35d39bf3532f2000" as `0x${string}`;
// keccak256("erc20")
const BAL_ERC20   = "0x5a28e9363bb942b639270062aa6bb295f434bcdfc42c97267bf003f272060dc9" as `0x${string}`;

const orderBookApi = new OrderBookApi({ chainId: CHAIN_ID });

export function useLimitOrders() {
  const { address, isConnected } = useAccount();
  const { data: walletClient }   = useWalletClient();
  const publicClient             = usePublicClient();

  const [orders,    setOrders]    = useState<CowLimitOrder[]>([]);
  const [isLoading, setIsLoading] = useState(false);

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
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              txHash:  (cowOrder as any).executionDigest ?? local.txHash,
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
    setOrders(getStoredOrders(address));
    fetchOrders();
    const t = setInterval(fetchOrders, 30_000);
    return () => clearInterval(t);
  }, [address, fetchOrders]);

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

    // CoW Protocol doesn't support native ETH
    if (sellToken.address.toLowerCase() === NATIVE_ETH) {
      toast.error("Use WETH instead of ETH for limit orders (CoW Protocol requires ERC-20 tokens).");
      return;
    }

    setIsLoading(true);
    const toastId = "cow-limit-order";

    try {
      // ── Resolve addresses (checksum) ───────────────────────────
      const sellAddr = getAddress(
        sellToken.address.toLowerCase() === NATIVE_ETH ? WETH_BASE : sellToken.address
      );
      const buyAddr  = getAddress(
        buyToken.address.toLowerCase()  === NATIVE_ETH ? WETH_BASE : buyToken.address
      );

      const sellAmountRaw  = parseUnits(sellAmountHuman.replace(",", "."), sellToken.decimals);
      const price          = parseFloat(targetPrice);
      const buyAmountHuman = (parseFloat(sellAmountHuman) * price).toFixed(buyToken.decimals);
      const buyAmountRaw   = parseUnits(buyAmountHuman, buyToken.decimals);
      const validTo        = Math.floor(Date.now() / 1000) + expiresInHours * 3600;

      // ── Token approval ─────────────────────────────────────────
      toast.loading("Checking token approval…", { id: toastId });
      const allowance = await publicClient.readContract({
        address:      sellAddr,
        abi:          erc20Abi,
        functionName: "allowance",
        args:         [address, COW_VAULT_RELAYER],
      });

      if ((allowance as bigint) < sellAmountRaw) {
        toast.loading("Approving token…", { id: toastId });
        const approveTx = await walletClient.writeContract({
          address:      sellAddr,
          abi:          erc20Abi,
          functionName: "approve",
          args:         [COW_VAULT_RELAYER, maxUint256],
        });
        await publicClient.waitForTransactionReceipt({ hash: approveTx });
      }

      // ── Sign order via EIP-712 ─────────────────────────────────
      toast.loading("Sign order in wallet…", { id: toastId });

      const signature = await walletClient.signTypedData({
        domain:      COW_DOMAIN,
        types:       COW_ORDER_TYPES,
        primaryType: "Order",
        message: {
          sellToken:         sellAddr,
          buyToken:          buyAddr,
          receiver:          getAddress(address),
          sellAmount:        sellAmountRaw,
          buyAmount:         buyAmountRaw,
          validTo:           validTo,
          appData:           "0x0000000000000000000000000000000000000000000000000000000000000000" as `0x${string}`,
          feeAmount:         BigInt(0),
          kind:              KIND_SELL,
          partiallyFillable: false,
          sellTokenBalance:  BAL_ERC20,
          buyTokenBalance:   BAL_ERC20,
        },
      });

      // ── Submit to CoW API ──────────────────────────────────────
      toast.loading("Submitting to CoW Protocol…", { id: toastId });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const orderId: string = await orderBookApi.sendOrder({
        sellToken:         sellAddr.toLowerCase(),
        buyToken:          buyAddr.toLowerCase(),
        receiver:          getAddress(address),
        sellAmount:        sellAmountRaw.toString(),
        buyAmount:         buyAmountRaw.toString(),
        validTo,
        appData:           "0x0000000000000000000000000000000000000000000000000000000000000000",
        feeAmount:         "0",
        kind:              "sell",
        partiallyFillable: false,
        sellTokenBalance:  "erc20",
        buyTokenBalance:   "erc20",
        signingScheme:     SigningScheme.EIP712,
        signature,
        from:              getAddress(address),
      } as any);

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
        `✅ Limit order live! Executes when 1 ${sellToken.symbol} ≥ ${targetPrice} ${buyToken.symbol}`,
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

  const cancelOrder = useCallback(async (orderId: string) => {
    if (!address || !walletClient) return;
    try {
      const signature = await walletClient.signTypedData({
        domain:      COW_DOMAIN,
        types:       { OrderCancellations: [{ name: "orderUids", type: "bytes[]" }] },
        primaryType: "OrderCancellations",
        message:     { orderUids: [orderId as `0x${string}`] },
      });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (orderBookApi as any).sendSignedOrderCancellations({
        orderUids:     [orderId],
        signature,
        signingScheme: SigningScheme.EIP712,
      });
    } catch { /* ignore cancel API errors */ }

    const updated = getStoredOrders(address).filter(o => o.id !== orderId);
    saveStoredOrders(address, updated);
    setOrders(updated);
    toast.success("Order cancelled");
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

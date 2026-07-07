"use client";

import { useState, useEffect } from "react";
import { useAccount, useWalletClient, usePublicClient, useBalance, useReadContract } from "wagmi";
import { parseUnits, formatUnits, erc20Abi } from "viem";import { toast } from "sonner";
import { ArrowUpDown, Loader2, History, AlertTriangle, ArrowLeftRight, Lock, ChevronDown } from "lucide-react";
import type { Route } from "@lifi/sdk";
import { getStepTransaction } from "@lifi/sdk";
import { motion, AnimatePresence } from "framer-motion";
import { ChainSelector }     from "./ChainSelector";
import { RouteList }         from "./RouteList";
import { BridgeProgress }    from "./BridgeProgress";
import { BridgeHistory }     from "./BridgeHistory";
import { ConnectButton }     from "@/components/ui/ConnectButton";
import { TokenLogo }         from "@/components/ui/TokenLogo";
import { useBridgeRoutes }   from "@/hooks/useBridgeRoutes";
import { saveBridgeHistory } from "@/lib/bridgeHistory";
import { initLifi, getLifiClient } from "@/lib/lifi";
import { SUPPORTED_CHAINS }  from "@/lib/bridgeChains";
import { DATA_SUFFIX } from "@/lib/wagmi";
import type { TransferStatus } from "@/types/bridge";

const ETH_ADDRESS = "0x0000000000000000000000000000000000000000";

const CHAIN_TOKENS: Record<number, { address: string; symbol: string; decimals: number; logoURI?: string }[]> = {
  1:      [
    { address: ETH_ADDRESS,  symbol: "ETH",  decimals: 18, logoURI: "https://assets.coingecko.com/coins/images/279/large/ethereum.png" },
    { address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", symbol: "USDC", decimals: 6,  logoURI: "https://assets.coingecko.com/coins/images/6319/large/usdc.png" },
  ],
  8453:   [
    { address: ETH_ADDRESS,  symbol: "ETH",  decimals: 18, logoURI: "https://assets.coingecko.com/coins/images/279/large/ethereum.png" },
    { address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", symbol: "USDC", decimals: 6,  logoURI: "https://assets.coingecko.com/coins/images/6319/large/usdc.png" },
  ],
  42161:  [
    { address: ETH_ADDRESS,  symbol: "ETH",  decimals: 18, logoURI: "https://assets.coingecko.com/coins/images/279/large/ethereum.png" },
    { address: "0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8", symbol: "USDC", decimals: 6,  logoURI: "https://assets.coingecko.com/coins/images/6319/large/usdc.png" },
  ],
  10:     [
    { address: ETH_ADDRESS,  symbol: "ETH",  decimals: 18, logoURI: "https://assets.coingecko.com/coins/images/279/large/ethereum.png" },
    { address: "0x7F5c764cBc14f9669B88837ca1490cCa17c31607", symbol: "USDC", decimals: 6,  logoURI: "https://assets.coingecko.com/coins/images/6319/large/usdc.png" },
  ],
  137:    [
    { address: "0x0000000000000000000000000000000000001010", symbol: "MATIC", decimals: 18, logoURI: "https://assets.coingecko.com/coins/images/4713/large/polygon.png" },
    { address: "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174", symbol: "USDC",  decimals: 6,  logoURI: "https://assets.coingecko.com/coins/images/6319/large/usdc.png" },
  ],
  56:     [
    { address: ETH_ADDRESS,  symbol: "BNB",  decimals: 18, logoURI: "https://assets.coingecko.com/coins/images/825/large/bnb-icon2_2x.png" },
    { address: "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d", symbol: "USDC",  decimals: 18, logoURI: "https://assets.coingecko.com/coins/images/6319/large/usdc.png" },
  ],
  43114:  [
    { address: ETH_ADDRESS,  symbol: "AVAX", decimals: 18, logoURI: "https://assets.coingecko.com/coins/images/12559/large/Avalanche_Circle_RedWhite_Trans.png" },
    { address: "0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E", symbol: "USDC",  decimals: 6,  logoURI: "https://assets.coingecko.com/coins/images/6319/large/usdc.png" },
  ],
  59144:  [{ address: ETH_ADDRESS, symbol: "ETH",  decimals: 18, logoURI: "https://assets.coingecko.com/coins/images/279/large/ethereum.png" }],
  534352: [{ address: ETH_ADDRESS, symbol: "ETH",  decimals: 18, logoURI: "https://assets.coingecko.com/coins/images/279/large/ethereum.png" }],
};

// ── Chain logo helper ────────────────────────────────────────────────
function ChainBadge({ chainId, size = 20 }: { chainId: number; size?: number }) {
  const [err, setErr] = useState(false);
  const chain = SUPPORTED_CHAINS.find(c => c.id === chainId);
  if (!chain) return null;
  if (chain.logoURI && !err) {
    return (
      <img src={chain.logoURI} alt={chain.name} width={size} height={size}
           className="rounded-full object-cover flex-shrink-0"
           style={{ width: size, height: size }}
           onError={() => setErr(true)} />
    );
  }
  return <span style={{ fontSize: size * 0.7 }}>{chain.icon}</span>;
}

export function BridgeCard() {
  const { address, isConnected } = useAccount();
  const { data: walletClient }   = useWalletClient();
  const publicClient             = usePublicClient();

  const [fromChain,     setFromChain]     = useState(1);
  const [toChain,       setToChain]       = useState(8453);
  const [fromToken,     setFromToken]     = useState(ETH_ADDRESS);
  const [toToken,       setToToken]       = useState(ETH_ADDRESS);
  const [fromDecimals,  setFromDecimals]  = useState(18);
  const [amount,        setAmount]        = useState("");
  const [selectedRoute, setSelectedRoute] = useState<Route | null>(null);
  const [status,        setStatus]        = useState<TransferStatus>("idle");
  const [txHash,        setTxHash]        = useState<string | null>(null);
  const [error,         setError]         = useState<string | null>(null);
  const [recordId,      setRecordId]      = useState<string | undefined>();
  const [showHistory,   setShowHistory]   = useState(false);
  const [showFromChain, setShowFromChain] = useState(false);
  const [showToChain,   setShowToChain]   = useState(false);

  // ── Balance (after state declarations) ───────────────────────────
  const isNativeFrom = fromToken === ETH_ADDRESS;
  const { data: nativeBalance } = useBalance({
    address,
    chainId: fromChain,
    query: { enabled: !!address && isNativeFrom, refetchInterval: 10_000 },
  });
  const { data: erc20Balance } = useReadContract({
    address: fromToken as `0x${string}`,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    chainId: fromChain,
    query: { enabled: !!address && !isNativeFrom && fromToken !== ETH_ADDRESS, refetchInterval: 10_000 },
  });

  const balanceRaw: bigint = isNativeFrom
    ? (nativeBalance?.value ?? BigInt(0))
    : ((erc20Balance as bigint) ?? BigInt(0));

  const balanceFormatted = balanceRaw > 0n
    ? Number(formatUnits(balanceRaw, fromDecimals)).toFixed(6)
    : "0";

  useEffect(() => { initLifi(); }, []);

  useEffect(() => {
    const t = CHAIN_TOKENS[fromChain]?.[0];
    if (t) { setFromToken(t.address); setFromDecimals(t.decimals); }
  }, [fromChain]);

  useEffect(() => {
    const t = CHAIN_TOKENS[toChain]?.[0];
    if (t) setToToken(t.address);
  }, [toChain]);

  const fromAmountWei = (() => {
    try {
      const n = amount.replace(/,/g, ".");
      if (!n || parseFloat(n) <= 0) return null;
      return parseUnits(n, fromDecimals).toString();
    } catch { return null; }
  })();

  const { routes, isLoading: loadingRoutes, error: routeError } = useBridgeRoutes(
    address && fromAmountWei
      ? { fromChainId: fromChain, toChainId: toChain, fromTokenAddress: fromToken,
          toTokenAddress: toToken, fromAmount: fromAmountWei, fromAddress: address }
      : null
  );

  useEffect(() => {
    setSelectedRoute(routes.length > 0 ? routes[0] : null);
  }, [routes]);

  const swapChains = () => {
    const [fc, tc, ft, tt] = [fromChain, toChain, fromToken, toToken];
    setFromChain(tc); setToChain(fc);
    setFromToken(tt); setToToken(ft);
    setSelectedRoute(null); setAmount("");
  };

  const handleBridge = async () => {
    if (!selectedRoute || !walletClient || !address || !publicClient) return;
    const routeUsd = selectedRoute.fromAmountUSD
      ? parseFloat(selectedRoute.fromAmountUSD as string)
      : parseFloat(amount.replace(",", ".")) * 2000; // conservative fallback
    if (routeUsd > 10_000) {
      if (!confirm(`Large transfer ~$${routeUsd.toLocaleString(undefined, { maximumFractionDigits: 0 })}. Confirm?`)) return;
    }
    setStatus("approving"); setError(null); setTxHash(null);
    try {
      if (fromToken !== ETH_ADDRESS && fromAmountWei) {
        const spender = selectedRoute.steps[0]?.estimate?.approvalAddress as `0x${string}` | undefined;
        if (spender) {
          const allowance = await publicClient.readContract({
            address: fromToken as `0x${string}`, abi: erc20Abi,
            functionName: "allowance", args: [address, spender],
          });
          if ((allowance as bigint) < BigInt(fromAmountWei)) {
            toast.loading("Approving…", { id: "bridge-approve" });
            const tx = await walletClient.writeContract({
              address: fromToken as `0x${string}`, abi: erc20Abi,
              functionName: "approve", args: [spender, BigInt(fromAmountWei)],
            });
            await publicClient.waitForTransactionReceipt({ hash: tx });
            toast.success("Approved!", { id: "bridge-approve", duration: 2000 });
          }
        }
      }
      setStatus("sending");

      // Execute each step manually with wagmi — no provider needed
      let lastTx: `0x${string}` | null = null;
      for (const step of selectedRoute.steps) {
        // Use transactionRequest from route if available, otherwise fetch separately
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const stepAny = step as any;
        let tx = stepAny.transactionRequest as Record<string, unknown> | undefined;

        if (!tx || !tx.to) {
          // Inject wallet address and fetch transaction data
          const stepWithAddress = {
            ...step,
            action: { ...step.action, fromAddress: address },
          };
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const populated = await getStepTransaction(getLifiClient(), stepWithAddress as any);
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          tx = (populated as any).transactionRequest as Record<string, unknown> | undefined;
        }

        if (!tx || !tx.to) throw new Error("No transaction data returned");

        const hash = await walletClient.sendTransaction({
          account: address,
          to:      tx.to    as `0x${string}`,
          data:    tx.data  ? ((tx.data as string) + DATA_SUFFIX.slice(2)) as `0x${string}` : DATA_SUFFIX as `0x${string}`,
          value:   tx.value ? BigInt(String(tx.value)) : BigInt(0),
          chainId: fromChain,
        });
        lastTx = hash;
        setTxHash(hash);
        setStatus("pending");
        toast.loading("Bridge in progress…", { id: "bridge-tx" });
        await publicClient!.waitForTransactionReceipt({ hash });
        toast.dismiss("bridge-tx");
      }

      setStatus("done");
      const rec = saveBridgeHistory({
        txHash: lastTx ?? "",
        fromChain, toChain,
        fromToken: CHAIN_TOKENS[fromChain]?.[0]?.symbol ?? "ETH",
        toToken:   CHAIN_TOKENS[toChain]?.[0]?.symbol   ?? "ETH",
        fromAmount: amount,
        toAmount: formatUnits(BigInt(selectedRoute.toAmountMin ?? "0"), selectedRoute.toToken.decimals),
        bridge: selectedRoute.steps[0]?.tool ?? "unknown",
        timestamp: Date.now(), status: "pending",
      });
      setRecordId(rec.id);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      setStatus("failed");
      setError(msg.includes("rejected") || msg.includes("denied") ? "Transaction cancelled" : msg.slice(0, 120));
    }
  };

  const reset = () => {
    setStatus("idle"); setTxHash(null); setError(null);
    setAmount(""); setSelectedRoute(null); setRecordId(undefined);
  };

  if (status !== "idle") {
    return <BridgeProgress status={status} txHash={txHash} fromChain={fromChain}
      toChain={toChain} route={selectedRoute} error={error} recordId={recordId} onReset={reset} />;
  }
  if (showHistory) return <BridgeHistory onClose={() => setShowHistory(false)} />;

  const toAmtDisplay = selectedRoute
    ? Number(formatUnits(BigInt(selectedRoute.toAmountMin ?? "0"), selectedRoute.toToken.decimals)).toFixed(6)
    : "";
  const fromTokenInfo = CHAIN_TOKENS[fromChain]?.find(t => t.address === fromToken);
  const toTokenInfo   = CHAIN_TOKENS[toChain]?.find(t => t.address === toToken);
  const fromChainInfo = SUPPORTED_CHAINS.find(c => c.id === fromChain);
  const toChainInfo   = SUPPORTED_CHAINS.find(c => c.id === toChain);

  return (
    <div className="glass-card overflow-hidden w-full">
      {/* ── Header ── */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-border">
        <div className="flex items-center gap-2">
          <ArrowLeftRight className="w-4 h-4 text-base-blue" />
          <span className="font-semibold text-text-primary">Bridge</span>
        </div>
        <button onClick={() => setShowHistory(true)}
          className="flex items-center gap-1.5 text-xs text-text-muted hover:text-text-primary transition-colors px-2 py-1.5 rounded-lg hover:bg-bg-tertiary">
          <History className="w-3.5 h-3.5" />
          History
        </button>
      </div>

      <div className="p-5 space-y-3">

        {/* ── FROM ── */}
        <div className="rounded-2xl border border-border bg-bg-tertiary overflow-hidden">
          {/* Chain row */}
          <button onClick={() => { setShowFromChain(true); }}
            className="w-full flex items-center gap-2.5 px-4 pt-3 pb-2 hover:bg-bg-secondary/50 transition-colors">
            <ChainBadge chainId={fromChain} size={18} />
            <span className="text-xs font-semibold text-text-secondary">{fromChainInfo?.name}</span>
            <ChevronDown className="w-3 h-3 text-text-muted ml-auto" />
          </button>          {/* Amount row */}
          <div className="flex items-center gap-3 px-4 pb-2">
            <input
              type="number" placeholder="0.00" min="0"
              value={amount}
              onChange={e => setAmount(e.target.value.replace(/,/g, "."))}
              className="flex-1 bg-transparent text-2xl font-bold text-text-primary
                         placeholder:text-text-muted outline-none min-w-0 tabular-nums"
            />
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-bg-secondary border border-border flex-shrink-0">
              <TokenLogo symbol={fromTokenInfo?.symbol} logoURI={fromTokenInfo?.logoURI} size={18} />
              <span className="font-semibold text-sm text-text-primary">{fromTokenInfo?.symbol}</span>
            </div>
          </div>
          {/* Balance + pct buttons */}
          {isConnected && (
            <div className="flex items-center gap-1.5 px-4 pb-3">
              <span className="text-xs text-text-muted font-mono flex-1">
                {balanceFormatted} {fromTokenInfo?.symbol}
              </span>
              {[25, 50, 75, 100].map(pct => (
                <button
                  key={pct}
                  onClick={() => {
                    const val = Number(formatUnits(balanceRaw, fromDecimals)) * pct / 100;
                    setAmount(val.toFixed(6));
                  }}
                  className="text-xs text-base-blue hover:text-base-blue-light font-semibold px-1.5 py-1 rounded-lg hover:bg-base-blue/10 transition-all"
                >
                  {pct === 100 ? "MAX" : `${pct}%`}
                </button>
              ))}
            </div>
          )}
          {/* USD estimate */}
          {amount && parseFloat(amount.replace(",", ".")) > 0 && (
            <div className="px-4 pb-3 text-xs text-text-muted">
              {selectedRoute?.fromAmountUSD
                ? `≈ $${parseFloat(selectedRoute.fromAmountUSD as string).toFixed(2)} USD`
                : `≈ $${(parseFloat(amount.replace(",", ".")) * 3000).toLocaleString("en", { maximumFractionDigits: 2 })} USD`
              }
            </div>
          )}
        </div>

        {/* ── Swap button ── */}
        <div className="flex justify-center">
          <button onClick={swapChains}
            className="w-9 h-9 rounded-xl border-2 border-bg-primary bg-bg-secondary
                       hover:bg-base-blue/15 hover:border-base-blue/40
                       flex items-center justify-center transition-all group shadow-md">
            <ArrowUpDown className="w-4 h-4 text-text-muted group-hover:text-base-blue transition-colors" />
          </button>
        </div>

        {/* ── TO ── */}
        <div className="rounded-2xl border border-border bg-bg-tertiary overflow-hidden">
          <button onClick={() => setShowToChain(true)}
            className="w-full flex items-center gap-2.5 px-4 pt-3 pb-2 hover:bg-bg-secondary/50 transition-colors">
            <ChainBadge chainId={toChain} size={18} />
            <span className="text-xs font-semibold text-text-secondary">{toChainInfo?.name}</span>
            <ChevronDown className="w-3 h-3 text-text-muted ml-auto" />
          </button>
          <div className="flex items-center gap-3 px-4 pb-3">
            <div className="flex-1 min-w-0">
              {loadingRoutes
                ? <div className="shimmer h-8 w-36 rounded-lg" />
                : <span className="text-2xl font-bold text-text-primary tabular-nums">
                    {toAmtDisplay || "0.00"}
                  </span>
              }
            </div>
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-bg-secondary border border-border flex-shrink-0">
              <TokenLogo symbol={toTokenInfo?.symbol} logoURI={toTokenInfo?.logoURI} size={18} />
              <span className="font-semibold text-sm text-text-primary">{toTokenInfo?.symbol}</span>
            </div>
          </div>
          {toAmtDisplay && !loadingRoutes && (
            <div className="px-4 pb-3 text-xs text-success flex items-center gap-1">
              {selectedRoute?.toAmountUSD
                ? `≈ $${parseFloat(selectedRoute.toAmountUSD as string).toFixed(2)} received`
                : `≈ $${(parseFloat(toAmtDisplay) * 3000).toLocaleString("en", { maximumFractionDigits: 2 })} received`
              }
            </div>
          )}
        </div>

        {/* ── Routes ── */}
        <AnimatePresence>
          {loadingRoutes && amount && parseFloat(amount.replace(",", ".")) > 0 && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="flex items-center gap-2 justify-center py-3 text-sm text-text-muted">
              <Loader2 className="w-4 h-4 animate-spin text-base-blue" />
              Fetching best routes…
            </motion.div>
          )}
          {routes.length > 0 && !loadingRoutes && (
            <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}>
              <RouteList routes={routes} selected={selectedRoute} onSelect={setSelectedRoute} />
            </motion.div>
          )}
        </AnimatePresence>

        {routeError && amount && parseFloat(amount.replace(",", ".")) > 0 && (
          <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-error/10 border border-error/20 text-xs text-error">
            <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
            {routeError}
          </div>
        )}

        {/* ── CTA ── */}
        {!isConnected ? (
          <ConnectButton size="lg" />
        ) : !amount || parseFloat(amount.replace(",", ".")) <= 0 ? (
          <button disabled className="btn-primary w-full py-4 text-sm opacity-40 cursor-not-allowed rounded-xl">
            Enter an amount
          </button>
        ) : loadingRoutes ? (
          <button disabled className="btn-primary w-full py-4 text-sm flex items-center justify-center gap-2 opacity-70 rounded-xl">
            <Loader2 className="w-4 h-4 animate-spin" /> Fetching routes…
          </button>
        ) : !selectedRoute ? (
          <button disabled className="btn-primary w-full py-4 text-sm opacity-40 cursor-not-allowed rounded-xl">
            No routes available
          </button>
        ) : (
          <button onClick={handleBridge}
            className="btn-primary w-full py-4 text-sm font-semibold flex items-center justify-center gap-2 rounded-xl">
            <ArrowLeftRight className="w-4 h-4" />
            Bridge {toAmtDisplay} {toTokenInfo?.symbol}
          </button>
        )}

        {/* ── Security ── */}
        <div className="flex items-center justify-center gap-1.5 text-xs text-text-muted pt-1">
          <Lock className="w-3 h-3" />
          <span>Finite approval · Audited bridges · LI.FI</span>
        </div>
      </div>

      {/* ── Chain selector modals ── */}
      {showFromChain && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowFromChain(false)} />
          <div className="relative w-full max-w-sm glass-card overflow-hidden rounded-t-2xl sm:rounded-2xl">
            <ChainSelector value={fromChain} onChange={id => {
              if (id === toChain) {
                // Auto-swap chains if same selected
                setToChain(fromChain);
              }
              setFromChain(id);
              setShowFromChain(false);
            }} onClose={() => setShowFromChain(false)} />
          </div>
        </div>
      )}
      {showToChain && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowToChain(false)} />
          <div className="relative w-full max-w-sm glass-card overflow-hidden rounded-t-2xl sm:rounded-2xl">
            <ChainSelector value={toChain} onChange={id => {
              if (id === fromChain) {
                // Auto-swap chains if same selected
                setFromChain(toChain);
              }
              setToChain(id);
              setShowToChain(false);
            }} onClose={() => setShowToChain(false)} />
          </div>
        </div>
      )}
    </div>
  );
}

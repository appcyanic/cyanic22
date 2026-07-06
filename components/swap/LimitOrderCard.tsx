"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Target, Plus, Trash2, Clock, Loader2, AlertTriangle,
  TrendingUp, TrendingDown, RefreshCw, CheckCircle2, ExternalLink,
} from "lucide-react";
import { useAccount } from "wagmi";
import { parseUnits, formatUnits } from "viem";
import { toast } from "sonner";
import { ConnectButton } from "@/components/ui/ConnectButton";
import { TokenSelector } from "./TokenSelector";
import { TokenLogo } from "@/components/ui/TokenLogo";
import { useLimitOrders, type CowLimitOrder } from "@/hooks/useLimitOrders";
import { useTokenBalance } from "@/hooks/useTokenBalance";
import { BASE_TOKENS } from "@/lib/tokens";
import type { Token } from "@/types/token";

const EXPIRY_OPTIONS = [
  { label: "1 hour",   value: 1   },
  { label: "12 hours", value: 12  },
  { label: "24 hours", value: 24  },
  { label: "7 days",   value: 168 },
  { label: "30 days",  value: 720 },
];

/* ── Order Row ── */
function OrderRow({ order, onCancel }: { order: CowLimitOrder; onCancel: (id: string) => void }) {
  const isFilled    = order.status === "filled";
  const isCancelled = order.status === "cancelled";
  const isExpired   = order.status === "expired";
  const isActive    = order.status === "open" || order.status === "pending";

  const expiresIn = order.validTo - Date.now();
  const hoursLeft = Math.max(0, Math.floor(expiresIn / 3_600_000));

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -8 }}
      className={`rounded-xl border p-3 ${
        isFilled
          ? "border-success/40 bg-success/5"
          : isExpired || isCancelled
          ? "border-border/40 bg-bg-tertiary/50 opacity-60"
          : "border-border bg-bg-tertiary"
      }`}
    >
      {/* Token pair + amount */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className="flex items-center">
            <TokenLogo symbol={order.sellToken.symbol} logoURI={order.sellToken.logoURI} size={18} />
            <span className="mx-1 text-text-muted text-xs">→</span>
            <TokenLogo symbol={order.buyToken.symbol}  logoURI={order.buyToken.logoURI}  size={18} />
          </div>
          <span className="text-xs font-semibold text-text-primary">
            {order.sellAmount} {order.sellToken.symbol}
          </span>
          <span className={`px-1.5 py-0.5 rounded-full text-xs font-medium ${
            isFilled    ? "bg-success/15 text-success" :
            isExpired   ? "bg-error/15 text-error" :
            isCancelled ? "bg-text-muted/15 text-text-muted" :
                          "bg-base-blue/10 text-base-blue"
          }`}>
            {isFilled ? "Filled" : isExpired ? "Expired" : isCancelled ? "Cancelled" : "Active"}
          </span>
        </div>
        {isActive && (
          <button
            onClick={() => onCancel(order.id)}
            className="p-1 rounded-lg hover:bg-error/10 text-text-muted hover:text-error transition-all"
            title="Cancel order"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
        {isFilled && order.txHash && (
          <a
            href={`https://basescan.org/tx/${order.txHash}`}
            target="_blank" rel="noopener noreferrer"
            className="p-1 rounded-lg hover:bg-success/10 text-success transition-all"
          >
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        )}
      </div>

      {/* Target price */}
      <div className="flex items-center justify-between text-xs mb-2">
        <div className="flex items-center gap-1 text-text-muted">
          <Target className="w-3 h-3" />
          <span>Min receive:</span>
          <span className="font-mono text-text-primary font-semibold">
            {parseFloat(order.buyAmount).toFixed(4)} {order.buyToken.symbol}
          </span>
        </div>
        <div className="flex items-center gap-1 text-text-muted">
          <span>@ {parseFloat(order.targetPrice).toFixed(4)} {order.buyToken.symbol}/{order.sellToken.symbol}</span>
        </div>
      </div>

      {/* Expiry / status */}
      {isActive && (
        <div className="flex items-center gap-1 text-xs text-text-muted">
          <Clock className="w-3 h-3" />
          <span>
            {hoursLeft > 24
              ? `Expires in ${Math.floor(hoursLeft / 24)}d ${hoursLeft % 24}h`
              : `Expires in ${hoursLeft}h`}
          </span>
          <span className="ml-auto flex items-center gap-1 text-success">
            <div className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
            CoW Protocol monitoring
          </span>
        </div>
      )}

      {isFilled && (
        <div className="flex items-center gap-1 text-xs text-success">
          <CheckCircle2 className="w-3 h-3" />
          Order filled by CoW Protocol solver
        </div>
      )}
    </motion.div>
  );
}

/* ── Main Component ── */
export function LimitOrderCard() {
  const { address, isConnected } = useAccount();
  const { orders, createOrder, cancelOrder, isLoading } = useLimitOrders();

  const [sellToken,   setSellToken]   = useState<Token>(BASE_TOKENS.WETH);  const [buyToken,    setBuyToken]    = useState<Token>(BASE_TOKENS.USDC);
  const [sellAmount,  setSellAmount]  = useState("");
  const [targetPrice, setTargetPrice] = useState("");
  const [expiryHours, setExpiryHours] = useState(24);
  const [showForm,    setShowForm]    = useState(true);

  const handleSellTokenChange = (t: Token) => {
    setSellToken(t);
    setSellAmount("");
  };

  const { balanceRaw: sellBalanceRaw, formatted: sellBalanceFormatted } =
    useTokenBalance(sellToken?.address, address, sellToken?.decimals ?? 18);

  // Market price
  const [marketPrice,  setMarketPrice]  = useState<string | null>(null);
  const [priceLoading, setPriceLoading] = useState(false);
  const priceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setMarketPrice(null);
    if (priceTimer.current) clearTimeout(priceTimer.current);
    priceTimer.current = setTimeout(async () => {
      setPriceLoading(true);
      try {
        const oneUnit = parseUnits("1", sellToken.decimals).toString();
        const params  = new URLSearchParams({
          sellToken: sellToken.address, buyToken: buyToken.address,
          sellAmount: oneUnit, chainId: "8453",
        });
        const res  = await fetch(`/api/price?${params}`);
        const data = await res.json();
        if (res.ok) {
          const sr = parseFloat(data.sellTokenToEthRate || "0");
          const br = parseFloat(data.buyTokenToEthRate  || "0");
          if (sr > 0 && br > 0) setMarketPrice((sr / br).toFixed(6));
        }
      } catch { /* ignore */ }
      finally { setPriceLoading(false); }
    }, 600);
    return () => { if (priceTimer.current) clearTimeout(priceTimer.current); };
  }, [sellToken.address, buyToken.address, sellToken.decimals]);

  const handleCreate = async () => {
    if (!sellAmount || !targetPrice || parseFloat(sellAmount) <= 0 || parseFloat(targetPrice) <= 0) return;
    const id = await createOrder(sellToken, buyToken, sellAmount, targetPrice, expiryHours);
    if (id) {
      setSellAmount("");
      setTargetPrice("");
      setShowForm(false);
    }
  };

  const aboveMarket = marketPrice && targetPrice
    ? parseFloat(targetPrice) > parseFloat(marketPrice)
    : null;

  // Estimated receive amount
  const estReceive = sellAmount && targetPrice && parseFloat(sellAmount) > 0 && parseFloat(targetPrice) > 0
    ? (parseFloat(sellAmount) * parseFloat(targetPrice)).toFixed(4)
    : null;

  if (!isConnected) {
    return (
      <div className="glass-card p-5 w-full text-center">
        <Target className="w-10 h-10 text-base-blue mx-auto mb-3" />
        <p className="text-text-secondary text-sm mb-4">Connect wallet to create limit orders</p>
        <ConnectButton size="lg" />
      </div>
    );
  }

  return (
    <div className="glass-card p-5 w-full">

      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Target className="w-4 h-4 text-base-blue" />
          <h1 className="font-semibold text-text-primary">Limit Order</h1>
          {orders.length > 0 && (
            <span className="px-1.5 py-0.5 rounded-full bg-base-blue/15 text-base-blue text-xs font-semibold">
              {orders.length}
            </span>
          )}
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-1 text-xs text-base-blue hover:text-base-blue-light transition-colors font-medium"
        >
          <Plus className="w-3.5 h-3.5" />
          {showForm ? "Hide" : "New Order"}
        </button>
      </div>

      {/* Create form */}
      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="space-y-2 mb-4 overflow-hidden"
          >
            {/* Sell */}
            <div className="rounded-xl border border-border bg-bg-tertiary p-3">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs text-text-muted font-medium">You Sell</span>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-text-muted font-mono">
                    {sellBalanceFormatted} {sellToken?.symbol}
                  </span>
                  {[25, 50, 75, 100].map(pct => (
                    <button
                      key={pct}
                      onClick={() => {
                        if (!sellBalanceRaw || !sellToken) return;
                        const val = parseFloat(formatUnits(sellBalanceRaw, sellToken.decimals)) * pct / 100;
                        setSellAmount(val.toFixed(6));
                      }}
                      className="text-xs text-base-blue hover:text-base-blue-light font-semibold px-1.5 py-1 rounded-lg min-h-[28px] hover:bg-base-blue/10 transition-all"
                    >
                      {pct === 100 ? "MAX" : `${pct}%`}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <input
                  type="number" placeholder="0" min="0"
                  value={sellAmount}
                  onChange={e => setSellAmount(e.target.value)}
                  className="flex-1 bg-transparent text-2xl font-semibold text-text-primary
                             placeholder:text-text-muted outline-none min-w-0"
                />
                <TokenSelector value={sellToken} onChange={handleSellTokenChange} excludeToken={buyToken} />
              </div>
            </div>

            {/* Target price */}
            <div className="rounded-xl border border-border bg-bg-tertiary p-3">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs text-text-muted font-medium">
                  When 1 {sellToken.symbol} =
                </span>
                <div className="flex items-center gap-1.5">
                  {priceLoading ? (
                    <RefreshCw className="w-3 h-3 text-text-muted animate-spin" />
                  ) : marketPrice ? (
                    <button
                      onClick={() => setTargetPrice(marketPrice)}
                      className="text-xs text-text-muted hover:text-base-blue transition-colors"
                    >
                      Market: <span className="font-mono">{parseFloat(marketPrice).toFixed(4)}</span>
                    </button>
                  ) : null}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <input
                  type="number" placeholder="0.00" min="0" step="0.0001"
                  value={targetPrice}
                  onChange={e => setTargetPrice(e.target.value)}
                  className="flex-1 bg-transparent text-2xl font-semibold text-text-primary
                             placeholder:text-text-muted outline-none min-w-0"
                />
                <div className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-bg-secondary">
                  <TokenLogo symbol={buyToken.symbol} logoURI={buyToken.logoURI} size={18} />
                  <span className="text-sm font-semibold text-text-primary">{buyToken.symbol}</span>
                </div>
              </div>

              {/* Above/below market indicator */}
              {targetPrice && marketPrice && (
                <div className={`mt-1.5 text-xs flex items-center gap-1 ${aboveMarket ? "text-success" : "text-warning"}`}>
                  {aboveMarket
                    ? <><TrendingUp className="w-3 h-3" /> {((parseFloat(targetPrice) / parseFloat(marketPrice) - 1) * 100).toFixed(1)}% above market</>
                    : <><AlertTriangle className="w-3 h-3" /> {((1 - parseFloat(targetPrice) / parseFloat(marketPrice)) * 100).toFixed(1)}% below market — executes immediately</>
                  }
                </div>
              )}
            </div>

            {/* You Receive (estimated) */}
            <div className="rounded-xl border border-border bg-bg-tertiary p-3">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs text-text-muted font-medium">You Receive (min)</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="flex-1 text-2xl font-semibold text-text-primary">
                  {estReceive ?? <span className="text-text-muted">0</span>}
                </span>
                <TokenSelector value={buyToken} onChange={setBuyToken} excludeToken={sellToken} />
              </div>
            </div>

            {/* Expiry */}
            <div className="rounded-xl border border-border bg-bg-tertiary p-2.5">
              <span className="text-xs text-text-muted block mb-1">Expires in</span>
              <select
                value={expiryHours}
                onChange={e => setExpiryHours(Number(e.target.value))}
                className="w-full bg-transparent text-sm font-medium text-text-primary outline-none cursor-pointer"
              >
                {EXPIRY_OPTIONS.map(opt => (
                  <option
                    key={opt.value} value={opt.value}
                    style={{ background: "var(--bg-tertiary)", color: "var(--text-primary)" }}
                  >
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            {/* CoW info box */}
            <div className="px-3 py-2 rounded-lg bg-success/5 border border-success/20 text-xs text-text-secondary">
              <strong className="text-success">Powered by CoW Protocol</strong> — order submitted on-chain, monitored 24/7. ETH orders use CoW EthFlow. No need to keep this tab open.
            </div>

            {/* CTA */}
            <button
              onClick={handleCreate}
              disabled={
                !sellAmount || !targetPrice ||
                parseFloat(sellAmount) <= 0 || parseFloat(targetPrice) <= 0 ||
                isLoading
              }
              className="btn-primary w-full py-3 text-sm flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Processing…</>
              ) : (
                <><Target className="w-4 h-4" /> Create Limit Order via CoW</>
              )}
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Active orders */}
      {orders.length > 0 ? (
        <div className="space-y-2">
          <p className="text-xs text-text-muted font-medium uppercase tracking-wide">
            Active Orders ({orders.length})
          </p>
          <AnimatePresence>
            {orders.map(order => (
              <OrderRow key={order.id} order={order} onCancel={cancelOrder} />
            ))}
          </AnimatePresence>
        </div>
      ) : !showForm ? (
        <div className="text-center py-8">
          <Target className="w-8 h-8 text-text-muted mx-auto mb-2" />
          <p className="text-text-muted text-sm">No active limit orders</p>
          <button
            onClick={() => setShowForm(true)}
            className="mt-3 text-xs text-base-blue hover:underline"
          >
            Create your first order →
          </button>
        </div>
      ) : null}
    </div>
  );
}

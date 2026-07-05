"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Target, Plus, Trash2, Clock, Loader2, AlertTriangle,
  TrendingUp, TrendingDown, RefreshCw
} from "lucide-react";
import { useAccount } from "wagmi";
import { parseUnits, formatUnits } from "viem";
import { ConnectButton } from "@/components/ui/ConnectButton";
import { TokenSelector } from "./TokenSelector";
import { TokenLogo } from "@/components/ui/TokenLogo";
import { useLimitOrders } from "@/hooks/useLimitOrders";
import { useTokenBalance } from "@/hooks/useTokenBalance";
import { BASE_TOKENS } from "@/lib/tokens";
import type { Token } from "@/types/token";
import type { LimitOrder } from "@/types/limit-order";

const EXPIRY_OPTIONS = [
  { label: "1 hour",   value: 1 },
  { label: "12 hours", value: 12 },
  { label: "24 hours", value: 24 },
  { label: "7 days",   value: 168 },
];

/* ── Order Row ── */
function OrderRow({ order, onCancel }: { order: LimitOrder; onCancel: (id: string) => void }) {
  const current  = parseFloat(order.currentPrice || "0");
  const target   = parseFloat(order.targetPrice);
  const progress = target > 0 && current > 0 ? Math.min((current / target) * 100, 100) : 0;
  const isClose  = progress >= 90;
  const isFilled = progress >= 100;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -8 }}
      className={`rounded-xl border p-3 ${
        isFilled
          ? "border-success/40 bg-success/5"
          : isClose
          ? "border-warning/40 bg-warning/5"
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
          <span className="px-1.5 py-0.5 rounded-full bg-base-blue/10 text-base-blue text-xs">
            Sell
          </span>
        </div>
        <button
          onClick={() => onCancel(order.id)}
          className="p-1 rounded-lg hover:bg-error/10 text-text-muted hover:text-error transition-all"
          title="Cancel order"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Target vs current price */}
      <div className="flex items-center justify-between text-xs mb-2">
        <div className="flex items-center gap-1 text-text-muted">
          <Target className="w-3 h-3" />
          <span>Target:</span>
          <span className="font-mono text-text-primary font-semibold">
            {parseFloat(order.targetPrice).toFixed(4)} {order.buyToken.symbol}
          </span>
        </div>
        <div className="flex items-center gap-1 text-text-muted">
          {current > 0 && current >= target
            ? <TrendingUp className="w-3 h-3 text-success" />
            : <TrendingDown className="w-3 h-3" />
          }
          <span>Now:</span>
          <span className={`font-mono font-semibold ${
            current >= target ? "text-success" : isClose ? "text-warning" : "text-text-secondary"
          }`}>
            {current > 0 ? current.toFixed(4) : "—"} {order.buyToken.symbol}
          </span>
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-1.5 bg-bg-secondary rounded-full overflow-hidden mb-2">
        <motion.div
          className="h-full rounded-full"
          style={{
            background: isFilled
              ? "var(--success)"
              : isClose
              ? "var(--warning, #f59e0b)"
              : "var(--base-blue)"
          }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.5 }}
        />
      </div>
      <div className="flex justify-between text-xs text-text-muted mb-1">
        <span>{progress.toFixed(0)}% to target</span>
        {isClose && !isFilled && (
          <span className="text-warning font-medium flex items-center gap-1">
            <AlertTriangle className="w-3 h-3" /> Almost there!
          </span>
        )}
        {isFilled && (
          <span className="text-success font-medium">🎯 Executing...</span>
        )}
      </div>

      {/* Expiry */}
      <div className="flex items-center gap-1 text-xs text-text-muted">
        <Clock className="w-3 h-3" />
        <span>
          Expires {new Date(order.expiresAt).toLocaleString("en-US", {
            month: "short", day: "numeric",
            hour: "2-digit", minute: "2-digit",
          })}
        </span>
      </div>
    </motion.div>
  );
}

/* ── Main Component ── */
export function LimitOrderCard() {
  const { address, isConnected } = useAccount();
  const { orders, createOrder, cancelOrder } = useLimitOrders();

  const [sellToken,   setSellToken]   = useState<Token>(BASE_TOKENS.ETH);
  const [buyToken,    setBuyToken]    = useState<Token>(BASE_TOKENS.USDC);
  const [sellAmount,  setSellAmount]  = useState("");
  const [targetPrice, setTargetPrice] = useState("");
  const [expiryHours, setExpiryHours] = useState(24);

  const { balanceRaw: sellBalanceRaw, formatted: sellBalanceFormatted } =
    useTokenBalance(sellToken?.address, address, sellToken?.decimals ?? 18);
  const [slippage,    setSlippage]    = useState(0.5);
  const [isCreating,  setIsCreating]  = useState(false);
  const [showForm,    setShowForm]    = useState(true);

  // Current market price for the pair
  const [marketPrice,    setMarketPrice]    = useState<string | null>(null);
  const [priceLoading,   setPriceLoading]   = useState(false);
  const marketPriceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Fetch market price whenever tokens change
  useEffect(() => {
    setMarketPrice(null);
    if (marketPriceTimer.current) clearTimeout(marketPriceTimer.current);
    marketPriceTimer.current = setTimeout(async () => {
      setPriceLoading(true);
      try {
        // Use 1 sellToken unit to get rate
        const oneUnit = parseUnits("1", sellToken.decimals).toString();
        const params = new URLSearchParams({
          sellToken:  sellToken.address,
          buyToken:   buyToken.address,
          sellAmount: oneUnit,
          chainId:    "8453",
        });
        const res  = await fetch(`/api/price?${params}`);
        const data = await res.json();
        if (res.ok) {
          const sellRate = parseFloat(data.sellTokenToEthRate || "0");
          const buyRate  = parseFloat(data.buyTokenToEthRate  || "0");
          if (sellRate > 0 && buyRate > 0) {
            setMarketPrice((sellRate / buyRate).toFixed(6));
          }
        }
      } catch { /* ignore */ }
      finally { setPriceLoading(false); }
    }, 500);
    return () => { if (marketPriceTimer.current) clearTimeout(marketPriceTimer.current); };
  }, [sellToken.address, buyToken.address, sellToken.decimals]);

  const handleCreate = async () => {
    if (!sellAmount || !targetPrice || parseFloat(sellAmount) <= 0 || parseFloat(targetPrice) <= 0) return;
    setIsCreating(true);
    try {
      createOrder(
        sellToken,
        buyToken,
        sellAmount,
        targetPrice,
        Math.round(slippage * 100),
        expiryHours
      );
      setSellAmount("");
      setTargetPrice("");
      setShowForm(false);
    } finally {
      setIsCreating(false);
    }
  };

  const fillMarketPrice = () => {
    if (marketPrice) setTargetPrice(marketPrice);
  };

  const aboveMarket = marketPrice && targetPrice
    ? parseFloat(targetPrice) > parseFloat(marketPrice)
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
                {isConnected && (
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
                )}
              </div>
              <div className="flex items-center gap-3">
                <input
                  type="number" placeholder="0" min="0"
                  value={sellAmount}
                  onChange={e => setSellAmount(e.target.value)}
                  className="flex-1 bg-transparent text-2xl font-semibold text-text-primary
                             placeholder:text-text-muted outline-none min-w-0"
                />
                <TokenSelector value={sellToken} onChange={setSellToken} excludeToken={buyToken} />
              </div>
            </div>

            {/* Receive token */}
            <div className="rounded-xl border border-border bg-bg-tertiary p-3">
              <span className="text-xs text-text-muted font-medium block mb-1.5">You Receive</span>
              <div className="flex items-center gap-3">
                <div className="flex-1 text-text-muted text-sm">
                  (calculated at execution)
                </div>
                <TokenSelector value={buyToken} onChange={setBuyToken} excludeToken={sellToken} />
              </div>
            </div>

            {/* Target price */}
            <div className="rounded-xl border border-border bg-bg-tertiary p-3">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs text-text-muted font-medium">
                  Execute when 1 {sellToken.symbol} reaches
                </span>
                {/* Market price info */}
                <div className="flex items-center gap-1.5">
                  {priceLoading ? (
                    <RefreshCw className="w-3 h-3 text-text-muted animate-spin" />
                  ) : marketPrice ? (
                    <button
                      onClick={fillMarketPrice}
                      className="text-xs text-text-muted hover:text-base-blue transition-colors"
                      title="Click to use market price"
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
                <div className={`mt-1.5 text-xs flex items-center gap-1 ${
                  aboveMarket ? "text-success" : "text-warning"
                }`}>
                  {aboveMarket
                    ? <><TrendingUp className="w-3 h-3" /> {((parseFloat(targetPrice) / parseFloat(marketPrice) - 1) * 100).toFixed(1)}% above market — sells when price rises</>
                    : <><TrendingDown className="w-3 h-3" /> {((1 - parseFloat(targetPrice) / parseFloat(marketPrice)) * 100).toFixed(1)}% below market — will execute soon</>
                  }
                </div>
              )}
            </div>

            {/* Options row */}
            <div className="flex gap-2">
              {/* Expiry */}
              <div className="flex-1 rounded-xl border border-border bg-bg-tertiary p-2.5">
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

              {/* Slippage */}
              <div className="flex-1 rounded-xl border border-border bg-bg-tertiary p-2.5">
                <span className="text-xs text-text-muted block mb-1">Slippage</span>
                <div className="relative">
                  <input
                    type="number" min="0.1" max="5" step="0.1"
                    value={slippage}
                    onChange={e => setSlippage(Number(e.target.value))}
                    className="w-full bg-transparent text-sm font-medium text-text-primary outline-none pr-4"
                  />
                  <span className="absolute right-0 top-1/2 -translate-y-1/2 text-text-muted text-xs">%</span>
                </div>
              </div>
            </div>

            {/* Info box */}
            <div className="px-3 py-2 rounded-lg bg-base-blue/8 border border-base-blue/20 text-xs text-text-secondary">
              <strong className="text-base-blue">How it works:</strong> Price is checked every 15 seconds.
              When 1 {sellToken.symbol} ≥ your target, the swap executes automatically.
              Keep this tab open.
            </div>

            {/* CTA */}
            <button
              onClick={handleCreate}
              disabled={!sellAmount || !targetPrice || parseFloat(sellAmount) <= 0 || parseFloat(targetPrice) <= 0 || isCreating}
              className="btn-primary w-full py-3 text-sm flex items-center justify-center gap-2"
            >
              {isCreating ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Creating...</>
              ) : (
                <><Target className="w-4 h-4" /> Create Limit Order</>
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

"use client";

import type { Route } from "@lifi/sdk";
import type { TransferStatus } from "@/types/bridge";
import { CheckCircle2, Clock, Loader2, XCircle, ExternalLink, ArrowRight } from "lucide-react";
import { getChain } from "@/lib/bridgeChains";
import { getBridgeInfo } from "@/lib/lifi";
import { useBridgeStatus } from "@/hooks/useBridgeStatus";
import { formatUnits } from "viem";
import { cn } from "@/lib/utils";

interface BridgeProgressProps {
  status: TransferStatus;
  txHash: string | null;
  fromChain: number;
  toChain: number;
  route: Route | null;
  error: string | null;
  recordId?: string;
  onReset: () => void;
}

export function BridgeProgress({
  status, txHash, fromChain, toChain, route, error, recordId, onReset,
}: BridgeProgressProps) {
  const bridge = route?.steps[0]?.tool ?? "unknown";
  const { status: lifiStatus, destinationTx } = useBridgeStatus({
    txHash, bridge, fromChain, toChain, recordId,
  });

  const from = getChain(fromChain);
  const to   = getChain(toChain);
  const info = getBridgeInfo(bridge);

  const isDone   = status === "done"   || lifiStatus === "DONE";
  const isFailed = status === "failed" || lifiStatus === "FAILED";

  const steps = [
    { label: "Transaction sent",     done: !!txHash,                          active: status === "sending" },
    { label: `${from?.name} confirmed`, done: status === "pending" || isDone, active: status === "sending" },
    { label: `${info.label} bridging`,  done: isDone,                          active: status === "pending" && !isDone },
    { label: `${to?.name} confirmed`,   done: isDone,                          active: false },
  ];

  const progress = isDone ? 100 : isFailed ? 0 : steps.filter(s => s.done).length * 25;

  return (
    <div className="glass-card p-5 w-full">
      {/* Header */}
      <div className="flex items-center gap-3 mb-5">
        <div className={cn(
          "w-10 h-10 rounded-xl flex items-center justify-center",
          isDone   ? "bg-success/15" :
          isFailed ? "bg-error/15"   :
          "bg-base-blue/15"
        )}>
          {isDone   ? <CheckCircle2 className="w-5 h-5 text-success" /> :
           isFailed ? <XCircle      className="w-5 h-5 text-error" />   :
           <Loader2 className="w-5 h-5 text-base-blue animate-spin" />}
        </div>
        <div>
          <h3 className="font-bold text-text-primary">
            {isDone   ? "Bridge Complete!" :
             isFailed ? "Bridge Failed"    :
             "Bridging in progress…"}
          </h3>
          <p className="text-xs text-text-muted">
            {from?.icon} {from?.name} <ArrowRight className="inline w-3 h-3" /> {to?.icon} {to?.name}
          </p>
        </div>
      </div>

      {/* Amount summary */}
      {route && (
        <div className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-bg-tertiary mb-4">
          <div className="text-sm">
            <span className="text-text-muted text-xs block">Sending</span>
            <span className="font-mono font-semibold text-text-primary">
              {Number(formatUnits(BigInt(route.fromAmount), route.fromToken.decimals)).toFixed(6)} {route.fromToken.symbol}
            </span>
          </div>
          <ArrowRight className="w-4 h-4 text-text-muted" />
          <div className="text-sm text-right">
            <span className="text-text-muted text-xs block">Receiving</span>
            <span className="font-mono font-semibold text-success">
              ~{Number(formatUnits(BigInt(route.toAmountMin ?? "0"), route.toToken.decimals)).toFixed(6)} {route.toToken.symbol}
            </span>
          </div>
        </div>
      )}

      {/* Progress bar */}
      <div className="h-2 bg-bg-tertiary rounded-full overflow-hidden mb-4">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{
            width: `${progress}%`,
            background: isFailed ? "var(--error)" : "var(--gradient-base)",
          }}
        />
      </div>

      {/* Steps */}
      <div className="space-y-2 mb-4">
        {steps.map((step, i) => (
          <div key={i} className="flex items-center gap-3">
            <div className={cn(
              "w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0",
              step.done   ? "bg-success/20"    :
              step.active ? "bg-base-blue/20"  :
              "bg-bg-tertiary"
            )}>
              {step.done   ? <CheckCircle2 className="w-3 h-3 text-success" /> :
               step.active ? <Loader2      className="w-3 h-3 text-base-blue animate-spin" /> :
               <div className="w-2 h-2 rounded-full bg-border" />}
            </div>
            <span className={cn(
              "text-sm",
              step.done   ? "text-text-primary" :
              step.active ? "text-base-blue"    :
              "text-text-muted"
            )}>
              {step.label}
            </span>
          </div>
        ))}
      </div>

      {/* TX links */}
      <div className="space-y-1.5 mb-4">
        {txHash && (
          <a
            href={`${getChain(fromChain)?.blockExplorer}/tx/${txHash}`}
            target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-xs text-base-blue hover:underline"
          >
            <ExternalLink className="w-3 h-3" />
            Source transaction
          </a>
        )}
        {destinationTx && (
          <a
            href={`${getChain(toChain)?.blockExplorer}/tx/${destinationTx}`}
            target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-xs text-success hover:underline"
          >
            <ExternalLink className="w-3 h-3" />
            Destination transaction
          </a>
        )}
      </div>

      {error && (
        <div className="px-3 py-2 rounded-lg bg-error/10 border border-error/20 text-xs text-error mb-3">
          {error}
        </div>
      )}

      {(isDone || isFailed) && (
        <button onClick={onReset} className="btn-primary w-full py-3 text-sm">
          {isDone ? "New Transfer" : "Try Again"}
        </button>
      )}
    </div>
  );
}

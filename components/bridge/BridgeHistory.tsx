"use client";

import { useState, useEffect } from "react";
import { getBridgeHistory, updateBridgeStatus, type BridgeRecord } from "@/lib/bridgeHistory";
import { fetchBridgeStatus } from "@/lib/lifi";
import { getChain } from "@/lib/bridgeChains";
import { ExternalLink, Clock, CheckCircle2, XCircle, Loader2, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  if (diff < 60_000)    return "just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
}

// Poll LI.FI for pending transfers
async function refreshStatus(record: BridgeRecord): Promise<BridgeRecord["status"]> {
  if (!record.txHash || record.status !== "pending") return record.status;
  try {
    const res = await fetchBridgeStatus({
      txHash:    record.txHash,
      bridge:    record.bridge,
      fromChain: record.fromChain,
      toChain:   record.toChain,
    });
    if (res.status === "DONE")   return "done";
    if (res.status === "FAILED") return "failed";
  } catch { /* ignore */ }
  return "pending";
}

export function BridgeHistory({ onClose }: { onClose: () => void }) {
  const [history,    setHistory]    = useState<BridgeRecord[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => { setHistory(getBridgeHistory()); }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    const current = getBridgeHistory();
    const updated = await Promise.all(
      current.map(async r => {
        const newStatus = await refreshStatus(r);
        if (newStatus !== r.status) {
          updateBridgeStatus(r.id, newStatus);
          return { ...r, status: newStatus };
        }
        return r;
      })
    );
    setHistory(updated);
    setRefreshing(false);
  };

  return (
    <div className="glass-card p-4 w-full">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-bold text-sm text-text-primary">Recent Transfers</h3>
        <div className="flex items-center gap-2">
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="text-xs text-text-muted hover:text-text-primary transition-colors p-1 rounded hover:bg-bg-tertiary"
            title="Refresh statuses"
          >
            <RefreshCw className={cn("w-3.5 h-3.5", refreshing && "animate-spin")} />
          </button>
          <button onClick={onClose} className="text-xs text-text-muted hover:text-text-primary transition-colors">
            Close
          </button>
        </div>
      </div>

      {history.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-text-muted text-sm">No transfers yet</p>
        </div>
      ) : (
        <div className="space-y-2">
          {history.map(record => {
            const from = getChain(record.fromChain);
            const to   = getChain(record.toChain);
            return (
              <div key={record.id}
                   className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-bg-tertiary">
                <div className="flex-shrink-0">
                  {record.status === "done"    && <CheckCircle2 className="w-4 h-4 text-success" />}
                  {record.status === "pending" && <Loader2      className="w-4 h-4 text-base-blue animate-spin" />}
                  {record.status === "failed"  && <XCircle      className="w-4 h-4 text-error" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-semibold text-text-primary">
                    {record.fromToken} → {record.toToken}
                    <span className="font-normal text-text-muted ml-2">
                      {from?.icon}{from?.name} → {to?.icon}{to?.name}
                    </span>
                  </div>
                  <div className="text-xs text-text-muted flex items-center gap-1 mt-0.5">
                    <Clock className="w-2.5 h-2.5" />
                    {timeAgo(record.timestamp)}
                    <span className="mx-1">·</span>
                    {record.bridge}
                    {record.status === "pending" && (
                      <span className="text-warning ml-1">· still processing</span>
                    )}
                  </div>
                </div>
                {record.txHash && (
                  <a
                    href={`${from?.blockExplorer}/tx/${record.txHash}`}
                    target="_blank" rel="noopener noreferrer"
                    className="flex-shrink-0 text-text-muted hover:text-base-blue transition-colors"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

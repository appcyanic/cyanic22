"use client";

import { useState, useEffect } from "react";
import { fetchBridgeStatus } from "@/lib/lifi";
import { updateBridgeStatus } from "@/lib/bridgeHistory";

type StatusResult = "PENDING" | "DONE" | "FAILED" | "INVALID" | "NOT_FOUND";

interface UseBridgeStatusParams {
  txHash: string | null;
  bridge: string;
  fromChain: number;
  toChain: number;
  recordId?: string;
}

export function useBridgeStatus({
  txHash, bridge, fromChain, toChain, recordId,
}: UseBridgeStatusParams) {
  const [status,        setStatus]        = useState<StatusResult | null>(null);
  const [destinationTx, setDestinationTx] = useState<string | null>(null);

  useEffect(() => {
    if (!txHash) return;
    let interval: ReturnType<typeof setInterval>;

    const poll = async () => {
      try {
        const result = await fetchBridgeStatus({ txHash, bridge, fromChain, toChain });
        const s = result.status as StatusResult;
        setStatus(s);

        const destTx = (result as Record<string, unknown>).receiving as { txHash?: string } | undefined;
        if (destTx?.txHash) setDestinationTx(destTx.txHash);

        if (s === "DONE" || s === "FAILED") {
          clearInterval(interval);
          if (recordId) {
            updateBridgeStatus(
              recordId,
              s === "DONE" ? "done" : "failed",
              destTx?.txHash
            );
          }
        }
      } catch { /* retry next poll */ }
    };

    poll();
    interval = setInterval(poll, 5_000);
    return () => clearInterval(interval);
  }, [txHash, bridge, fromChain, toChain, recordId]);

  return { status, destinationTx };
}

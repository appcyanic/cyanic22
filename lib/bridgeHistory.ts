import type { BridgeRecord } from "@/types/bridge";

const STORAGE_KEY = "bridgeHistory";
const MAX_RECORDS = 50;

export function saveBridgeHistory(record: Omit<BridgeRecord, "id">): BridgeRecord {
  const newRecord: BridgeRecord = {
    ...record,
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
  };
  if (typeof window === "undefined") return newRecord;
  try {
    const existing = getBridgeHistory();
    const updated = [newRecord, ...existing].slice(0, MAX_RECORDS);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch { /* localStorage full */ }
  return newRecord;
}

export function getBridgeHistory(): BridgeRecord[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
  } catch { return []; }
}

export function updateBridgeStatus(
  id: string,
  status: BridgeRecord["status"],
  destTx?: string
): void {
  if (typeof window === "undefined") return;
  const history = getBridgeHistory();
  const updated = history.map(r =>
    r.id === id ? { ...r, status, destinationTxHash: destTx ?? r.destinationTxHash } : r
  );
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
}

export function clearBridgeHistory(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(STORAGE_KEY);
}

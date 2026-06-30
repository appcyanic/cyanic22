export interface BridgeChain {
  id: number;
  name: string;
  icon: string;
  rpc: string;
  blockExplorer: string;
  logoURI?: string;
}

export interface BridgeToken {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  logoURI?: string;
  chainId: number;
}

export interface BridgeRecord {
  id: string;
  txHash: string;
  fromChain: number;
  toChain: number;
  fromToken: string;
  toToken: string;
  fromAmount: string;
  toAmount: string;
  bridge: string;
  timestamp: number;
  status: "done" | "pending" | "failed";
  destinationTxHash?: string;
}

export type TransferStatus =
  | "idle"
  | "approving"
  | "sending"
  | "pending"
  | "done"
  | "failed";

"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Send, User, Loader2, Zap, Sparkles, ArrowRight, X, CheckCircle2, ExternalLink, AlertCircle } from "lucide-react";
import { useAccount, useWalletClient, usePublicClient } from "wagmi";
import { parseUnits, erc20Abi, maxUint256 } from "viem";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { BASE_TOKENS, getTokenBySymbol } from "@/lib/tokens";
import { useUserPoints } from "@/hooks/useUserPoints";
import { XP_REWARDS } from "@/types/reward";
import type { Token } from "@/types/token";

const SUGGESTIONS = [
  { icon: "🔄", text: "Swap 5 USDC to ETH" },
  { icon: "🌊", text: "Swap 50 USDC to AERO" },
];

interface SwapIntent {
  sellToken: Token;
  buyToken: Token;
  sellAmountHuman: string;
  buyAmountHuman: string;
  route: string;
}

interface SwapPreview {
  intent: SwapIntent;
  quote: Record<string, unknown>;
}

// Parse "Swap X TOKEN to TOKEN" from AI response
function detectSwapIntent(text: string): { amount: string; from: string; to: string } | null {
  const patterns = [
    /swap\s+([\d.,]+)\s+([A-Z]+)\s+(?:to|for)\s+([A-Z]+)/i,
    /swapping\s+([\d.,]+)\s+([A-Z]+)\s+(?:to|for)\s+([A-Z]+)/i,
    /([\d.,]+)\s+([A-Z]+)\s+→\s+([A-Z]+)/i,
  ];
  for (const pat of patterns) {
    const m = text.match(pat);
    if (m) return { amount: m[1].replace(",", "."), from: m[2].toUpperCase(), to: m[3].toUpperCase() };
  }
  return null;
}

export function AgentChat() {
  const { address, isConnected } = useAccount();
  const { data: walletClient }   = useWalletClient();
  const publicClient             = usePublicClient();
  const { awardXP }              = useUserPoints();

  const [messages, setMessages] = useState<{ id: string; role: "user" | "assistant"; content: string }[]>([]);
  const [input, setInput]       = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [swapPreview, setSwapPreview] = useState<SwapPreview | null>(null);
  const [isSwapping, setIsSwapping]   = useState(false);
  const [lastTxHash, setLastTxHash]   = useState<string | null>(null);

  const endRef   = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, swapPreview]);

  const fillSuggestion = (text: string) => {
    setInput(text);
    inputRef.current?.focus();
  };

  // Fetch quote and show swap preview
  const showSwapPreview = async (amount: string, fromSymbol: string, toSymbol: string) => {
    const sellToken = getTokenBySymbol(fromSymbol) ?? BASE_TOKENS[fromSymbol];
    const buyToken  = getTokenBySymbol(toSymbol)  ?? BASE_TOKENS[toSymbol];
    if (!sellToken || !buyToken || !address) return;

    try {
      const sellAmountRaw = parseUnits(amount, sellToken.decimals).toString();
      const params = new URLSearchParams({
        sellToken: sellToken.address,
        buyToken:  buyToken.address,
        sellAmount: sellAmountRaw,
        taker: address,
        chainId: "8453",
      });
      const res = await fetch(`/api/quote?${params}`);
      if (!res.ok) return;
      const quote = await res.json();

      const buyAmountHuman = (
        Number(quote.buyAmount) / Math.pow(10, buyToken.decimals)
      ).toFixed(6);

      const sources: { name: string; proportion: string }[] = quote.sources ?? [];
      const topRoute = sources
        .filter((s) => parseFloat(s.proportion) > 0)
        .sort((a, b) => parseFloat(b.proportion) - parseFloat(a.proportion))[0]?.name ?? "Best Route";

      setSwapPreview({
        intent: { sellToken, buyToken, sellAmountHuman: amount, buyAmountHuman, route: topRoute },
        quote,
      });
    } catch { /* ignore */ }
  };

  const handleConfirmSwap = async () => {
    if (!swapPreview || !address || !walletClient || !publicClient) return;
    setIsSwapping(true);

    try {
      const { intent } = swapPreview;
      const sellAmountRaw = parseUnits(intent.sellAmountHuman, intent.sellToken.decimals).toString();

      // ── x402: call /api/agent-swap, handle 402 payment flow ───
      toast.loading("Requesting swap via AI Agent…", { id: "agent-swap" });

      const fetchWithPayment = async (): Promise<Response> => {
        const res = await fetch("/api/agent-swap", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sellToken: intent.sellToken.address,
            buyToken:  intent.buyToken.address,
            sellAmount: sellAmountRaw,
            taker: address,
          }),
        });

        if (res.status === 402) {
          // x402 payment required — parse the payment details
          const paymentRequired = await res.json();
          const paymentDetails  = paymentRequired.accepts?.[0];

          if (!paymentDetails) throw new Error("Invalid x402 payment details");

          const { amount, asset, payTo: recipient } = paymentDetails;
          const USDC_ADDRESS = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" as const;

          // Check balance
          const balance = await publicClient.readContract({
            address: USDC_ADDRESS,
            abi: erc20Abi,
            functionName: "balanceOf",
            args: [address],
          }) as bigint;

          const feeAmt = BigInt(amount ?? "100000"); // 0.1 USDC = 100000 (6 decimals)

          if (balance < feeAmt) {
            throw new Error("Insufficient USDC balance for 0.1 USDC agent fee");
          }

          toast.loading("Approve 0.1 USDC agent fee in wallet…", { id: "agent-swap" });

          // Transfer USDC fee
          const feeTxHash = await walletClient.writeContract({
            address: USDC_ADDRESS,
            abi: erc20Abi,
            functionName: "transfer",
            args: [
              (recipient ?? process.env.NEXT_PUBLIC_FEE_RECIPIENT ?? "0x66C5EFF0B6aF1C6D89E9ca27F130791372B640e9") as `0x${string}`,
              feeAmt,
            ],
          });

          await publicClient.waitForTransactionReceipt({ hash: feeTxHash });

          toast.loading("Fee paid ✓ Getting swap quote…", { id: "agent-swap" });

          // Retry with payment proof header
          return fetch("/api/agent-swap", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-Payment": JSON.stringify({ txHash: feeTxHash, amount: feeAmt.toString(), asset: asset ?? "USDC" }),
            },
            body: JSON.stringify({
              sellToken:  intent.sellToken.address,
              buyToken:   intent.buyToken.address,
              sellAmount: sellAmountRaw,
              taker:      address,
            }),
          });
        }

        return res;
      };

      const quoteRes = await fetchWithPayment();
      if (!quoteRes.ok) {
        const err = await quoteRes.json().catch(() => ({}));
        throw new Error(err.error ?? "Failed to get swap quote");
      }

      const { quote } = await quoteRes.json();

      // ── Execute the swap on-chain ──────────────────────────────
      const isNative = intent.sellToken.address.toLowerCase() === "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee";
      // 0x v2 uses AllowanceHolder, not Permit2
      const PERMIT2_ADDR    = "0x000000000022D473030F116dDEE9F6B43aC78BA3" as const;
      const ALLOWANCE_HOLDER = "0x0000000000001fF3684f28c67538d4D072C22734" as const;

      // Approval for ERC-20
      if (!isNative) {
        const allowance = await publicClient.readContract({
          address: intent.sellToken.address as `0x${string}`,
          abi: erc20Abi,
          functionName: "allowance",
          args: [address, ALLOWANCE_HOLDER],
        });
        const sellAmtBn = parseUnits(intent.sellAmountHuman, intent.sellToken.decimals);
        if ((allowance as bigint) < sellAmtBn) {
          toast.loading("Approving token…", { id: "agent-swap" });
          const approveTx = await walletClient.writeContract({
            address: intent.sellToken.address as `0x${string}`,
            abi: erc20Abi,
            functionName: "approve",
            args: [ALLOWANCE_HOLDER, maxUint256],
          });
          await publicClient.waitForTransactionReceipt({ hash: approveTx });
        }
      }

      // Handle permit2 signature if required
      const quoteAny = quote as Record<string, unknown>;
      const txData   = (quoteAny.transaction as Record<string, string>) ?? {
        to: quoteAny.to, data: quoteAny.data, gas: quoteAny.gas, value: quoteAny.value,
      };
      const permit2 = quoteAny.permit2 as { eip712?: { domain: unknown; types: unknown; message: unknown; primaryType: string } } | undefined;

      let finalData = txData.data as `0x${string}`;

      if (permit2?.eip712) {
        toast.loading("Sign Permit2…", { id: "agent-swap" });
        const sig = await walletClient.signTypedData({
          domain:      permit2.eip712.domain      as Parameters<typeof walletClient.signTypedData>[0]["domain"],
          types:       permit2.eip712.types        as Parameters<typeof walletClient.signTypedData>[0]["types"],
          primaryType: permit2.eip712.primaryType,
          message:     permit2.eip712.message      as Parameters<typeof walletClient.signTypedData>[0]["message"],
        });
        const sigHex = sig.slice(2);
        const sigLen = (sigHex.length / 2).toString(16).padStart(64, "0");
        const padded = sigHex.padEnd(Math.ceil(sigHex.length / 64) * 64, "0");
        finalData    = (finalData + sigLen + padded) as `0x${string}`;
      }

      toast.loading("Swapping via AI Agent…", { id: "agent-swap" });

      const txHash = await walletClient.sendTransaction({
        to:    txData.to    as `0x${string}`,
        data:  finalData,
        value: txData.value ? BigInt(txData.value) : BigInt(0),
        gas:   txData.gas   ? BigInt(txData.gas)   : undefined,
      });

      const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });

      if (receipt.status === "success") {
        setLastTxHash(txHash);
        setSwapPreview(null);

        toast.success(
          `✅ Agent swap successful! +${XP_REWARDS.AGENT_SWAP} XP earned`,
          { id: "agent-swap", duration: 5000 }
        );

        // Award 250 XP for agent swap
        await awardXP(XP_REWARDS.AGENT_SWAP, "agent");

        setMessages(prev => [...prev, {
          id: Date.now().toString(),
          role: "assistant",
          content: `✅ Swap confirmed! ${intent.sellAmountHuman} ${intent.sellToken.symbol} → ~${intent.buyAmountHuman} ${intent.buyToken.symbol}\n\n🔵 +${XP_REWARDS.AGENT_SWAP} XP earned for using AI Agent!\n\n[View on BaseScan](https://basescan.org/tx/${txHash})`,
        }]);
      } else {
        toast.error("Swap failed", { id: "agent-swap" });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      if (!msg.includes("rejected")) toast.error("Swap failed", { id: "agent-swap" });
      toast.dismiss("agent-swap");
    } finally {
      setIsSwapping(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMsg = { id: Date.now().toString(), role: "user" as const, content: input };
    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setIsLoading(true);
    setSwapPreview(null);

    try {
      // ── x402: wrap fetch with payment using user's wallet ─────
      // Dynamically import to keep out of initial bundle
      const [{ x402Client, wrapFetchWithPayment }, { ExactEvmScheme }] = await Promise.all([
        import("@x402/fetch"),
        import("@x402/evm/exact/client"),
      ]);

      let fetchFn: typeof fetch = fetch;

      if (walletClient && address) {
        // Create x402 signer from wagmi wallet client
        // ExactEvmScheme only needs { address, signTypedData }
        const viemSigner = {
          address,
          signTypedData: walletClient.signTypedData.bind(walletClient),
        };

        const client = new x402Client();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const scheme = new (ExactEvmScheme as any)(viemSigner);
        client.register("eip155:8453", scheme);
        fetchFn = wrapFetchWithPayment(fetch, client) as typeof fetch;
      }

      const res = await fetchFn("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: [...messages, userMsg].map(m => ({ role: m.role, content: m.content })) }),
      });

      if (!res.ok) {
        if (res.status === 402) {
          setMessages(prev => [...prev, {
            id: Date.now().toString(), role: "assistant",
            content: "⚠️ Connect your wallet and ensure you have USDC on Base to use the AI Agent ($0.10 per message).",
          }]);
          return;
        }
        throw new Error("Agent error");
      }

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      let assistantContent = "";
      const assistantId = (Date.now() + 1).toString();

      setMessages(prev => [...prev, { id: assistantId, role: "assistant", content: "" }]);

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value);
          const lines = chunk.split("\n");
          for (const line of lines) {
            if (line.startsWith("0:")) {
              try {
                const text = JSON.parse(line.slice(2));
                assistantContent += text;
                setMessages(prev =>
                  prev.map(m => m.id === assistantId ? { ...m, content: assistantContent } : m)
                );
              } catch { /* skip */ }
            }
          }
        }
      }

      // Detect swap intent in final response
      if (isConnected && address) {
        const intent = detectSwapIntent(assistantContent);
        if (intent) {
          await showSwapPreview(intent.amount, intent.from, intent.to);
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      if (msg.toLowerCase().includes("payment") || msg.toLowerCase().includes("usdc")) {
        setMessages(prev => [...prev, {
          id: Date.now().toString(), role: "assistant",
          content: "⚠️ Payment failed. Ensure you have USDC on Base and your wallet is connected.",
        }]);
      } else {
        setMessages(prev => [...prev, {
          id: Date.now().toString(), role: "assistant",
          content: "Sorry, something went wrong. Please try again.",
        }]);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full">

      {/* ── Message list ── */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0">

        {messages.length === 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center justify-center h-full text-center py-8"
          >
            <div className="w-16 h-16 rounded-2xl bg-gradient-base flex items-center justify-center mb-4">
              <Sparkles className="w-8 h-8 text-white" />
            </div>
            <h2 className="text-xl font-bold text-text-primary mb-1">Cyanic AI Agent</h2>
            <p className="text-text-secondary text-sm max-w-sm mb-1">Your DeFi assistant for the Base ecosystem.</p>
            <p className="text-text-muted text-xs mb-6">
              Ask to swap tokens and earn <span className="text-success font-semibold">+{XP_REWARDS.AGENT_SWAP} XP</span> per confirmed swap!
            </p>
            <div className="flex flex-col gap-2 w-full max-w-sm">
              {SUGGESTIONS.map((s, i) => (
                <button
                  key={i}
                  onClick={() => fillSuggestion(s.text)}
                  className="flex items-center gap-3 px-4 py-3 rounded-xl border border-border bg-bg-secondary hover:border-base-blue/40 hover:bg-base-blue/5 text-left transition-all group min-h-[52px]"
                >
                  <span className="text-xl flex-shrink-0">{s.icon}</span>
                  <span className="text-text-secondary group-hover:text-text-primary transition-colors text-sm font-medium">{s.text}</span>
                </button>
              ))}
            </div>
          </motion.div>
        )}

        <AnimatePresence initial={false}>
          {messages.map((msg) => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className={cn("flex gap-3", msg.role === "user" ? "justify-end" : "justify-start")}
            >
              {msg.role === "assistant" && (
                <div className="w-8 h-8 rounded-xl bg-gradient-base flex items-center justify-center flex-shrink-0 mt-1">
                  <Zap className="w-4 h-4 text-white" />
                </div>
              )}
              <div className={cn(
                "max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed",
                msg.role === "user"
                  ? "bg-base-blue text-white rounded-tr-sm"
                  : "bg-bg-secondary border border-border text-text-primary rounded-tl-sm"
              )}>
                <div className="whitespace-pre-wrap">{msg.content}</div>
              </div>
              {msg.role === "user" && (
                <div className="w-8 h-8 rounded-xl bg-bg-tertiary border border-border flex items-center justify-center flex-shrink-0 mt-1">
                  <User className="w-4 h-4 text-text-secondary" />
                </div>
              )}
            </motion.div>
          ))}
        </AnimatePresence>

        {isLoading && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex gap-3">
            <div className="w-8 h-8 rounded-xl bg-gradient-base flex items-center justify-center flex-shrink-0">
              <Zap className="w-4 h-4 text-white" />
            </div>
            <div className="bg-bg-secondary border border-border rounded-2xl rounded-tl-sm px-4 py-3">
              <div className="flex gap-1.5 items-center">
                <Loader2 className="w-4 h-4 text-base-blue animate-spin" />
                <span className="text-sm text-text-muted">Thinking...</span>
              </div>
            </div>
          </motion.div>
        )}

        {/* ── Swap Preview Card ── */}
        <AnimatePresence>
          {swapPreview && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="glass-card p-4 border-base-blue/40"
              style={{ borderColor: "rgba(0,82,255,0.4)" }}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Zap className="w-4 h-4 text-base-blue" />
                  <span className="text-sm font-semibold text-text-primary">Swap Preview</span>
                </div>
                <button onClick={() => setSwapPreview(null)} className="p-1 rounded-lg hover:bg-bg-tertiary text-text-muted hover:text-text-primary transition-all">
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Token display */}
              <div className="flex items-center gap-3 mb-3">
                <div className="flex-1 rounded-xl bg-bg-tertiary border border-border p-3 text-center">
                  <div className="text-xs text-text-muted mb-1">You pay</div>
                  <div className="text-lg font-bold text-text-primary">{swapPreview.intent.sellAmountHuman} {swapPreview.intent.sellToken.symbol}</div>
                </div>
                <ArrowRight className="w-5 h-5 text-text-muted flex-shrink-0" />
                <div className="flex-1 rounded-xl bg-bg-tertiary border border-border p-3 text-center">
                  <div className="text-xs text-text-muted mb-1">You receive</div>
                  <div className="text-lg font-bold text-success">≈{swapPreview.intent.buyAmountHuman} {swapPreview.intent.buyToken.symbol}</div>
                </div>
              </div>

              {/* Details */}
              <div className="space-y-1.5 mb-3 text-xs">
                <div className="flex justify-between text-text-muted">
                  <span>Agent fee</span>
                  <span className="text-warning font-medium">0.1 USDC</span>
                </div>
                <div className="flex justify-between text-text-muted">
                  <span>Best route</span>
                  <span className="text-text-primary font-medium">{swapPreview.intent.route}</span>
                </div>
                <div className="flex justify-between text-text-muted">
                  <span>XP earned</span>
                  <span className="text-success font-semibold">+{XP_REWARDS.AGENT_SWAP} XP</span>
                </div>
              </div>

              {/* Buttons */}
              <div className="flex gap-2">
                <button
                  onClick={() => setSwapPreview(null)}
                  className="flex-1 py-2.5 rounded-xl border border-border text-sm text-text-secondary hover:bg-bg-tertiary transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmSwap}
                  disabled={isSwapping || !isConnected}
                  className="flex-1 py-2.5 rounded-xl btn-primary text-sm flex items-center justify-center gap-2"
                >
                  {isSwapping
                    ? <><Loader2 className="w-4 h-4 animate-spin" /> Swapping…</>
                    : <><CheckCircle2 className="w-4 h-4" /> Confirm Swap</>
                  }
                </button>
              </div>
              {!isConnected && (
                <p className="text-xs text-warning text-center mt-2">Connect wallet to execute swap</p>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {lastTxHash && (
          <div className="text-center">
            <a href={`https://basescan.org/tx/${lastTxHash}`} target="_blank" rel="noopener noreferrer"
               className="text-xs text-base-blue hover:underline flex items-center justify-center gap-1">
              Last tx <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        )}

        <div ref={endRef} />
      </div>

      {/* ── Input bar ── */}
      <div className="sticky bottom-0 p-4 border-t border-border bg-bg-primary/95 backdrop-blur-xl">
        <form onSubmit={handleSubmit} className="flex gap-3">
          <input
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="Ask about swaps, tokens, gas, DeFi strategies…"
            className="input-base flex-1 px-4 py-3 text-sm"
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={!input.trim() || isLoading}
            className="btn-primary px-4 py-3 flex items-center justify-center"
          >
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </button>
        </form>
        <p className="text-xs text-text-muted text-center mt-2">
          Swap via AI Agent · Earn <span className="text-success">+{XP_REWARDS.AGENT_SWAP} XP</span> per confirmed swap · Always DYOR.
        </p>
      </div>
    </div>
  );
}

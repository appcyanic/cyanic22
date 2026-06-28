"use client";

import { useState } from "react";
import { useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Send, User, Loader2, Zap, Sparkles, CreditCard, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";

const SUGGESTIONS = [
  { icon: "🔄", text: "Swap 5 USDC to ETH" },
  { icon: "📊", text: "What's the best DeFi strategy on Base right now?" },
];

export function AgentChat() {
  const [messages, setMessages] = useState<{ id: string; role: "user" | "assistant"; content: string }[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [paymentRequired, setPaymentRequired] = useState<{
    paywallUrl?: string;
    amount: string;
    network: string;
  } | null>(null);

  const endRef   = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const fillSuggestion = (text: string) => {
    setInput(text);
    inputRef.current?.focus();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMsg = { id: Date.now().toString(), role: "user" as const, content: input };
    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setIsLoading(true);
    setPaymentRequired(null);

    try {
      const res = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: [...messages, userMsg].map(m => ({ role: m.role, content: m.content })) }),
      });

      // x402 Payment Required
      if (res.status === 402) {
        const data = await res.json().catch(() => ({}));
        setPaymentRequired({
          paywallUrl: data.paywallUrl || data.x402PaywallUrl,
          amount: data.accepts?.[0]?.maxAmountRequired || "0.01",
          network: data.accepts?.[0]?.network || "base-sepolia",
        });
        // Remove the user message we optimistically added
        setMessages(prev => prev.filter(m => m.id !== userMsg.id));
        return;
      }

      if (!res.ok) throw new Error("Agent error");

      // Stream response
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
          // Parse Vercel AI SDK stream format
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
    } catch {
      setMessages(prev => [...prev, {
        id: Date.now().toString(), role: "assistant",
        content: "Sorry, something went wrong. Please try again.",
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full">

      {/* ── Message list ── */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0">

        {/* Empty state */}
        {messages.length === 0 && !paymentRequired && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center justify-center h-full text-center py-8"
          >
            <div className="w-16 h-16 rounded-2xl bg-gradient-base flex items-center justify-center mb-4">
              <Sparkles className="w-8 h-8 text-white" />
            </div>

            <h2 className="text-xl font-bold text-text-primary mb-1">
              Baseora AI Agent
            </h2>
            <p className="text-text-secondary text-sm max-w-sm mb-1">
              Your DeFi assistant for the Base ecosystem.
            </p>
            <p className="text-text-muted text-xs mb-6">
              Ask anything about swaps, tokens, and DeFi on Base.
            </p>

            <div className="flex flex-col gap-2 w-full max-w-sm">
              {SUGGESTIONS.map((s, i) => (
                <button
                  key={i}
                  onClick={() => fillSuggestion(s.text)}
                  className="flex items-center gap-3 px-4 py-3 rounded-xl border border-border
                             bg-bg-secondary hover:border-base-blue/40 hover:bg-base-blue/5
                             text-left transition-all group min-h-[52px]"
                >
                  <span className="text-xl flex-shrink-0">{s.icon}</span>
                  <span className="text-text-secondary group-hover:text-text-primary transition-colors text-sm font-medium">
                    {s.text}
                  </span>
                </button>
              ))}
            </div>
          </motion.div>
        )}

        {/* x402 Payment Required */}
        {paymentRequired && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center justify-center h-full text-center py-8 px-4"
          >
            <div className="w-16 h-16 rounded-2xl bg-gradient-base flex items-center justify-center mb-4">
              <CreditCard className="w-8 h-8 text-white" />
            </div>
            <h2 className="text-lg font-bold text-text-primary mb-2">Payment Required</h2>
            <p className="text-text-secondary text-sm mb-1">
              Each AI Agent query costs <span className="text-base-blue font-semibold">$0.01 USDC</span>
            </p>
            <p className="text-text-muted text-xs mb-6">
              Paid via x402 on {paymentRequired.network} — instant, no subscription needed.
            </p>

            {paymentRequired.paywallUrl ? (
              <a
                href={paymentRequired.paywallUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-primary px-8 py-3 flex items-center gap-2 text-sm rounded-xl"
              >
                <CreditCard className="w-4 h-4" />
                Pay 0.01 USDC & Continue
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            ) : (
              <div className="px-4 py-3 rounded-xl bg-base-blue/10 border border-base-blue/20 text-xs text-text-secondary max-w-sm">
                <strong className="text-base-blue block mb-1">Set up to enable payments:</strong>
                Add <code className="bg-bg-tertiary px-1 rounded">X402_PAY_TO_ADDRESS</code> to your .env.local
                to start receiving USDC for each AI query.
              </div>
            )}

            <button
              onClick={() => setPaymentRequired(null)}
              className="mt-4 text-xs text-text-muted hover:text-text-secondary transition-colors"
            >
              ← Back
            </button>
          </motion.div>
        )}

        {/* Messages */}
        <AnimatePresence initial={false}>
          {messages.map((msg) => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className={cn(
                "flex gap-3",
                msg.role === "user" ? "justify-end" : "justify-start"
              )}
            >
              {msg.role === "assistant" && (
                <div className="w-8 h-8 rounded-xl bg-gradient-base flex items-center justify-center flex-shrink-0 mt-1">
                  <Zap className="w-4 h-4 text-white" />
                </div>
              )}

              <div
                className={cn(
                  "max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed",
                  msg.role === "user"
                    ? "bg-base-blue text-white rounded-tr-sm"
                    : "bg-bg-secondary border border-border text-text-primary rounded-tl-sm"
                )}
              >
                <div className="whitespace-pre-wrap">{msg.content}</div>
              </div>

              {msg.role === "user" && (
                <div className="w-8 h-8 rounded-xl bg-bg-tertiary border border-border
                                flex items-center justify-center flex-shrink-0 mt-1">
                  <User className="w-4 h-4 text-text-secondary" />
                </div>
              )}
            </motion.div>
          ))}
        </AnimatePresence>

        {/* Typing indicator */}
        {isLoading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex gap-3"
          >
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

        <div ref={endRef} />
      </div>

      {/* ── Input bar ── */}
      <div className="p-4 border-t border-border">
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
            {isLoading
              ? <Loader2 className="w-4 h-4 animate-spin" />
              : <Send className="w-4 h-4" />
            }
          </button>
        </form>
        <p className="text-xs text-text-muted text-center mt-2">
          $0.01 USDC per query via x402 · Informational only — always DYOR.
        </p>
      </div>
    </div>
  );
}

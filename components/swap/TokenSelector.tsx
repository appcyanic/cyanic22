"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, X, ChevronDown } from "lucide-react";
import { useAccount, usePublicClient } from "wagmi";
import { formatUnits, erc20Abi } from "viem";
import { TokenLogo } from "@/components/ui/TokenLogo";
import { POPULAR_TOKENS, BASE_TOKENS } from "@/lib/tokens";
import type { Token } from "@/types/token";
import { cn } from "@/lib/utils";

const NATIVE_ETH = "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee";

interface TokenSelectorProps {
  value?: Token;
  onChange: (token: Token) => void;
  excludeToken?: Token;
  balance?: string;
  className?: string;
}

export function TokenSelector({
  value,
  onChange,
  excludeToken,
  balance,
  className,
}: TokenSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [tokens, setTokens] = useState<Token[]>(Object.values(BASE_TOKENS));
  const [balances, setBalances] = useState<Record<string, string>>({});
  const inputRef = useRef<HTMLInputElement>(null);

  const { address } = useAccount();
  const publicClient = usePublicClient();

  useEffect(() => {
    if (isOpen && inputRef.current) inputRef.current.focus();
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") setIsOpen(false); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isOpen]);

  useEffect(() => {
    const fetchTokens = async () => {
      try {
        const res = await fetch(`/api/tokens${query ? `?q=${query}` : ""}`);
        if (res.ok) {
          const data = await res.json();
          setTokens(data.tokens);
        }
      } catch {
        setTokens(Object.values(BASE_TOKENS));
      }
    };
    const timer = setTimeout(fetchTokens, 300);
    return () => clearTimeout(timer);
  }, [query]);

  // Fetch balances when modal opens
  useEffect(() => {
    if (!isOpen || !address || !publicClient) return;

    const fetchBalances = async () => {
      const allTokens = Object.values(BASE_TOKENS);
      const results: Record<string, string> = {};

      await Promise.all(allTokens.map(async (token) => {
        try {
          if (token.address.toLowerCase() === NATIVE_ETH) {
            const bal = await publicClient.getBalance({ address });
            const formatted = parseFloat(formatUnits(bal, 18));
            results[token.address.toLowerCase()] = formatted > 0 ? formatted.toFixed(4) : "0.00";
          } else {
            const bal = await publicClient.readContract({
              address: token.address as `0x${string}`,
              abi: erc20Abi,
              functionName: "balanceOf",
              args: [address],
            });
            const formatted = parseFloat(formatUnits(bal as bigint, token.decimals));
            results[token.address.toLowerCase()] = formatted > 0 ? formatted.toFixed(4) : "0.00";
          }
        } catch { /* skip */ }
      }));

      setBalances(results);
    };

    fetchBalances();
  }, [isOpen, address, publicClient]);

  const filtered = tokens.filter(
    (t) =>
      t.address.toLowerCase() !==
      excludeToken?.address?.toLowerCase()
  );

  const popular = POPULAR_TOKENS.filter(
    (t) =>
      t.address.toLowerCase() !== excludeToken?.address?.toLowerCase()
  );

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className={cn(
          "flex items-center gap-2 px-3 py-2 rounded-xl border border-border bg-bg-tertiary hover:border-border-hover transition-all",
          className
        )}
      >
        {value ? (
          <>
            <TokenLogo
              symbol={value.symbol}
              logoURI={value.logoURI}
              size={24}
            />
            <span className="font-semibold text-text-primary">{value.symbol}</span>
          </>
        ) : (
          <span className="font-semibold text-text-secondary">Select token</span>
        )}
        <ChevronDown className="w-4 h-4 text-text-muted ml-1" />
      </button>

      <AnimatePresence>
        {isOpen && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/70 backdrop-blur-sm"
              onClick={() => setIsOpen(false)}
            />

            {/* Modal — bottom sheet on mobile, centered on desktop */}
            <motion.div
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 40 }}
              transition={{ type: "spring", duration: 0.35, bounce: 0.1 }}
              className="relative w-full max-w-md glass-card overflow-hidden flex flex-col
                         rounded-t-2xl sm:rounded-2xl"
              style={{ maxHeight: "90dvh" }}
            >
              {/* Header */}
              <div className="flex items-center justify-between p-4 border-b border-border">
                <h2 className="font-semibold text-text-primary">Select Token</h2>
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-1.5 rounded-lg hover:bg-bg-tertiary transition-all"
                >
                  <X className="w-4 h-4 text-text-secondary" />
                </button>
              </div>

              {/* Search */}
              <div className="p-4 border-b border-border">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
                  <input
                    ref={inputRef}
                    type="text"
                    placeholder="Search name or paste address"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    className="input-base w-full pl-9 pr-4 py-2.5 text-sm"
                  />
                </div>
              </div>

              {/* Popular tokens */}
              {!query && (
                <div className="p-4 border-b border-border">
                  <p className="text-xs text-text-muted mb-3 font-medium uppercase tracking-wide">
                    Popular
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {popular.map((token) => (
                      <button
                        key={token.address}
                        onClick={() => {
                          onChange(token);
                          setIsOpen(false);
                          setQuery("");
                        }}
                        className="flex items-center gap-1.5 px-3 py-2.5 rounded-full border border-border bg-bg-tertiary hover:border-base-blue/50 hover:bg-base-blue/10 transition-all text-sm min-h-[44px]"
                      >
                        <TokenLogo symbol={token.symbol} logoURI={token.logoURI} size={16} />
                        <span className="font-medium">{token.symbol}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Token list */}
              <div className="overflow-y-auto flex-1 min-h-0 pb-safe"
                   style={{ maxHeight: "45dvh" }}>
                {filtered.length === 0 ? (
                  <div className="p-8 text-center text-text-muted text-sm">
                    No tokens found
                  </div>
                ) : (
                  filtered.slice(0, 50).map((token) => {
                    const tokenBal = balances[token.address.toLowerCase()];
                    return (
                      <button
                        key={token.address}
                        onClick={() => {
                          onChange(token);
                          setIsOpen(false);
                          setQuery("");
                        }}
                        className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-bg-secondary transition-all group min-h-[56px]"
                      >
                        <TokenLogo symbol={token.symbol} logoURI={token.logoURI} size={36} />
                        <div className="flex-1 text-left">
                          <div className="font-semibold text-text-primary group-hover:text-white">
                            {token.symbol}
                          </div>
                          <div className="text-xs text-text-muted truncate max-w-[200px]">
                            {token.name}
                          </div>
                        </div>
                        {tokenBal !== undefined && (
                          <div className={`text-sm font-mono ${tokenBal === "0.00" ? "text-text-muted" : "text-text-secondary"}`}>
                            {tokenBal}
                          </div>
                        )}
                      </button>
                    );
                  })
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}

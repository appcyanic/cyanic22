"use client";

import { useState } from "react";
import { ExternalLink, ChevronLeft, ChevronRight } from "lucide-react";
import { RankBadge, LevelBadge } from "./RankBadge";
import { shortenAddress } from "@/lib/utils";
import { formatXP } from "@/lib/points";
import type { LeaderboardEntry } from "@/types/reward";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 10;

interface LeaderboardTableProps {
  data: LeaderboardEntry[];
  currentWallet?: string;
  isLoading?: boolean;
}

export function LeaderboardTable({ data, currentWallet, isLoading }: LeaderboardTableProps) {
  const [page, setPage] = useState(1);

  /* ── Loading skeleton ── */
  if (isLoading) {
    return (
      <div className="space-y-0.5">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="glass-card px-3 py-2 flex items-center gap-3">
            <div className="shimmer w-5 h-3 rounded flex-shrink-0" />
            <div className="flex-1 flex items-center gap-2">
              <div className="shimmer h-3 w-28 rounded" />
              <div className="shimmer h-4 w-14 rounded-full" />
            </div>
            <div className="shimmer w-10 h-3 rounded" />
          </div>
        ))}
      </div>
    );
  }

  /* ── Empty state ── */
  if (data.length === 0) {
    return (
      <div className="glass-card p-10 text-center">
        <p className="text-text-muted text-sm">No data yet — be the first to swap!</p>
      </div>
    );
  }

  const totalPages = Math.ceil(data.length / PAGE_SIZE);
  const start      = (page - 1) * PAGE_SIZE;
  const visible    = data.slice(start, start + PAGE_SIZE);

  /* build page number list with ellipsis: 1 … 4 5 6 … 12 */
  const getPageNumbers = (): (number | "…")[] => {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
    const pages: (number | "…")[] = [1];
    if (page > 3) pages.push("…");
    for (let p = Math.max(2, page - 1); p <= Math.min(totalPages - 1, page + 1); p++) {
      pages.push(p);
    }
    if (page < totalPages - 2) pages.push("…");
    pages.push(totalPages);
    return pages;
  };

  return (
    <div>
      {/* Header row */}
      <div className="flex items-center gap-3 px-3 pb-2 text-xs text-text-muted font-medium uppercase tracking-wide">
        <span className="w-6 flex-shrink-0 text-center">#</span>
        <span className="flex-1">Trader</span>
        <span className="flex-shrink-0">XP</span>
      </div>

      <div className="space-y-0.5">
        {visible.map((entry) => {
          const isMe = entry.wallet_address.toLowerCase() === currentWallet?.toLowerCase();
          return (
            <div
              key={entry.wallet_address}
              className={cn(
                "glass-card px-3 py-2 flex items-center gap-2 transition-all",
                isMe && "border-base-blue/40 bg-base-blue/5"
              )}
            >
              {/* Rank */}
              <div className="w-5 flex-shrink-0 flex items-center justify-center">
                <RankBadge rank={entry.rank} />
              </div>

              {/* Wallet + level */}
              <div className="flex-1 min-w-0 flex items-center gap-1.5 overflow-hidden">
                <span className="font-semibold font-mono text-xs sm:text-sm text-text-primary truncate">
                  {entry.ens_name || shortenAddress(entry.wallet_address)}
                </span>
                {isMe && (
                  <span className="text-xs px-1.5 py-0.5 rounded-full bg-base-blue/20 text-base-blue font-medium flex-shrink-0">
                    You
                  </span>
                )}
                <LevelBadge level={entry.level as import("@/types/reward").Level} />
                <a
                  href={`https://basescan.org/address/${entry.wallet_address}`}
                  target="_blank" rel="noopener noreferrer"
                  className="text-text-muted hover:text-text-secondary transition-colors flex-shrink-0 ml-auto p-0.5"
                >
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>

              {/* XP */}
              <div className="text-right flex-shrink-0">
                <span className="text-xs sm:text-sm font-bold gradient-text font-mono">
                  {formatXP(entry.total_xp)}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Pagination ── */}
      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-center gap-1">
          {/* Prev */}
          <button
            onClick={() => setPage(p => p - 1)}
            disabled={page === 1}
            className="w-8 h-8 flex items-center justify-center rounded-lg border border-border
                       text-text-muted hover:text-text-primary hover:border-border-hover
                       disabled:opacity-30 disabled:cursor-not-allowed transition-all"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>

          {/* Page numbers */}
          {getPageNumbers().map((p, i) =>
            p === "…" ? (
              <span key={`ellipsis-${i}`} className="w-8 h-8 flex items-center justify-center text-xs text-text-muted">
                …
              </span>
            ) : (
              <button
                key={p}
                onClick={() => setPage(p)}
                className={cn(
                  "w-8 h-8 flex items-center justify-center rounded-lg text-xs font-semibold transition-all",
                  p === page
                    ? "bg-base-blue text-white border border-base-blue"
                    : "border border-border text-text-muted hover:text-text-primary hover:border-border-hover"
                )}
              >
                {p}
              </button>
            )
          )}

          {/* Next */}
          <button
            onClick={() => setPage(p => p + 1)}
            disabled={page === totalPages}
            className="w-8 h-8 flex items-center justify-center rounded-lg border border-border
                       text-text-muted hover:text-text-primary hover:border-border-hover
                       disabled:opacity-30 disabled:cursor-not-allowed transition-all"
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Page info */}
      {totalPages > 1 && (
        <p className="mt-2 text-center text-xs text-text-muted">
          {start + 1}–{Math.min(start + PAGE_SIZE, data.length)} / {data.length} traders
        </p>
      )}
    </div>
  );
}

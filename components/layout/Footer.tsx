import Link from "next/link";

export function Footer() {
  return (
    <footer className="border-t border-border bg-bg-primary mt-auto hidden md:block">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-5">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">

          {/* Logo */}
          <div className="flex items-center gap-2">
            <img src="/logo.png" alt="Cyanic" className="w-6 h-6 rounded-lg object-cover" />
            <span className="font-bold gradient-text">Cyanic</span>
            <span className="text-text-muted text-sm">DEX Aggregator on Base</span>
          </div>

          {/* Nav links */}
          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-sm text-text-secondary">
            <Link href="/swap"        className="py-1 px-1 hover:text-text-primary transition-colors">Swap</Link>
            <Link href="/bridge"      className="py-1 px-1 hover:text-text-primary transition-colors">Bridge</Link>
            <Link href="/agent"       className="py-1 px-1 hover:text-text-primary transition-colors">AI Agent</Link>
            <Link href="/stats"       className="py-1 px-1 hover:text-text-primary transition-colors">Stats</Link>
            <Link href="/leaderboard" className="py-1 px-1 hover:text-text-primary transition-colors">Leaderboard</Link>
            <a href="https://basescan.org" target="_blank" rel="noopener noreferrer"
               className="py-1 px-1 hover:text-text-primary transition-colors">Explorer ↗</a>
          </div>

          {/* Right */}
          <div className="flex flex-col items-end gap-1">
            <p className="text-text-muted text-xs">
              Built on{" "}
              <a href="https://base.org" target="_blank" rel="noopener noreferrer"
                 className="text-base-blue hover:underline">Base</a>
            </p>
            <p className="text-text-muted text-xs">
              Not financial advice. Always DYOR.
            </p>
          </div>

        </div>
      </div>
    </footer>
  );
}

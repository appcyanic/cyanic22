import Link from "next/link";

function XIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.748l7.73-8.835L2.25 2.25h6.218l4.253 5.622 5.523-5.622Zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

function GitHubIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0 1 12 6.844a9.59 9.59 0 0 1 2.504.337c1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.02 10.02 0 0 0 22 12.017C22 6.484 17.522 2 12 2z" />
    </svg>
  );
}

const SOCIAL_LINKS = [
  {
    href: "https://home.cyanic.app",
    label: "Home",
    icon: (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M3 9.75L12 3l9 6.75V21a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9.75z" />
        <path d="M9 22V12h6v10" />
      </svg>
    ),
  },
  {
    href: "https://x.com/appcyanic",
    label: "X (Twitter)",
    icon: <XIcon className="w-5 h-5" />,
  },
  {
    href: "https://github.com/appcyanic/cyanic22",
    label: "GitHub",
    icon: <GitHubIcon className="w-5 h-5" />,
  },
];

export function Footer() {
  return (
    <>
      {/* Desktop floating social dock — fixed bottom right */}
      <div className="hidden md:flex fixed bottom-6 right-6 z-50 flex-col gap-2">
        {SOCIAL_LINKS.map((link) => (
          <a
            key={link.href}
            href={link.href}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={link.label}
            className="w-10 h-10 flex items-center justify-center rounded-2xl border text-text-muted hover:text-text-primary active:scale-95 transition-all"
            style={{
              background: "var(--bg-secondary)",
              borderColor: "var(--border)",
              boxShadow: "0 2px 12px rgba(0,0,0,0.3)",
            }}
          >
            {link.icon}
          </a>
        ))}
      </div>

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
          <div className="flex flex-col items-end gap-3">
            {/* Social dock */}
            <div className="flex items-center gap-2">
              {SOCIAL_LINKS.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={link.label}
                  className="w-9 h-9 flex items-center justify-center rounded-xl border border-border text-text-muted hover:text-text-primary hover:bg-bg-secondary hover:border-base-blue/40 transition-all"
                  style={{ borderColor: "var(--border)", background: "var(--bg-secondary)" }}
                >
                  {link.icon}
                </a>
              ))}
            </div>

            <div className="flex flex-col items-end gap-1">
              <p className="text-text-muted text-xs">
                Built on{" "}
                <a href="https://base.org" target="_blank" rel="noopener noreferrer"
                   className="text-base-blue hover:underline">Base</a>{" "}
                · Powered by{" "}
                <a href="https://0x.org" target="_blank" rel="noopener noreferrer"
                   className="text-base-blue hover:underline">0x Protocol</a>
              </p>
              <p className="text-text-muted text-xs opacity-60">Not financial advice · Always DYOR</p>
            </div>
          </div>

        </div>
      </div>
    </footer>
    </>
  );
}

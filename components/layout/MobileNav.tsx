"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Zap, Bot, Trophy, User, ArrowLeftRight, Home } from "lucide-react";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/swap",        label: "Swap",   icon: Zap            },
  { href: "/bridge",      label: "Bridge", icon: ArrowLeftRight },
  { href: "/agent",       label: "AI",     icon: Bot            },
  { href: "/leaderboard", label: "Ranks",  icon: Trophy         },
  { href: "/profile",     label: "Profile",icon: User           },
];

function XIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.748l7.73-8.835L2.25 2.25h6.218l4.253 5.622 5.523-5.622Zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

function GitHubIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0 1 12 6.844a9.59 9.59 0 0 1 2.504.337c1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.02 10.02 0 0 0 22 12.017C22 6.484 17.522 2 12 2z" />
    </svg>
  );
}

const SOCIAL_DOCK = [
  {
    href: "https://home.cyanic.app",
    label: "Home",
    icon: <Home className="w-4 h-4" />,
  },
  {
    href: "https://x.com/appcyanic",
    label: "X",
    icon: <XIcon />,
  },
  {
    href: "https://github.com/appcyanic/cyanic",
    label: "GitHub",
    icon: <GitHubIcon />,
  },
];

export function MobileNav() {
  const pathname = usePathname();

  return (
    <>
      {/* Social dock — floating above nav */}
      <div
        className="fixed bottom-20 right-4 z-50 md:hidden flex flex-col gap-2"
        style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
      >
        {SOCIAL_DOCK.map((item) => (
          <a
            key={item.href}
            href={item.href}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={item.label}
            className="w-10 h-10 flex items-center justify-center rounded-2xl border text-text-muted hover:text-text-primary active:scale-95 transition-all"
            style={{
              background: "var(--bg-secondary)",
              borderColor: "var(--border)",
              boxShadow: "0 2px 12px rgba(0,0,0,0.3)",
            }}
          >
            {item.icon}
          </a>
        ))}
      </div>

      {/* Bottom nav */}
      <nav
        className="fixed bottom-0 left-0 right-0 z-50 md:hidden"
        style={{
          background: "var(--bg-primary)",
          borderTop: "1px solid var(--border)",
          paddingBottom: "env(safe-area-inset-bottom, 0px)",
        }}
      >
        <div className="flex items-stretch h-16">
          {TABS.map(tab => {
            const Icon     = tab.icon;
            const isActive = pathname === tab.href || pathname.startsWith(tab.href + "/");
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={cn(
                  "flex-1 flex flex-col items-center justify-center gap-0.5 transition-all relative",
                  isActive ? "text-base-blue" : "text-text-muted hover:text-text-secondary"
                )}
              >
                {isActive && (
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 rounded-full bg-base-blue" />
                )}
                <div className={cn(
                  "p-1.5 rounded-xl transition-all",
                  isActive && "bg-base-blue/15"
                )}>
                  <Icon className={cn("w-5 h-5", isActive && "text-base-blue")} />
                </div>
                <span className={cn(
                  "text-xs font-medium leading-none",
                  isActive ? "text-base-blue" : "text-text-muted"
                )}>
                  {tab.label}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}

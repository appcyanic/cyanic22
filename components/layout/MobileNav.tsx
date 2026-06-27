"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Zap, Bot, BarChart2, Trophy, User } from "lucide-react";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/stats",       label: "Stats",       icon: BarChart2 },
  { href: "/agent",       label: "AI",          icon: Bot       },
  { href: "/swap",        label: "Swap",        icon: Zap       },
  { href: "/leaderboard", label: "Leaderboard", icon: Trophy    },
  { href: "/profile",     label: "Profile",     icon: User      },
];

export function MobileNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden"
         style={{
           background: "var(--bg-primary)",
           borderTop: "1px solid var(--border)",
           paddingBottom: "env(safe-area-inset-bottom, 0px)",
         }}>
      <div className="flex items-stretch h-16">
        {TABS.map(tab => {
          const Icon     = tab.icon;
          const isActive = pathname === tab.href || pathname.startsWith(tab.href + "/");
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                "flex-1 flex flex-col items-center justify-center gap-0.5 transition-all",
                isActive ? "text-base-blue" : "text-text-muted hover:text-text-secondary"
              )}
            >
              <div className={cn(
                "p-1.5 rounded-xl transition-all",
                isActive && "bg-base-blue/10"
              )}>
                <Icon className="w-5 h-5" />
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
  );
}

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { ConnectButton } from "@/components/ui/ConnectButton";
import { NetworkBadge }  from "@/components/ui/NetworkBadge";
import { cn } from "@/lib/utils";
import { Zap, Sun, Moon } from "lucide-react";

const NAV_LINKS = [
  { href: "/swap",        label: "Swap" },
  { href: "/bridge",      label: "Bridge" },
  { href: "/agent",       label: "AI Agent" },
  { href: "/stats",       label: "Stats" },
  { href: "/leaderboard", label: "Leaderboard" },
  { href: "/profile",     label: "Profile" },
];

export function Navbar() {
  const pathname = usePathname();
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  const isLight = mounted && resolvedTheme === "light";

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 border-b border-border bg-bg-primary/80 backdrop-blur-xl"
         style={{ borderColor: "var(--border)" }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-16">

          {/* Logo */}
          <Link href="/swap" className="flex items-center gap-2 group">
            <img src="/logo.png" alt="Cyanic" className="w-8 h-8 rounded-xl object-cover" />
            <span className="font-bold text-lg gradient-text">Cyanic</span>
          </Link>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-1">
            {NAV_LINKS.map((link) => {
              const isActive = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={cn(
                    "relative px-3 py-1.5 text-sm font-medium rounded-lg transition-all",
                    isActive
                      ? "text-white bg-base-blue/20"
                      : "text-text-secondary hover:text-text-primary hover:bg-bg-secondary"
                  )}
                >
                  {link.label}
                  {isActive && (
                    <motion.div
                      layoutId="nav-indicator"
                      className="absolute bottom-0 left-1/2 -translate-x-1/2 w-4 h-0.5 rounded-full bg-base-blue"
                    />
                  )}
                </Link>
              );
            })}
          </div>

          {/* Right side */}
          <div className="flex items-center gap-2">
            <NetworkBadge className="hidden sm:flex" />

            {/* Theme toggle — hidden on mobile */}
            <button
              onClick={() => setTheme(isLight ? "dark" : "light")}
              className="hidden sm:flex w-8 h-8 rounded-lg items-center justify-center transition-all hover:bg-bg-secondary border border-border"
              title={isLight ? "Switch to dark mode" : "Switch to light mode"}
              style={{ borderColor: "var(--border)" }}
            >
              {mounted
                ? isLight
                  ? <Moon className="w-4 h-4 text-text-secondary" />
                  : <Sun  className="w-4 h-4 text-text-secondary" />
                : <Sun className="w-4 h-4 text-text-secondary opacity-0" />
              }
            </button>

            <ConnectButton />
          </div>
        </div>
      </div>

    </nav>
  );
}

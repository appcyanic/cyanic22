"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider } from "wagmi";
import { RainbowKitProvider, darkTheme, lightTheme } from "@rainbow-me/rainbowkit";
import { ThemeProvider, useTheme } from "next-themes";
import { useState, useEffect } from "react";
import { wagmiConfig } from "@/lib/wagmi";
import { Toaster } from "sonner";
import { base } from "wagmi/chains";

import "@rainbow-me/rainbowkit/styles.css";

/* Inner component — reads theme after hydration */
function RainbowWrapper({ children }: { children: React.ReactNode }) {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  // Use dark theme until mounted to avoid hydration mismatch
  const isDark = !mounted || resolvedTheme !== "light";

  return (
    <RainbowKitProvider
      initialChain={base}
      theme={
        isDark
          ? darkTheme({
              accentColor: "#0052FF",
              accentColorForeground: "white",
              borderRadius: "medium",
              fontStack: "system",
              overlayBlur: "small",
            })
          : lightTheme({
              accentColor: "#0052FF",
              accentColorForeground: "white",
              borderRadius: "medium",
              fontStack: "system",
              overlayBlur: "small",
            })
      }
      appInfo={{ appName: "Cyanic DEX Aggregator" }}
    >
      {children}
    </RainbowKitProvider>
  );
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: { queries: { staleTime: 10_000, retry: 2 } },
      })
  );

  return (
    <ThemeProvider
      attribute="class"             /* adds "dark" or "light" class to <html> */
      defaultTheme="dark"
      enableSystem={false}
      disableTransitionOnChange={false}
    >
      <WagmiProvider config={wagmiConfig}>
        <QueryClientProvider client={queryClient}>
          <RainbowWrapper>
            {children}
            <Toaster
              position="bottom-right"
              toastOptions={{
                style: {
                  background: "var(--bg-secondary)",
                  border: "1px solid var(--border)",
                  color: "var(--text-primary)",
                },
              }}
            />
          </RainbowWrapper>
        </QueryClientProvider>
      </WagmiProvider>
    </ThemeProvider>
  );
}

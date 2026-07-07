import type { Metadata } from "next";
import { Providers } from "./providers";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { MobileNav } from "@/components/layout/MobileNav";
import BlockchainBackground from "@/components/ui/BlockchainBackground";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000"),
  title: "Cyanic — DEX Aggregator on Base",
  description:
    "Get the best swap prices across Uniswap V3, Aerodrome, SushiSwap and more on Base. Powered by 0x Protocol with AI-assisted trading.",
  keywords: ["DEX", "Base", "Swap", "Aggregator", "DeFi", "Uniswap", "Aerodrome", "Cyanic"],
  icons: {
    icon: "/logo.png",
    apple: "/logo.png",
  },
  openGraph: {
    title: "Cyanic DEX Aggregator",
    description: "Best swap prices on Base. Powered by 0x + AI.",
    type: "website",
    images: ["/logo.png"],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning className="dark">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <meta name="base:app_id" content="6a4d4c983a65b36dbdf77e89" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-screen flex flex-col bg-bg-primary">
        <Providers>
          <BlockchainBackground />
          <Navbar />
          <main className="flex-1 pt-16 pb-16 md:pb-0 overscroll-none" style={{ position: "relative", zIndex: 1 }}>
            {children}
          </main>
          <MobileNav />
          <Footer />
        </Providers>
      </body>
    </html>
  );
}

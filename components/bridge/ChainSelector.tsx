"use client";

import { useState } from "react";
import { X, Check } from "lucide-react";
import { useBalance } from "wagmi";
import { useAccount } from "wagmi";
import { formatUnits } from "viem";
import { SUPPORTED_CHAINS } from "@/lib/bridgeChains";
import { cn } from "@/lib/utils";

interface ChainLogoProps {
  logoURI?: string;
  icon: string;
  name: string;
  size?: number;
}

export function ChainLogo({ logoURI, icon, name, size = 24 }: ChainLogoProps) {
  const [err, setErr] = useState(false);
  if (logoURI && !err) {
    return (
      <img src={logoURI} alt={name} width={size} height={size}
           className="rounded-full object-cover flex-shrink-0"
           style={{ width: size, height: size }}
           onError={() => setErr(true)} />
    );
  }
  return (
    <div className="flex items-center justify-center rounded-full bg-bg-tertiary flex-shrink-0"
         style={{ width: size, height: size, fontSize: size * 0.55 }}>
      {icon}
    </div>
  );
}

// Per-chain balance display
function ChainBalance({ chainId }: { chainId: number }) {
  const { address } = useAccount();
  const { data } = useBalance({
    address,
    chainId,
    query: { enabled: !!address, staleTime: 10_000 },
  });

  if (!address || !data) return null;
  const formatted = Number(formatUnits(data.value, data.decimals)).toFixed(4);
  return (
    <span className="text-xs text-text-muted font-mono ml-auto">
      {formatted} {data.symbol}
    </span>
  );
}

interface ChainSelectorProps {
  value: number;
  onChange: (chainId: number) => void;
  exclude?: number[];
  onClose?: () => void;
}

export function ChainSelector({ value, onChange, exclude = [], onClose }: ChainSelectorProps) {
  const options = SUPPORTED_CHAINS.filter(c => !exclude.includes(c.id));

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3.5 border-b border-border">
        <span className="text-sm font-semibold text-text-primary">Select Network</span>
        {onClose && (
          <button onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-bg-tertiary transition-all">
            <X className="w-4 h-4 text-text-muted" />
          </button>
        )}
      </div>

      {/* Chain list */}
      <div className="py-1.5 overflow-y-auto" style={{ maxHeight: "60dvh" }}>
        {options.map(chain => {
          const isActive = chain.id === value;
          return (
            <button
              key={chain.id}
              onClick={() => onChange(chain.id)}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-3 transition-all hover:bg-bg-tertiary",
                isActive && "bg-base-blue/8"
              )}
            >
              <ChainLogo logoURI={chain.logoURI} icon={chain.icon} name={chain.name} size={28} />
              <div className="flex-1 text-left min-w-0">
                <div className={cn("text-sm font-semibold", isActive ? "text-base-blue" : "text-text-primary")}>
                  {chain.name}
                </div>
                <ChainBalance chainId={chain.id} />
              </div>
              {isActive && <Check className="w-4 h-4 text-base-blue flex-shrink-0" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}

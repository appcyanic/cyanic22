import { AgentChat } from "@/components/agent/AgentChat";
import { Metadata } from "next";
import { Sparkles } from "lucide-react";

export const metadata: Metadata = {
  title: "AI Agent — Cyanic",
  description: "AI-powered DeFi assistant for Base",
};

export default function AgentPage() {
  return (
    <div className="h-[calc(100dvh-4rem)] flex flex-col overflow-hidden">
      {/* Background */}
      <div
        className="fixed top-1/3 right-1/4 w-[400px] h-[400px] pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse at center, rgba(0,82,255,0.05) 0%, transparent 70%)",
        }}
      />

      {/* Header */}
      <div className="border-b border-border bg-bg-primary/80 backdrop-blur-xl">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-base flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="font-bold text-text-primary">Cyanic AI Agent</h1>
              <p className="text-xs text-text-muted">
                DeFi assistant for Base
              </p>
            </div>
            <div className="ml-auto flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-success/30 bg-success/10">
              <div className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
              <span className="text-xs text-success font-medium">Online</span>
            </div>
          </div>
        </div>
      </div>

      {/* Chat area — fills remaining height, input stays at bottom */}
      <div className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 flex flex-col min-h-0 pb-16 md:pb-0">
        <AgentChat />
      </div>
    </div>
  );
}

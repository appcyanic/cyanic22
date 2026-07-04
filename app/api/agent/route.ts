import { streamText } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { NextRequest, NextResponse } from "next/server";

const openrouter = createOpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: process.env.OPENROUTER_API_KEY ?? "",
  headers: {
    "HTTP-Referer": process.env.NEXT_PUBLIC_BASE_URL ?? "https://cyanic.vercel.app",
    "X-Title": "Cyanic DEX Aggregator",
  },
});

// Use Upstash Redis if configured, otherwise fallback to in-memory
const RATE_LIMIT = 20;
const WINDOW_MS  = 60_000;

// In-memory fallback (per cold start)
const memStore = new Map<string, { count: number; resetAt: number }>();

async function checkRateLimit(key: string): Promise<{ allowed: boolean; remaining: number }> {
  // Try Upstash Redis first
  const url   = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (url && token) {
    try {
      const redisKey = `rl:agent:${key}`;
      // INCR + EXPIRE via pipeline
      const res = await fetch(`${url}/pipeline`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify([
          ["INCR", redisKey],
          ["EXPIRE", redisKey, 60],
        ]),
      });
      const data: [{ result: number }, { result: number }] = await res.json();
      const count = data[0].result;
      const remaining = Math.max(0, RATE_LIMIT - count);
      return { allowed: count <= RATE_LIMIT, remaining };
    } catch { /* fall through to in-memory */ }
  }

  // In-memory fallback
  const now   = Date.now();
  const entry = memStore.get(key);
  if (!entry || entry.resetAt < now) {
    memStore.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return { allowed: true, remaining: RATE_LIMIT - 1 };
  }
  if (entry.count >= RATE_LIMIT) return { allowed: false, remaining: 0 };
  entry.count += 1;
  return { allowed: true, remaining: RATE_LIMIT - entry.count };
}

const systemPrompt = `You are the AI assistant for "Cyanic", a DEX Aggregator running on the Base blockchain network.
You help users with token swaps, DeFi strategies, portfolio analysis, and everything about the Base ecosystem.

Core knowledge:
- Base Mainnet Chain ID: 8453
- Key DEXs: Uniswap V3, Aerodrome Finance, SushiSwap, PancakeSwap
- Swap aggregator: 0x Protocol v2 (Permit2)
- Key tokens: ETH, USDC, WETH, cbETH, USDT, BRETT, DEGEN, AERO
- Block explorer: basescan.org

LANGUAGE RULE:
- If the user writes in English, respond in English.
- If the user writes in Turkish, respond in Turkish.
- Match the user's language naturally in every response.

Response rules:
- Keep answers short, clear and actionable (max 3-4 paragraphs)
- When price estimates are needed, clarify that real-time data is required
- Always include relevant DeFi risk warnings (impermanent loss, slippage, smart contract risk)
- Never give definitive investment advice
- Use clear formatting with bullet points when listing multiple items`;

export async function POST(req: NextRequest): Promise<NextResponse> {
  // Rate limiting
  const xff = req.headers.get("x-forwarded-for");
  const ip  = xff ? xff.split(",")[0].trim() : "unknown";
  const { allowed, remaining } = await checkRateLimit(ip);

  if (!allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please wait a moment." },
      { status: 429, headers: { "Retry-After": "60", "X-RateLimit-Remaining": "0" } }
    );
  }

  // Input validation
  let body: { messages?: unknown };
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  if (!Array.isArray(body.messages) || body.messages.length === 0) {
    return NextResponse.json({ error: "messages array required" }, { status: 400 });
  }

  const messages = (body.messages as { role: string; content: string }[])
    .slice(-20)
    .filter(m => m.role && m.content && typeof m.content === "string")
    .map(m => ({ role: m.role as "user" | "assistant", content: m.content.slice(0, 2000) }));

  const result = await streamText({
    model: openrouter("z-ai/glm-4.5"),
    system: systemPrompt,
    messages,
    maxTokens: 1024,
  });

  const response = result.toDataStreamResponse() as unknown as NextResponse;
  response.headers.set("X-RateLimit-Remaining", String(remaining));
  return response;
}

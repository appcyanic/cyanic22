import { NextRequest, NextResponse } from "next/server";

// Use Upstash Redis if configured, otherwise fallback to in-memory
const RATE_LIMIT = 20;
const WINDOW_MS  = 60_000;

// In-memory fallback (per cold start)
const memStore = new Map<string, { count: number; resetAt: number }>();

async function checkRateLimit(key: string): Promise<{ allowed: boolean; remaining: number }> {
  const url   = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (url && token) {
    try {
      const redisKey = `rl:agent:${key}`;
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

export const runtime = "nodejs";

export async function POST(req: NextRequest): Promise<NextResponse | Response> {
  const xff = req.headers.get("x-forwarded-for");
  const ip  = xff ? xff.split(",")[0].trim() : "unknown";
  const { allowed, remaining } = await checkRateLimit(ip);

  if (!allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please wait a moment." },
      { status: 429, headers: { "Retry-After": "60", "X-RateLimit-Remaining": "0" } }
    );
  }

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

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "AI service not configured" }, { status: 503 });
  }

  // Call OpenRouter with streaming
  const upstream = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": process.env.NEXT_PUBLIC_BASE_URL ?? "https://cyanic.vercel.app",
      "X-Title": "Cyanic DEX Aggregator",
    },
    body: JSON.stringify({
      model: "z-ai/glm-4.5",
      messages: [
        { role: "system", content: systemPrompt },
        ...messages,
      ],
      max_tokens: 1024,
      stream: true,
    }),
  });

  if (!upstream.ok) {
    const err = await upstream.text();
    console.error("OpenRouter error:", err);
    return NextResponse.json({ error: "AI service error" }, { status: 502 });
  }

  // Stream SSE response back to client in Vercel AI SDK data stream format
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const reader = upstream.body?.getReader();
      if (!reader) { controller.close(); return; }

      const decoder = new TextDecoder();
      let buffer = "";

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            const data = line.slice(6).trim();
            if (data === "[DONE]") continue;

            try {
              const json = JSON.parse(data);
              const text = json.choices?.[0]?.delta?.content;
              if (text) {
                // Vercel AI SDK data stream format: 0:"text chunk"\n
                controller.enqueue(encoder.encode(`0:${JSON.stringify(text)}\n`));
              }
            } catch { /* skip malformed chunks */ }
          }
        }
      } finally {
        reader.releaseLock();
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "X-Vercel-AI-Data-Stream": "v1",
      "X-RateLimit-Remaining": String(remaining),
    },
  });
}

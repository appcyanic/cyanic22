import { NextRequest, NextResponse } from "next/server";

// x402 payment is handled inside /api/agent route handler directly
// Middleware passes through to avoid Vercel Node.js runtime conflicts
export function middleware(_req: NextRequest) {
  return NextResponse.next();
}

export const config = {
  matcher: ["/api/agent"],
};

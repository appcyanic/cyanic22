import { NextRequest, NextResponse } from "next/server";

// Middleware disabled — x402 payment handled inside route handlers
export function middleware(_req: NextRequest) {
  return NextResponse.next();
}

export const config = {
  matcher: ["/api/agent-swap"],
};

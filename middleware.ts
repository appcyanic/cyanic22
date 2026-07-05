import { NextRequest, NextResponse } from "next/server";

// x402 payment is handled inside /api/agent route directly
// Middleware only passes through — no Edge/Node conflict
export function middleware(_req: NextRequest) {
  return NextResponse.next();
}

export const config = {
  matcher: ["/api/agent"],
};

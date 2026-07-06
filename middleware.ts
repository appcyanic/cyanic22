import { NextRequest, NextResponse } from "next/server";

// x402 payment middleware temporarily disabled for debugging
// Will re-enable after confirming agent works correctly
export function middleware(_req: NextRequest) {
  return NextResponse.next();
}

export const config = {
  matcher: ["/api/agent"],
};

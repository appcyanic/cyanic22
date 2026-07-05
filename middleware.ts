import { NextRequest, NextResponse } from "next/server";

// x402 payment middleware temporarily disabled — re-enable after build issue resolved
export function middleware(_req: NextRequest) {
  return NextResponse.next();
}

export const config = {
  matcher: ["/api/agent"],
};

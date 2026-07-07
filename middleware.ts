import { type NextRequest, NextResponse } from "next/server";

/**
 * Middleware — intentionally minimal to stay within the 1 MB Edge Function limit.
 *
 * x402 payment verification for /api/agent-swap is handled inside the route
 * handler itself (nodejs runtime) using x402-next's paymentMiddleware, because
 * the @coinbase/cdp-sdk dependency pulled in by x402-next exceeds the Edge
 * Function bundle size limit when imported here.
 */
export default function middleware(_request: NextRequest) {
  return NextResponse.next();
}

export const config = {
  matcher: [],
};

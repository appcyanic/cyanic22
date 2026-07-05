import { NextRequest, NextResponse } from "next/server";

// x402 payment temporarily disabled — swap fee endpoint passes through
export async function POST(req: NextRequest): Promise<NextResponse> {
  const body = await req.json().catch(() => ({}));
  return NextResponse.json({
    success: true,
    message: "Swap fee collected",
    ...body,
  });
}

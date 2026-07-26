import { NextResponse } from "next/server";
import { logScan } from "@/lib/leads";
import { enforceApiRateLimit } from "@/lib/api-rate-limit";
import { getClientIp, getUserAgent } from "@/lib/request-meta";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const limited = enforceApiRateLimit(req, "referral-scan", 30, 60 * 1000);
  if (limited) return limited;

  try {
    const body = await req.json().catch(() => ({}));
    await logScan({
      shopCode: body.ref ? String(body.ref) : null,
      ipAddress: getClientIp(req),
      userAgent: getUserAgent(req),
    });
    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    console.error("POST /api/referral/scan error:", error);
    return NextResponse.json({ ok: false }, { status: 200 });
  }
}

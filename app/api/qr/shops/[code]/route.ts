import { NextResponse } from "next/server";
import { requirePlatformOwner, isPlatformErrorResponse } from "@/lib/platform-auth";
import { getReferralStats } from "@/lib/leads";
import { loggedRoute } from "@/lib/api-observability";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function handleGet(req: Request, context: { params: Promise<{ code: string }> }) {
  const auth = await requirePlatformOwner();
  if (isPlatformErrorResponse(auth)) return auth;

  try {
    const { code } = await context.params;
    const url = new URL(req.url);
    const stats = await getReferralStats(code, {
      from: url.searchParams.get("from"),
      to: url.searchParams.get("to"),
    });
    return NextResponse.json(stats);
  } catch (error: unknown) {
    console.error("GET /api/qr/shops/[code] error:", error);
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: "تعذّر تحميل بيانات الزبون", message }, { status: 500 });
  }
}

export const GET = loggedRoute("GET /api/qr/shops/[code]", handleGet);

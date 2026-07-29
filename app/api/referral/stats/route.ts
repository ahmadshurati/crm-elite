import { NextResponse } from "next/server";
import { getReferralStats } from "@/lib/leads";
import { enforceApiRateLimit } from "@/lib/api-rate-limit";
import { getShopSession } from "@/lib/referral-auth";
import { getCurrentUser } from "@/lib/auth";
import { isPlatformOwner } from "@/lib/tenant";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const limited = enforceApiRateLimit(req, "referral-stats", 90, 60 * 1000);
  if (limited) return limited;

  try {
    const url = new URL(req.url);
    let code = "";

    const owner = await getCurrentUser().catch(() => null);
    if (owner && isPlatformOwner(owner)) {
      code = String(url.searchParams.get("shop") || "").trim();
    } else {
      const shop = await getShopSession();
      if (!shop) {
        return NextResponse.json({ error: "يجب تسجيل الدخول" }, { status: 401 });
      }
      code = shop.code;
    }

    if (!code) {
      return NextResponse.json({ error: "shop code required" }, { status: 400 });
    }

    const stats = await getReferralStats(code, {
      from: url.searchParams.get("from"),
      to: url.searchParams.get("to"),
    });
    return NextResponse.json(stats);
  } catch (error: unknown) {
    console.error("GET /api/referral/stats error:", error);
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: "تعذّر تحميل الإحصائيات", message }, { status: 500 });
  }
}

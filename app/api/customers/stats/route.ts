import { NextResponse } from "next/server";
import { loggedRoute } from "@/lib/api-observability";
import { getCustomerStats } from "@/lib/customers-data";
import { isErrorResponse, requireAnyPermission } from "@/lib/permissions";
import { requireCompanyId } from "@/lib/tenant";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function handleGet() {
  const auth = await requireAnyPermission("viewSubscribers", "viewAccounting");
  if (isErrorResponse(auth)) return auth;

  try {
    const companyId = requireCompanyId(auth.user);
    const stats = await getCustomerStats(companyId);
    return NextResponse.json(stats);
  } catch (error: any) {
    console.error("GET /api/customers/stats error:", error);
    return NextResponse.json({ error: "Failed to load stats", message: error?.message }, { status: 500 });
  }
}

export const GET = loggedRoute("GET /api/customers/stats", handleGet);

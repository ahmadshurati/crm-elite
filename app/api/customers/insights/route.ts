import { NextResponse } from "next/server";
import { getDashboardInsights } from "@/lib/dashboard-insights";
import { loggedRoute } from "@/lib/api-observability";
import { isErrorResponse, requireAnyPermission } from "@/lib/permissions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const INSIGHT_MODES = new Set([
  "active-subscribers",
  "active-customers",
  "inactive-subscribers",
  "subscriber-history",
  "renewals-this-month",
  "accounting",
]);

async function handleGet(req: Request) {
  const auth = await requireAnyPermission("viewSubscribers", "viewAccounting");
  if (isErrorResponse(auth)) return auth;

  try {
    const url = new URL(req.url);
    const filter = url.searchParams.get("filter") || "all";
    const mode = url.searchParams.get("mode") || "subscriber-history";
    const search = url.searchParams.get("q") || "";

    if (!INSIGHT_MODES.has(mode)) {
      return NextResponse.json({ error: "Invalid mode" }, { status: 400 });
    }

    const insights = await getDashboardInsights(
      filter,
      search,
      mode as Parameters<typeof getDashboardInsights>[2]
    );

    return NextResponse.json(insights);
  } catch (error: unknown) {
    console.error("GET /api/customers/insights error:", error);
    const message = error instanceof Error ? error.message : "Failed to load insights";
    return NextResponse.json({ error: "Failed to load insights", message }, { status: 500 });
  }
}

export const GET = loggedRoute("GET /api/customers/insights", handleGet);

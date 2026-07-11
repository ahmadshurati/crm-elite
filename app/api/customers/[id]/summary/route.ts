import { NextResponse } from "next/server";
import { buildCustomerSummary } from "@/lib/crm/customer-summary";
import { isErrorResponse, requirePermission } from "@/lib/permissions";
import { loggedRoute } from "@/lib/api-observability";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function handleGet(
  _req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requirePermission("viewSubscribers");
  if (isErrorResponse(auth)) return auth;

  try {
    const { id } = await context.params;
    const customerId = Number(id);

    if (!Number.isFinite(customerId) || customerId <= 0) {
      return NextResponse.json({ error: "Invalid customerId" }, { status: 400 });
    }

    const summary = await buildCustomerSummary(customerId);
    if (!summary) {
      return NextResponse.json({ error: "Customer not found" }, { status: 404 });
    }

    return NextResponse.json(summary);
  } catch (error: unknown) {
    console.error("GET /api/customers/[id]/summary error:", error);
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: "Failed to build summary", message }, { status: 500 });
  }
}

export const GET = loggedRoute("GET /api/customers/[id]/summary", handleGet);

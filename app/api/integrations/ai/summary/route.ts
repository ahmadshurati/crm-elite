import { NextResponse } from "next/server";
import { isErrorResponse, requirePermission } from "@/lib/permissions";
import { loggedRoute } from "@/lib/api-observability";
import { generateCustomerSummary } from "@/lib/integrations/ai";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function handlePost(req: Request) {
  const auth = await requirePermission("viewSubscribers");
  if (isErrorResponse(auth)) return auth;

  try {
    const body = await req.json();
    const customerId = Number(body.customerId);

    if (!Number.isFinite(customerId) || customerId <= 0) {
      return NextResponse.json({ error: "customerId is required" }, { status: 400 });
    }

    const result = await generateCustomerSummary(customerId);
    return NextResponse.json(result);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: "Failed to generate summary", message }, { status: 500 });
  }
}

export const POST = loggedRoute("POST /api/integrations/ai/summary", handlePost);

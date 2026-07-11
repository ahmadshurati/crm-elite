import { NextResponse } from "next/server";
import { isErrorResponse, requirePermission } from "@/lib/permissions";
import { loggedRoute } from "@/lib/api-observability";
import { draftCustomerEmail } from "@/lib/integrations/ai";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function handlePost(req: Request) {
  const auth = await requirePermission("editSubscribers");
  if (isErrorResponse(auth)) return auth;

  try {
    const body = await req.json();
    const customerName = String(body.customerName || "").trim();
    const purpose = String(body.purpose || "متابعة").trim();
    const context = body.context ? String(body.context) : undefined;

    if (!customerName) {
      return NextResponse.json({ error: "customerName is required" }, { status: 400 });
    }

    const result = await draftCustomerEmail({ customerName, purpose, context });
    return NextResponse.json(result);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: "Failed to draft email", message }, { status: 500 });
  }
}

export const POST = loggedRoute("POST /api/integrations/ai/draft-email", handlePost);

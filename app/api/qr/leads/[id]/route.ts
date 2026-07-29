import { NextResponse } from "next/server";
import { requirePlatformOwner, isPlatformErrorResponse } from "@/lib/platform-auth";
import { updateLeadStatus } from "@/lib/leads";
import { loggedRoute } from "@/lib/api-observability";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function handlePatch(req: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requirePlatformOwner();
  if (isPlatformErrorResponse(auth)) return auth;

  try {
    const { id } = await context.params;
    const leadId = Number(id);
    if (!Number.isFinite(leadId) || leadId <= 0) {
      return NextResponse.json({ error: "Invalid lead id" }, { status: 400 });
    }

    const body = await req.json().catch(() => ({}));
    const status = String(body.status || "").trim();

    await updateLeadStatus(leadId, status);
    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    console.error("PATCH /api/qr/leads/[id] error:", error);
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: "تعذّر تحديث الحالة", message }, { status: 400 });
  }
}

export const PATCH = loggedRoute("PATCH /api/qr/leads/[id]", handlePatch);

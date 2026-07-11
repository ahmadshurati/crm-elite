import { NextResponse } from "next/server";
import { markInboxMessageRead } from "@/lib/inbox";
import { isErrorResponse, requirePermission } from "@/lib/permissions";
import { loggedRoute } from "@/lib/api-observability";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function handlePatch(req: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requirePermission("viewSubscribers");
  if (isErrorResponse(auth)) return auth;

  const { id } = await context.params;
  const body = await req.json().catch(() => ({}));

  if (body.isRead === true || body.action === "read") {
    await markInboxMessageRead(id);
  }

  return NextResponse.json({ ok: true });
}

export const PATCH = loggedRoute("PATCH /api/inbox/[id]", handlePatch);

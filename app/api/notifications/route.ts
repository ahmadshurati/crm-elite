import { NextResponse } from "next/server";
import { countUnreadNotifications, listNotifications, markNotificationsRead } from "@/lib/crm/notifications";
import { isErrorResponse, requireUser } from "@/lib/permissions";
import { resolveCompanyId } from "@/lib/tenant";
import { loggedRoute } from "@/lib/api-observability";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function handleGet() {
  const auth = await requireUser();
  if (isErrorResponse(auth)) return auth;

  try {
    const companyId = resolveCompanyId(auth.user);
    const items = await listNotifications(auth.user.id, companyId);
    const unreadCount = items.filter((item) => !item.isRead).length;
    return NextResponse.json({ items, unreadCount });
  } catch (error: unknown) {
    console.error("GET /api/notifications error:", error);
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: "Failed to load notifications", message }, { status: 500 });
  }
}

async function handlePatch(req: Request) {
  const auth = await requireUser();
  if (isErrorResponse(auth)) return auth;

  try {
    const body = await req.json();
    const ids = Array.isArray(body.ids)
      ? body.ids.map((id: unknown) => Number(id)).filter((id: number) => Number.isFinite(id))
      : undefined;
    await markNotificationsRead(auth.user.id, ids);
    const unreadCount = await countUnreadNotifications(auth.user.id, resolveCompanyId(auth.user));
    return NextResponse.json({ ok: true, unreadCount });
  } catch (error: unknown) {
    console.error("PATCH /api/notifications error:", error);
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: "Failed to update notifications", message }, { status: 500 });
  }
}

export const GET = loggedRoute("GET /api/notifications", handleGet);
export const PATCH = loggedRoute("PATCH /api/notifications", handlePatch);

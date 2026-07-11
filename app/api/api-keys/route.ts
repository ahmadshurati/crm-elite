import { NextResponse } from "next/server";
import { createApiKey, listApiKeys, revokeApiKey } from "@/lib/api-keys";
import { writeActivityLog } from "@/lib/audit-log";
import { isErrorResponse, requireUser } from "@/lib/permissions";
import { loggedRoute } from "@/lib/api-observability";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function handleGet() {
  const auth = await requireUser();
  if (isErrorResponse(auth)) return auth;

  if (auth.user.role !== "master" && !auth.user.viewUsers) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.json(await listApiKeys());
}

async function handlePost(req: Request) {
  const auth = await requireUser();
  if (isErrorResponse(auth)) return auth;

  if (auth.user.role !== "master" && !auth.user.editUsers) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const name = String(body.name || "").trim();
  if (!name) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  const created = await createApiKey({
    name,
    scopes: Array.isArray(body.scopes) ? body.scopes.map(String) : undefined,
    createdByUserId: auth.user.id,
    expiresAt: body.expiresAt ? new Date(body.expiresAt) : null,
  });

  await writeActivityLog(auth.user, "إنشاء مفتاح API", "التكاملات", name, created.record.id);

  return NextResponse.json({
    ...created.record,
    key: created.key,
    warning: "Store this key now. It will not be shown again.",
  });
}

export const GET = loggedRoute("GET /api/api-keys", handleGet);
export const POST = loggedRoute("POST /api/api-keys", handlePost);

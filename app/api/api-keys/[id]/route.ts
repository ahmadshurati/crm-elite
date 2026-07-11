import { NextResponse } from "next/server";
import { revokeApiKey } from "@/lib/api-keys";
import { writeActivityLog } from "@/lib/audit-log";
import { isErrorResponse, requireUser } from "@/lib/permissions";
import { loggedRoute } from "@/lib/api-observability";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function handleDelete(_req: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireUser();
  if (isErrorResponse(auth)) return auth;

  if (auth.user.role !== "master" && !auth.user.editUsers) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await context.params;
  const keyId = Number(id);
  await revokeApiKey(keyId);
  await writeActivityLog(auth.user, "إلغاء مفتاح API", "التكاملات", String(keyId), keyId);

  return NextResponse.json({ ok: true });
}

export const DELETE = loggedRoute("DELETE /api/api-keys/[id]", handleDelete);

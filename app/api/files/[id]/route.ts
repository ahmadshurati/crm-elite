import { NextResponse } from "next/server";
import { writeActivityLog } from "@/lib/audit-log";
import { execute } from "@/lib/db";
import { isErrorResponse, requirePermission } from "@/lib/permissions";
import { loggedRoute } from "@/lib/api-observability";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function handleDelete(_req: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requirePermission("editSubscribers");
  if (isErrorResponse(auth)) return auth;

  const { id } = await context.params;
  await execute("DELETE FROM CrmFile WHERE id = ?", [Number(id)]);
  await writeActivityLog(auth.user, "حذف ملف", "الملفات", String(id), Number(id));

  return NextResponse.json({ ok: true });
}

export const DELETE = loggedRoute("DELETE /api/files/[id]", handleDelete);

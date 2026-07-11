import { NextResponse } from "next/server";
import { listFieldChanges } from "@/lib/field-audit";
import { isErrorResponse, requirePermission } from "@/lib/permissions";
import { loggedRoute } from "@/lib/api-observability";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function handleGet(req: Request) {
  const auth = await requirePermission("viewActivityLog");
  if (isErrorResponse(auth)) return auth;

  const url = new URL(req.url);
  const entityType = url.searchParams.get("entityType") || undefined;
  const entityId = url.searchParams.get("entityId");
  const module = url.searchParams.get("module") || undefined;
  const limit = Number(url.searchParams.get("limit") || 50);

  const rows = await listFieldChanges({
    limit,
    entityType,
    entityId: entityId != null ? Number(entityId) : undefined,
    module,
  });

  return NextResponse.json(rows);
}

export const GET = loggedRoute("GET /api/field-audit", handleGet);

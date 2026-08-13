import { NextResponse } from "next/server";
import { ensure, requireDental } from "@/lib/dental/data";
import { listAudit } from "@/lib/dental/services/staff";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const ctx = await requireDental();
  if (ctx instanceof NextResponse) return ctx;
  const denied = ensure(ctx, "audit.view");
  if (denied) return denied;
  const entityType = new URL(req.url).searchParams.get("entityType") || undefined;
  const entries = await listAudit(ctx.companyId, { entityType });
  return NextResponse.json({ entries });
}

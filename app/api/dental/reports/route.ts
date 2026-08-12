import { NextResponse } from "next/server";
import { ensure, requireDental } from "@/lib/dental/data";
import { getReports } from "@/lib/dental/services/reports";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const ctx = await requireDental();
  if (ctx instanceof NextResponse) return ctx;
  const denied = ensure(ctx, "reports.view");
  if (denied) return denied;
  const url = new URL(req.url);
  const to = url.searchParams.get("to") || new Date().toISOString().slice(0, 10);
  const from = url.searchParams.get("from") || new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString().slice(0, 10);
  const report = await getReports(ctx.companyId, from, to);
  return NextResponse.json({ ...report, from, to });
}

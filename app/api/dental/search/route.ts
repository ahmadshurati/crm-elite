import { NextResponse } from "next/server";
import { ensure, requireDental } from "@/lib/dental/data";
import { globalSearch } from "@/lib/dental/services/reports";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const ctx = await requireDental();
  if (ctx instanceof NextResponse) return ctx;
  const denied = ensure(ctx, "patients.view");
  if (denied) return denied;
  const q = new URL(req.url).searchParams.get("q") || "";
  if (q.trim().length < 2) return NextResponse.json({ patients: [], invoices: [], appointments: [] });
  const results = await globalSearch(ctx.companyId, q);
  return NextResponse.json(results);
}

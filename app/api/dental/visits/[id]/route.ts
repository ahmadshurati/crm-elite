import { NextResponse } from "next/server";
import { ensure, requireDental } from "@/lib/dental/data";
import { completeVisit, getVisitDetail, updateVisit } from "@/lib/dental/services/visits";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: Request, context: { params: Promise<{ id: string }> }) {
  const ctx = await requireDental();
  if (ctx instanceof NextResponse) return ctx;
  const denied = ensure(ctx, "patients.view");
  if (denied) return denied;
  const { id } = await context.params;
  const detail = await getVisitDetail(ctx.companyId, Number(id));
  if (!detail) return NextResponse.json({ error: "الزيارة غير موجودة" }, { status: 404 });
  return NextResponse.json(detail);
}

export async function PATCH(req: Request, context: { params: Promise<{ id: string }> }) {
  const ctx = await requireDental();
  if (ctx instanceof NextResponse) return ctx;
  const denied = ensure(ctx, "visits.manage");
  if (denied) return denied;
  const { id } = await context.params;
  const body = await req.json().catch(() => ({}));
  try {
    if (body.status === "completed") {
      await completeVisit(ctx, Number(id));
    } else {
      await updateVisit(ctx, Number(id), body);
    }
    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "تعذّر التحديث";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

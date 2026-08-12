import { NextResponse } from "next/server";
import { ensure, patientBelongs, requireDental } from "@/lib/dental/data";
import { updatePlanFinance } from "@/lib/dental/services/treatments";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(req: Request, context: { params: Promise<{ id: string }> }) {
  const ctx = await requireDental();
  if (ctx instanceof NextResponse) return ctx;
  const denied = ensure(ctx, "treatments.create");
  if (denied) return denied;
  const { id } = await context.params;
  const patientId = Number(id);
  if (!(await patientBelongs(ctx.companyId, patientId))) {
    return NextResponse.json({ error: "المريض غير موجود" }, { status: 404 });
  }
  const body = await req.json().catch(() => ({}));
  const input: { discount?: number; insurance?: number } = {};
  if (body.discount !== undefined) input.discount = Math.max(0, Number(body.discount) || 0);
  if (body.insurance !== undefined) input.insurance = Math.max(0, Number(body.insurance) || 0);
  try {
    await updatePlanFinance(ctx, patientId, input);
    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "تعذّر التحديث";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

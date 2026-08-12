import { NextResponse } from "next/server";
import { ensure, patientBelongs, requireDental } from "@/lib/dental/data";
import { addAdjustment } from "@/lib/dental/services/billing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request, context: { params: Promise<{ id: string }> }) {
  const ctx = await requireDental();
  if (ctx instanceof NextResponse) return ctx;
  const denied = ensure(ctx, "payments.create");
  if (denied) return denied;
  const { id } = await context.params;
  const patientId = Number(id);
  if (!(await patientBelongs(ctx.companyId, patientId))) {
    return NextResponse.json({ error: "المريض غير موجود" }, { status: 404 });
  }
  const body = await req.json().catch(() => ({}));
  try {
    const entryId = await addAdjustment(ctx, patientId, { type: String(body.type || "charge"), amount: Number(body.amount), reason: body.reason ? String(body.reason) : null });
    return NextResponse.json({ ok: true, id: entryId });
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "تعذّرت العملية" }, { status: 400 });
  }
}

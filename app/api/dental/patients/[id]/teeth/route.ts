import { NextResponse } from "next/server";
import { patientBelongs, requireDental, upsertToothCondition } from "@/lib/dental/data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PUT(req: Request, context: { params: Promise<{ id: string }> }) {
  const ctx = await requireDental();
  if (ctx instanceof NextResponse) return ctx;
  const { id } = await context.params;
  const patientId = Number(id);
  if (!(await patientBelongs(ctx.companyId, patientId))) {
    return NextResponse.json({ error: "المريض غير موجود" }, { status: 404 });
  }
  const body = await req.json().catch(() => ({}));
  const toothNumber = Number(body.toothNumber);
  if (!Number.isFinite(toothNumber)) {
    return NextResponse.json({ error: "رقم السن غير صحيح" }, { status: 400 });
  }
  await upsertToothCondition(ctx.companyId, patientId, toothNumber, String(body.condition || "healthy"), body.notes ? String(body.notes) : null);
  return NextResponse.json({ ok: true });
}

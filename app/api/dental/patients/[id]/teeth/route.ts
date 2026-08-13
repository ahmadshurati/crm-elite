import { NextResponse } from "next/server";
import { ensure, patientBelongs, requireDental, setToothCondition, setToothSurface } from "@/lib/dental/data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PUT(req: Request, context: { params: Promise<{ id: string }> }) {
  const ctx = await requireDental();
  if (ctx instanceof NextResponse) return ctx;
  const denied = ensure(ctx, "chart.edit");
  if (denied) return denied;
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
  const condition = String(body.condition || "healthy");
  const visitId = body.visitId != null && body.visitId !== "" ? Number(body.visitId) : null;
  try {
    if (body.surface) {
      await setToothSurface(ctx, patientId, toothNumber, String(body.surface), condition, visitId);
    } else {
      await setToothCondition(ctx, patientId, toothNumber, condition, body.notes ? String(body.notes) : null, visitId);
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("PUT /api/dental/patients/[id]/teeth error:", error);
    return NextResponse.json({ error: "تعذّر تحديث حالة السن" }, { status: 500 });
  }
}

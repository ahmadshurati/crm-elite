import { NextResponse } from "next/server";
import { addPrescription, ensure, patientBelongs, requireDental } from "@/lib/dental/data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request, context: { params: Promise<{ id: string }> }) {
  const ctx = await requireDental();
  if (ctx instanceof NextResponse) return ctx;
  const denied = ensure(ctx, "prescriptions.create");
  if (denied) return denied;
  const { id } = await context.params;
  const patientId = Number(id);
  if (!(await patientBelongs(ctx.companyId, patientId))) {
    return NextResponse.json({ error: "المريض غير موجود" }, { status: 404 });
  }
  const body = await req.json().catch(() => ({}));
  const items = Array.isArray(body.items) ? body.items : [];
  await addPrescription(ctx, patientId, {
    items,
    notes: body.notes ? String(body.notes) : null,
    visitId: body.visitId != null && body.visitId !== "" ? Number(body.visitId) : null,
    doctorName: body.doctorName ? String(body.doctorName) : null,
    diagnosis: body.diagnosis ? String(body.diagnosis) : null,
  });
  return NextResponse.json({ ok: true });
}

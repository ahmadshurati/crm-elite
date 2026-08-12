import { NextResponse } from "next/server";
import { addPayment, patientBelongs, requireDental } from "@/lib/dental/data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request, context: { params: Promise<{ id: string }> }) {
  const ctx = await requireDental();
  if (ctx instanceof NextResponse) return ctx;
  const { id } = await context.params;
  const patientId = Number(id);
  if (!(await patientBelongs(ctx.companyId, patientId))) {
    return NextResponse.json({ error: "المريض غير موجود" }, { status: 404 });
  }
  const body = await req.json().catch(() => ({}));
  const amount = Number(body.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ error: "المبلغ غير صحيح" }, { status: 400 });
  }
  await addPayment(ctx.companyId, patientId, amount, String(body.method || "cash"), body.notes ? String(body.notes) : null);
  return NextResponse.json({ ok: true });
}

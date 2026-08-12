import { NextResponse } from "next/server";
import { ensure, patientBelongs, requireDental } from "@/lib/dental/data";
import { createInstallments, listInstallments } from "@/lib/dental/services/billing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: Request, context: { params: Promise<{ id: string }> }) {
  const ctx = await requireDental();
  if (ctx instanceof NextResponse) return ctx;
  const denied = ensure(ctx, "billing.view");
  if (denied) return denied;
  const { id } = await context.params;
  const installments = await listInstallments(ctx.companyId, Number(id));
  return NextResponse.json({ installments });
}

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
    await createInstallments(ctx, patientId, { count: Number(body.count), amountEach: Number(body.amountEach), startDate: String(body.startDate), note: body.note ? String(body.note) : null });
    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "تعذّر إنشاء الأقساط" }, { status: 400 });
  }
}

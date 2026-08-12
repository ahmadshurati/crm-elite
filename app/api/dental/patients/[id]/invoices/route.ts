import { NextResponse } from "next/server";
import { ensure, patientBelongs, requireDental } from "@/lib/dental/data";
import { createInvoice, listInvoices } from "@/lib/dental/services/billing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: Request, context: { params: Promise<{ id: string }> }) {
  const ctx = await requireDental();
  if (ctx instanceof NextResponse) return ctx;
  const denied = ensure(ctx, "billing.view");
  if (denied) return denied;
  const { id } = await context.params;
  const invoices = await listInvoices(ctx.companyId, Number(id));
  return NextResponse.json({ invoices });
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
    const result = await createInvoice(ctx, patientId, { type: String(body.type || "invoice"), notes: body.notes ? String(body.notes) : null, taxCents: body.taxCents ? Number(body.taxCents) : 0 });
    return NextResponse.json({ ok: true, ...result });
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "تعذّر الإصدار" }, { status: 400 });
  }
}

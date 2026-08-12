import { NextResponse } from "next/server";
import { ensure, requireDental } from "@/lib/dental/data";
import { getInvoice } from "@/lib/dental/services/billing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: Request, context: { params: Promise<{ id: string }> }) {
  const ctx = await requireDental();
  if (ctx instanceof NextResponse) return ctx;
  const denied = ensure(ctx, "billing.view");
  if (denied) return denied;
  const { id } = await context.params;
  const invoice = await getInvoice(ctx.companyId, Number(id));
  if (!invoice) return NextResponse.json({ error: "المستند غير موجود" }, { status: 404 });
  return NextResponse.json({ ...invoice, clinicName: ctx.clinicName });
}

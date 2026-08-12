import { NextResponse } from "next/server";
import { addPlanItem, patientBelongs, requireDental } from "@/lib/dental/data";

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
  if (!String(body.treatment || "").trim()) {
    return NextResponse.json({ error: "اسم العلاج مطلوب" }, { status: 400 });
  }
  await addPlanItem(ctx.companyId, patientId, body);
  return NextResponse.json({ ok: true });
}

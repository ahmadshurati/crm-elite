import { NextResponse } from "next/server";
import { ensure, getToothPanel, patientBelongs, requireDental } from "@/lib/dental/data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: Request, context: { params: Promise<{ id: string; tooth: string }> }) {
  const ctx = await requireDental();
  if (ctx instanceof NextResponse) return ctx;
  const denied = ensure(ctx, "patients.view");
  if (denied) return denied;
  const { id, tooth } = await context.params;
  const patientId = Number(id);
  const toothNumber = Number(tooth);
  if (!(await patientBelongs(ctx.companyId, patientId))) {
    return NextResponse.json({ error: "المريض غير موجود" }, { status: 404 });
  }
  const panel = await getToothPanel(ctx.companyId, patientId, toothNumber);
  return NextResponse.json(panel);
}

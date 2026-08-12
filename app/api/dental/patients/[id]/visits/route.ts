import { NextResponse } from "next/server";
import { ensure, patientBelongs, requireDental } from "@/lib/dental/data";
import { startVisit } from "@/lib/dental/services/visits";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request, context: { params: Promise<{ id: string }> }) {
  const ctx = await requireDental();
  if (ctx instanceof NextResponse) return ctx;
  const denied = ensure(ctx, "visits.manage");
  if (denied) return denied;
  const { id } = await context.params;
  const patientId = Number(id);
  if (!(await patientBelongs(ctx.companyId, patientId))) {
    return NextResponse.json({ error: "المريض غير موجود" }, { status: 404 });
  }
  const body = await req.json().catch(() => ({}));
  try {
    const visitId = await startVisit(ctx, patientId, body);
    return NextResponse.json({ ok: true, id: visitId });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "تعذّر إنشاء الزيارة";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

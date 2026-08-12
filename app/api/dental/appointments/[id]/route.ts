import { NextResponse } from "next/server";
import { requireDental, updateAppointmentStatus } from "@/lib/dental/data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VALID = ["scheduled", "confirmed", "arrived", "waiting", "in_treatment", "completed", "cancelled", "no_show"];

export async function PATCH(req: Request, context: { params: Promise<{ id: string }> }) {
  const ctx = await requireDental();
  if (ctx instanceof NextResponse) return ctx;
  const { id } = await context.params;
  const body = await req.json().catch(() => ({}));
  const status = String(body.status || "");
  if (!VALID.includes(status)) {
    return NextResponse.json({ error: "حالة غير صحيحة" }, { status: 400 });
  }
  await updateAppointmentStatus(ctx.companyId, Number(id), status);
  return NextResponse.json({ ok: true });
}

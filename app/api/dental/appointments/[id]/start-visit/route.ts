import { NextResponse } from "next/server";
import { ensure, requireDental } from "@/lib/dental/data";
import { startVisitFromAppointment } from "@/lib/dental/services/visits";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(_req: Request, context: { params: Promise<{ id: string }> }) {
  const ctx = await requireDental();
  if (ctx instanceof NextResponse) return ctx;
  const denied = ensure(ctx, "visits.manage");
  if (denied) return denied;
  const { id } = await context.params;
  try {
    const result = await startVisitFromAppointment(ctx, Number(id));
    return NextResponse.json({ ok: true, ...result });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "تعذّر بدء الزيارة";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

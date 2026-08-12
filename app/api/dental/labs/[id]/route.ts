import { NextResponse } from "next/server";
import { ensure, requireDental } from "@/lib/dental/data";
import { updateLabOrder } from "@/lib/dental/services/clinic-ops";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(req: Request, context: { params: Promise<{ id: string }> }) {
  const ctx = await requireDental();
  if (ctx instanceof NextResponse) return ctx;
  const denied = ensure(ctx, "treatments.create");
  if (denied) return denied;
  const { id } = await context.params;
  const body = await req.json().catch(() => ({}));
  try {
    await updateLabOrder(ctx, Number(id), body);
    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "تعذّر التحديث" }, { status: 400 });
  }
}

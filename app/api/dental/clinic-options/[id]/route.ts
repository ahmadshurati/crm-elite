import { NextResponse } from "next/server";
import { ensure, requireDental } from "@/lib/dental/data";
import { deleteClinicOption } from "@/lib/dental/services/clinic-ops";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function DELETE(_req: Request, context: { params: Promise<{ id: string }> }) {
  const ctx = await requireDental();
  if (ctx instanceof NextResponse) return ctx;
  const denied = ensure(ctx, "settings.manage");
  if (denied) return denied;
  const { id } = await context.params;
  try {
    await deleteClinicOption(ctx, Number(id));
    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "تعذّر الحذف" }, { status: 400 });
  }
}

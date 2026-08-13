import { NextResponse } from "next/server";
import { ensure, requireDental } from "@/lib/dental/data";
import { setStaffActive, setStaffRole } from "@/lib/dental/services/staff";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(req: Request, context: { params: Promise<{ id: string }> }) {
  const ctx = await requireDental();
  if (ctx instanceof NextResponse) return ctx;
  const denied = ensure(ctx, "users.manage");
  if (denied) return denied;
  const { id } = await context.params;
  const body = await req.json().catch(() => ({}));
  try {
    if (body.dentalRole !== undefined) await setStaffRole(ctx, Number(id), String(body.dentalRole));
    if (body.isActive !== undefined) await setStaffActive(ctx, Number(id), Boolean(body.isActive));
    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "تعذّر التحديث" }, { status: 400 });
  }
}

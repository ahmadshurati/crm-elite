import { NextResponse } from "next/server";
import { ensure, requireDental } from "@/lib/dental/data";
import { updateCatalog } from "@/lib/dental/services/treatments";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(req: Request, context: { params: Promise<{ id: string }> }) {
  const ctx = await requireDental();
  if (ctx instanceof NextResponse) return ctx;
  const denied = ensure(ctx, "settings.manage");
  if (denied) return denied;
  const { id } = await context.params;
  const body = await req.json().catch(() => ({}));
  try {
    await updateCatalog(ctx, Number(id), body);
    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "تعذّر التحديث";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

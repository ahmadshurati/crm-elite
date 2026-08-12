import { NextResponse } from "next/server";
import { ensure, requireDental } from "@/lib/dental/data";
import { payInstallment } from "@/lib/dental/services/billing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(req: Request, context: { params: Promise<{ id: string }> }) {
  const ctx = await requireDental();
  if (ctx instanceof NextResponse) return ctx;
  const denied = ensure(ctx, "payments.create");
  if (denied) return denied;
  const { id } = await context.params;
  const body = await req.json().catch(() => ({}));
  try {
    await payInstallment(ctx, Number(id), String(body.method || "cash"));
    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "تعذّر السداد" }, { status: 400 });
  }
}

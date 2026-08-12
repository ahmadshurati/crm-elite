import { NextResponse } from "next/server";
import { ensure, requireDental, voidPayment } from "@/lib/dental/data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Void (reverse) a payment — payments are never hard-deleted.
export async function PATCH(req: Request, context: { params: Promise<{ id: string }> }) {
  const ctx = await requireDental();
  if (ctx instanceof NextResponse) return ctx;
  const denied = ensure(ctx, "payments.void");
  if (denied) return denied;
  const { id } = await context.params;
  const body = await req.json().catch(() => ({}));
  try {
    await voidPayment(ctx, Number(id), String(body.reason || "").slice(0, 190));
    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "تعذّر إلغاء الدفعة";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

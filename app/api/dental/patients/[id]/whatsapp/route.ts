import { NextResponse } from "next/server";
import { ensure, requireDental } from "@/lib/dental/data";
import { getPatientSummary, ensureConversationForPatient } from "@/lib/dental/whatsapp/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Lightweight summary for the patient profile card (no full history load).
export async function GET(_req: Request, context: { params: Promise<{ id: string }> }) {
  const ctx = await requireDental();
  if (ctx instanceof NextResponse) return ctx;
  const denied = ensure(ctx, "messages.view");
  if (denied) return denied;
  const { id } = await context.params;
  try {
    const summary = await getPatientSummary(ctx.companyId, Number(id));
    return NextResponse.json({ summary });
  } catch (error) {
    console.error("GET /api/dental/patients/[id]/whatsapp error:", error);
    return NextResponse.json({ error: "تعذّر تحميل معلومات واتساب" }, { status: 500 });
  }
}

// Open (or create) the conversation for this patient, returning its id.
export async function POST(_req: Request, context: { params: Promise<{ id: string }> }) {
  const ctx = await requireDental();
  if (ctx instanceof NextResponse) return ctx;
  const denied = ensure(ctx, "messages.view");
  if (denied) return denied;
  const { id } = await context.params;
  const res = await ensureConversationForPatient(ctx, Number(id));
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: 400 });
  return NextResponse.json({ ok: true, conversationId: res.conversationId });
}

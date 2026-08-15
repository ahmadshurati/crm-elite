import { NextResponse } from "next/server";
import { ensure, requireDental } from "@/lib/dental/data";
import { getConversation, getMessages, markConversationRead, linkConversation } from "@/lib/dental/whatsapp/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: Request, context: { params: Promise<{ id: string }> }) {
  const ctx = await requireDental();
  if (ctx instanceof NextResponse) return ctx;
  const denied = ensure(ctx, "messages.view");
  if (denied) return denied;
  const { id } = await context.params;
  const conversationId = Number(id);
  try {
    const conversation = await getConversation(ctx.companyId, conversationId);
    if (!conversation) return NextResponse.json({ error: "المحادثة غير موجودة" }, { status: 404 });
    const messages = await getMessages(ctx.companyId, conversationId);
    return NextResponse.json({ conversation, messages: messages || [] });
  } catch (error) {
    console.error("GET /api/dental/whatsapp/conversations/[id] error:", error);
    return NextResponse.json({ error: "تعذّر تحميل المحادثة" }, { status: 500 });
  }
}

export async function PATCH(req: Request, context: { params: Promise<{ id: string }> }) {
  const ctx = await requireDental();
  if (ctx instanceof NextResponse) return ctx;
  const { id } = await context.params;
  const conversationId = Number(id);
  const body = await req.json().catch(() => ({}));
  const action = String(body.action || "");

  if (action === "read") {
    const denied = ensure(ctx, "messages.view");
    if (denied) return denied;
    await markConversationRead(ctx.companyId, conversationId);
    return NextResponse.json({ ok: true });
  }

  if (action === "link" || action === "unlink") {
    const denied = ensure(ctx, "messages.send");
    if (denied) return denied;
    const patientId = action === "unlink" ? null : Number(body.patientId);
    if (action === "link" && !Number.isFinite(patientId)) {
      return NextResponse.json({ error: "معرّف المريض غير صالح" }, { status: 400 });
    }
    const res = await linkConversation(ctx, conversationId, patientId);
    if (!res.ok) return NextResponse.json({ error: res.error }, { status: 400 });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "إجراء غير معروف" }, { status: 400 });
}

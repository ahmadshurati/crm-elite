import { NextResponse } from "next/server";
import { enforceApiRateLimit } from "@/lib/api-rate-limit";
import { ensure, requireDental } from "@/lib/dental/data";
import { getMessages, sendMessage, type SendInput } from "@/lib/dental/whatsapp/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: Request, context: { params: Promise<{ id: string }> }) {
  const ctx = await requireDental();
  if (ctx instanceof NextResponse) return ctx;
  const denied = ensure(ctx, "messages.view");
  if (denied) return denied;
  const { id } = await context.params;
  const messages = await getMessages(ctx.companyId, Number(id));
  if (messages === null) return NextResponse.json({ error: "المحادثة غير موجودة" }, { status: 404 });
  return NextResponse.json({ messages });
}

export async function POST(req: Request, context: { params: Promise<{ id: string }> }) {
  const ctx = await requireDental();
  if (ctx instanceof NextResponse) return ctx;
  const denied = ensure(ctx, "messages.send");
  if (denied) return denied;

  const limited = enforceApiRateLimit(req, `dental-whatsapp-send:${ctx.companyId}`, 60, 60 * 1000);
  if (limited) return limited;

  const { id } = await context.params;
  const conversationId = Number(id);
  const body = await req.json().catch(() => ({}));

  let input: SendInput;
  if (String(body.type) === "template") {
    input = {
      type: "template",
      templateName: String(body.templateName || ""),
      templateLanguage: body.templateLanguage ? String(body.templateLanguage) : undefined,
      templateParams: Array.isArray(body.templateParams) ? body.templateParams.map((p: unknown) => String(p ?? "")) : [],
    };
  } else {
    input = { type: "text", body: String(body.body || "") };
  }

  const result = await sendMessage(ctx, conversationId, input);
  if (!result.ok) {
    const status = result.code === "not_configured" ? 409 : result.code === "window_closed" ? 422 : result.code === "meta_error" ? 502 : 400;
    return NextResponse.json({ error: result.error, code: result.code }, { status });
  }
  return NextResponse.json({ ok: true, message: result.message });
}

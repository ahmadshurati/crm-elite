import { NextResponse } from "next/server";
import { storeInboundMessage } from "@/lib/inbox";
import { loggedRoute } from "@/lib/api-observability";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function handlePost(req: Request) {
  const contentType = req.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    const body = await req.json();

    if (body.entry) {
      for (const entry of body.entry || []) {
        for (const change of entry.changes || []) {
          const messages = change.value?.messages || [];
          for (const msg of messages) {
            const text = msg.text?.body || msg.button?.text || "";
            const from = msg.from ? String(msg.from) : "unknown";
            await storeInboundMessage({
              channel: "whatsapp",
              sender: from,
              body: text,
              provider: "whatsapp-meta",
              providerId: msg.id ? String(msg.id) : null,
            });
          }
        }
      }
      return NextResponse.json({ ok: true });
    }

    await storeInboundMessage({
      channel: String(body.channel || "whatsapp"),
      sender: String(body.sender || body.from || "unknown"),
      senderName: body.senderName ? String(body.senderName) : null,
      subject: body.subject ? String(body.subject) : null,
      body: String(body.body || body.text || ""),
      provider: body.provider ? String(body.provider) : "manual",
      providerId: body.providerId ? String(body.providerId) : null,
    });

    return NextResponse.json({ ok: true });
  }

  const form = await req.formData();
  const from = String(form.get("From") || form.get("WaId") || "").replace("whatsapp:", "");
  const text = String(form.get("Body") || form.get("body") || "");
  const messageSid = String(form.get("MessageSid") || form.get("SmsMessageSid") || "");

  if (from && text) {
    await storeInboundMessage({
      channel: from.includes("whatsapp") || form.get("From")?.toString().includes("whatsapp") ? "whatsapp" : "sms",
      sender: from,
      body: text,
      provider: "twilio",
      providerId: messageSid || null,
    });
  }

  return NextResponse.json({ ok: true });
}

export const POST = loggedRoute("POST /api/webhooks/whatsapp", handlePost);

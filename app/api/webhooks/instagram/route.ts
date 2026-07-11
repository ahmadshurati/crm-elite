import { NextResponse } from "next/server";
import { storeInboundMessage } from "@/lib/inbox";
import { loggedRoute } from "@/lib/api-observability";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function handlePost(req: Request) {
  const body = await req.json().catch(() => ({}));

  await storeInboundMessage({
    channel: "instagram",
    sender: String(body.sender || body.from || "unknown"),
    senderName: body.senderName ? String(body.senderName) : null,
    body: String(body.body || body.text || ""),
    provider: "meta",
    providerId: body.id ? String(body.id) : null,
  });

  return NextResponse.json({ ok: true });
}

export const POST = loggedRoute("POST /api/webhooks/instagram", handlePost);

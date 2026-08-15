import { NextResponse } from "next/server";
import { enforceApiRateLimit } from "@/lib/api-rate-limit";
import { getCompanyIdByPhoneNumberId, getConfig, isValidVerifyToken } from "@/lib/dental/whatsapp/config";
import { extractChanges, verifySignature } from "@/lib/dental/whatsapp/webhook";
import { ingestWebhook } from "@/lib/dental/whatsapp/service";

// PUBLIC endpoint (Meta calls it). No user auth; secured by verify token (GET) + HMAC signature (POST).
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET: Meta webhook verification handshake.
export async function GET(req: Request) {
  const url = new URL(req.url);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token") || "";
  const challenge = url.searchParams.get("hub.challenge") || "";
  if (mode === "subscribe" && (await isValidVerifyToken(token))) {
    return new NextResponse(challenge, { status: 200, headers: { "content-type": "text/plain" } });
  }
  return new NextResponse("Forbidden", { status: 403 });
}

// POST: incoming messages + status callbacks.
export async function POST(req: Request) {
  const limited = enforceApiRateLimit(req, "dental-whatsapp-webhook", 600, 60 * 1000);
  if (limited) return limited;

  const raw = await req.text();
  const signature = req.headers.get("x-hub-signature-256");

  let payload: unknown;
  try {
    payload = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  // Resolve routing (phone_number_id -> company -> per-company app secret) to verify the signature.
  const changes = extractChanges(payload);
  const phoneNumberId = changes.find((c) => c.phoneNumberId)?.phoneNumberId || null;
  let appSecret: string | null = process.env.WHATSAPP_APP_SECRET?.trim() || null;
  if (phoneNumberId) {
    const companyId = await getCompanyIdByPhoneNumberId(phoneNumberId);
    if (companyId) {
      const config = await getConfig(companyId);
      appSecret = config?.appSecret || appSecret;
    }
  }

  // Never process an unverifiable payload. Ack (200) so Meta doesn't hammer retries, but do nothing.
  if (!appSecret) {
    console.warn("dental whatsapp webhook: no app secret configured; ignoring payload");
    return NextResponse.json({ ok: true, ignored: "no_app_secret" });
  }
  if (!verifySignature(appSecret, raw, signature)) {
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }

  try {
    const result = await ingestWebhook(payload);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error("dental whatsapp webhook ingest error:", error);
    // Still ack to avoid infinite retries; details are in server logs.
    return NextResponse.json({ ok: true });
  }
}

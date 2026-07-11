import { NextResponse } from "next/server";
import { writeActivityLog } from "@/lib/audit-log";
import { isErrorResponse, requirePermission } from "@/lib/permissions";
import { loggedRoute } from "@/lib/api-observability";
import { sendSms } from "@/lib/integrations/sms";
import { enforceApiRateLimit } from "@/lib/api-rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function handlePost(req: Request) {
  const rateLimited = enforceApiRateLimit(req, "integrations/sms/send", 20, 60 * 1000);
  if (rateLimited) return rateLimited;

  const auth = await requirePermission("editSubscribers");
  if (isErrorResponse(auth)) return auth;
  const { user } = auth;

  try {
    const body = await req.json();
    const to = String(body.to || "").trim();
    const message = String(body.body || body.message || "").trim();
    const customerId = body.customerId != null ? Number(body.customerId) : undefined;

    if (!to || !message) {
      return NextResponse.json({ error: "to and body are required" }, { status: 400 });
    }

    const result = await sendSms({
      to,
      body: message,
      customerId: Number.isFinite(customerId) ? customerId : undefined,
      userId: user.id,
    });

    await writeActivityLog(user, "إرسال SMS", "التكاملات", to, result.logId);

    return NextResponse.json(result, { status: result.ok ? 200 : 503 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: "Failed to send SMS", message }, { status: 500 });
  }
}

export const POST = loggedRoute("POST /api/integrations/sms/send", handlePost);

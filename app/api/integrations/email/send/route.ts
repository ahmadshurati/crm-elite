import { NextResponse } from "next/server";
import { writeActivityLog } from "@/lib/audit-log";
import { isErrorResponse, requirePermission } from "@/lib/permissions";
import { loggedRoute } from "@/lib/api-observability";
import { sendEmail } from "@/lib/integrations/email";
import { enforceApiRateLimit } from "@/lib/api-rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function handlePost(req: Request) {
  const rateLimited = enforceApiRateLimit(req, "integrations/email/send", 20, 60 * 1000);
  if (rateLimited) return rateLimited;

  const auth = await requirePermission("editSubscribers");
  if (isErrorResponse(auth)) return auth;
  const { user } = auth;

  try {
    const body = await req.json();
    const to = String(body.to || "").trim();
    const subject = String(body.subject || "").trim();
    const html = String(body.html || body.body || "").trim();
    const text = body.text ? String(body.text) : undefined;
    const customerId = body.customerId != null ? Number(body.customerId) : undefined;

    if (!to || !subject || !html) {
      return NextResponse.json({ error: "to, subject, and html are required" }, { status: 400 });
    }

    const result = await sendEmail({
      to,
      subject,
      html,
      text,
      customerId: Number.isFinite(customerId) ? customerId : undefined,
      userId: user.id,
    });

    await writeActivityLog(user, "إرسال بريد", "التكاملات", to, result.logId);

    return NextResponse.json(result, { status: result.ok ? 200 : 503 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: "Failed to send email", message }, { status: 500 });
  }
}

export const POST = loggedRoute("POST /api/integrations/email/send", handlePost);

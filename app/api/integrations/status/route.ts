import { NextResponse } from "next/server";
import { isErrorResponse, requireUser } from "@/lib/permissions";
import { loggedRoute } from "@/lib/api-observability";
import { getIntegrationStatus } from "@/lib/integrations/config";
import { query } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function handleGet() {
  const auth = await requireUser();
  if (isErrorResponse(auth)) return auth;

  const status = getIntegrationStatus();
  const [templateCount, messageStats] = await Promise.all([
    query<{ count: number }>("SELECT COUNT(*) AS count FROM EmailTemplate WHERE isActive = true"),
    query<{ channel: string; status: string; count: number }>(
      `SELECT channel, status, COUNT(*) AS count FROM OutboundMessage GROUP BY channel, status`
    ),
  ]);

  return NextResponse.json({
    ...status,
    emailTemplates: Number(templateCount[0]?.count || 0),
    outboundMessages: messageStats,
    envHints: {
      email: "RESEND_API_KEY or SMTP_HOST + SMTP_USER + SMTP_PASS + EMAIL_FROM",
      sms: "TWILIO_ACCOUNT_SID + TWILIO_AUTH_TOKEN + TWILIO_SMS_FROM",
      whatsapp: "TWILIO_WHATSAPP_FROM or WHATSAPP_ACCESS_TOKEN + WHATSAPP_PHONE_NUMBER_ID",
      gmail: "GMAIL_CLIENT_ID + GMAIL_CLIENT_SECRET + GMAIL_REFRESH_TOKEN",
      instagram: "INSTAGRAM_ACCESS_TOKEN + INSTAGRAM_PAGE_ID",
      ai: "OPENAI_API_KEY (+ optional OPENAI_MODEL)",
      payments: "STRIPE_SECRET_KEY + STRIPE_WEBHOOK_SECRET",
    },
  });
}

export const GET = loggedRoute("GET /api/integrations/status", handleGet);

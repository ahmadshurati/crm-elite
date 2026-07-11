import { getIntegrationStatus } from "@/lib/integrations/config";
import { logOutboundMessage } from "@/lib/integrations/outbound-log";

export type SendEmailInput = {
  to: string;
  subject: string;
  html: string;
  text?: string;
  customerId?: number;
  userId?: number;
};

export type SendEmailResult = {
  ok: boolean;
  status: "sent" | "queued" | "failed" | "skipped";
  provider: string;
  messageId?: string;
  error?: string;
  logId?: number;
};

async function sendViaResend(input: SendEmailInput): Promise<SendEmailResult> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.EMAIL_FROM?.trim() || "CRM Elite <onboarding@resend.dev>";

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [input.to],
      subject: input.subject,
      html: input.html,
      text: input.text,
    }),
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    return {
      ok: false,
      status: "failed",
      provider: "resend",
      error: String(data.message || data.error || res.statusText),
    };
  }

  return {
    ok: true,
    status: "sent",
    provider: "resend",
    messageId: data.id ? String(data.id) : undefined,
  };
}

export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  const status = getIntegrationStatus();

  if (!status.email.configured) {
    const logId = await logOutboundMessage({
      channel: "email",
      recipient: input.to,
      subject: input.subject,
      body: input.html,
      status: "skipped",
      provider: "none",
      errorMessage: "Email provider not configured. Set RESEND_API_KEY or SMTP_* env vars.",
      customerId: input.customerId,
      userId: input.userId,
    });

    return {
      ok: false,
      status: "skipped",
      provider: "none",
      error: "Email integration not configured",
      logId,
    };
  }

  let result: SendEmailResult;

  if (status.email.provider === "resend") {
    result = await sendViaResend(input);
  } else {
    result = {
      ok: false,
      status: "skipped",
      provider: "smtp",
      error: "SMTP sending is configured via env but not implemented in this build. Use RESEND_API_KEY.",
    };
  }

  const logId = await logOutboundMessage({
    channel: "email",
    recipient: input.to,
    subject: input.subject,
    body: input.html,
    status: result.status,
    provider: result.provider,
    providerId: result.messageId || null,
    errorMessage: result.error || null,
    customerId: input.customerId,
    userId: input.userId,
  });

  return { ...result, logId };
}

export function renderTemplate(template: string, variables: Record<string, string>) {
  return Object.entries(variables).reduce(
    (output, [key, value]) => output.replaceAll(`{{${key}}}`, value),
    template
  );
}

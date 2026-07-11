import { getIntegrationStatus } from "@/lib/integrations/config";
import { logOutboundMessage } from "@/lib/integrations/outbound-log";

export type SendSmsInput = {
  to: string;
  body: string;
  customerId?: number;
  userId?: number;
};

export type SendSmsResult = {
  ok: boolean;
  status: "sent" | "queued" | "failed" | "skipped";
  provider: string;
  messageId?: string;
  error?: string;
  logId?: number;
};

async function sendViaTwilio(input: SendSmsInput): Promise<SendSmsResult> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID?.trim();
  const authToken = process.env.TWILIO_AUTH_TOKEN?.trim();
  const from = process.env.TWILIO_SMS_FROM?.trim();

  const auth = Buffer.from(`${accountSid}:${authToken}`).toString("base64");
  const body = new URLSearchParams({ To: input.to, From: from || "", Body: input.body });

  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    return {
      ok: false,
      status: "failed",
      provider: "twilio",
      error: String(data.message || res.statusText),
    };
  }

  return {
    ok: true,
    status: "sent",
    provider: "twilio",
    messageId: data.sid ? String(data.sid) : undefined,
  };
}

export async function sendSms(input: SendSmsInput): Promise<SendSmsResult> {
  const integration = getIntegrationStatus();

  if (!integration.sms.configured) {
    const logId = await logOutboundMessage({
      channel: "sms",
      recipient: input.to,
      body: input.body,
      status: "skipped",
      provider: "none",
      errorMessage: "SMS not configured. Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_SMS_FROM.",
      customerId: input.customerId,
      userId: input.userId,
    });

    return {
      ok: false,
      status: "skipped",
      provider: "none",
      error: "SMS integration not configured",
      logId,
    };
  }

  const result = await sendViaTwilio(input);

  const logId = await logOutboundMessage({
    channel: "sms",
    recipient: input.to,
    body: input.body,
    status: result.status,
    provider: result.provider,
    providerId: result.messageId || null,
    errorMessage: result.error || null,
    customerId: input.customerId,
    userId: input.userId,
  });

  return { ...result, logId };
}

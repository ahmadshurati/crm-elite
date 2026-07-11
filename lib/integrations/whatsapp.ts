import { getIntegrationStatus } from "@/lib/integrations/config";
import { logOutboundMessage } from "@/lib/integrations/outbound-log";

export type SendWhatsAppInput = {
  to: string;
  body: string;
  customerId?: number;
  userId?: number;
};

export type SendWhatsAppResult = {
  ok: boolean;
  status: "sent" | "queued" | "failed" | "skipped";
  provider: string;
  messageId?: string;
  error?: string;
  logId?: number;
};

async function sendViaTwilioWhatsApp(input: SendWhatsAppInput): Promise<SendWhatsAppResult> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID?.trim();
  const authToken = process.env.TWILIO_AUTH_TOKEN?.trim();
  const from = process.env.TWILIO_WHATSAPP_FROM?.trim();

  const auth = Buffer.from(`${accountSid}:${authToken}`).toString("base64");
  const body = new URLSearchParams({ To: `whatsapp:${input.to}`, From: from || "", Body: input.body });

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

async function sendViaMetaWhatsApp(input: SendWhatsAppInput): Promise<SendWhatsAppResult> {
  const token = process.env.WHATSAPP_ACCESS_TOKEN?.trim();
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID?.trim();

  const res = await fetch(`https://graph.facebook.com/v19.0/${phoneNumberId}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: input.to.replace(/\D/g, ""),
      type: "text",
      text: { body: input.body },
    }),
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    return {
      ok: false,
      status: "failed",
      provider: "whatsapp-meta",
      error: String(data.error?.message || res.statusText),
    };
  }

  return {
    ok: true,
    status: "sent",
    provider: "whatsapp-meta",
    messageId: data.messages?.[0]?.id ? String(data.messages[0].id) : undefined,
  };
}

export async function sendWhatsApp(input: SendWhatsAppInput): Promise<SendWhatsAppResult> {
  const integration = getIntegrationStatus();

  if (!integration.whatsapp.configured) {
    const logId = await logOutboundMessage({
      channel: "whatsapp",
      recipient: input.to,
      body: input.body,
      status: "skipped",
      provider: "none",
      errorMessage:
        "WhatsApp not configured. Set TWILIO_* or WHATSAPP_ACCESS_TOKEN + WHATSAPP_PHONE_NUMBER_ID.",
      customerId: input.customerId,
      userId: input.userId,
    });

    return {
      ok: false,
      status: "skipped",
      provider: "none",
      error: "WhatsApp integration not configured",
      logId,
    };
  }

  const result =
    integration.whatsapp.provider === "whatsapp-meta"
      ? await sendViaMetaWhatsApp(input)
      : await sendViaTwilioWhatsApp(input);

  const logId = await logOutboundMessage({
    channel: "whatsapp",
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

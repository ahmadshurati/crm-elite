import { execute } from "@/lib/db";

export type OutboundMessageInput = {
  channel: "email" | "sms" | "whatsapp";
  recipient: string;
  subject?: string | null;
  body: string;
  status: "queued" | "sent" | "failed" | "skipped";
  provider?: string | null;
  providerId?: string | null;
  errorMessage?: string | null;
  customerId?: number | null;
  userId?: number | null;
};

export async function logOutboundMessage(input: OutboundMessageInput) {
  const result = await execute(
    `INSERT INTO OutboundMessage (channel, recipient, subject, body, status, provider, providerId, errorMessage, customerId, userId, createdAt, sentAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?)`,
    [
      input.channel,
      input.recipient,
      input.subject || null,
      input.body,
      input.status,
      input.provider || null,
      input.providerId || null,
      input.errorMessage || null,
      input.customerId ?? null,
      input.userId ?? null,
      input.status === "sent" ? new Date() : null,
    ]
  );

  return Number(result.insertId);
}

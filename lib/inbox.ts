import { execute, query, queryOne } from "@/lib/db";
import type { InboxChannel } from "@/lib/integrations/config";

export type InboxMessage = {
  id: string;
  source: "inbound" | "outbound";
  channel: string;
  contact: string;
  contactName: string | null;
  subject: string | null;
  body: string;
  status: string;
  isRead: boolean;
  customerId: number | null;
  createdAt: string;
};

function channelFilter(channel: InboxChannel) {
  if (channel === "all") return { clause: "", params: [] as unknown[] };
  if (channel === "gmail") {
    return {
      clause: " AND channel IN ('gmail', 'email')",
      params: [],
    };
  }
  return { clause: " AND channel = ?", params: [channel] };
}

export async function listInboxMessages(options: {
  channel?: InboxChannel;
  limit?: number;
  unreadOnly?: boolean;
  companyId?: number | null;
}) {
  const channel = options.channel || "all";
  const limit = Math.min(200, Math.max(1, options.limit || 80));
  const { clause, params } = channelFilter(channel);
  const unreadClause = options.unreadOnly ? " AND isRead = false" : "";
  const inboundScope = options.companyId
    ? " AND customerId IN (SELECT id FROM Customer WHERE companyId = ?)"
    : "";
  const outboundScope = options.companyId
    ? " AND (customerId IN (SELECT id FROM Customer WHERE companyId = ?) OR userId IN (SELECT id FROM AppUser WHERE companyId = ?))"
    : "";
  const inboundParams = options.companyId ? [options.companyId] : [];
  const outboundParams = options.companyId ? [options.companyId, options.companyId] : [];

  const [inbound, outbound] = await Promise.all([
    query<Record<string, unknown>>(
      `SELECT id, channel, sender AS contact, senderName, subject, body, 'received' AS status, isRead, customerId, createdAt
       FROM InboundMessage WHERE 1=1${clause}${unreadClause}${inboundScope}
       ORDER BY createdAt DESC LIMIT ?`,
      [...params, ...inboundParams, limit]
    ),
    query<Record<string, unknown>>(
      `SELECT id, channel, recipient AS contact, NULL AS senderName, subject, body, status, isRead, customerId, createdAt
       FROM OutboundMessage WHERE 1=1${clause}${unreadClause}${outboundScope}
       ORDER BY createdAt DESC LIMIT ?`,
      [...params, ...outboundParams, limit]
    ),
  ]);

  const items: InboxMessage[] = [
    ...inbound.map((row) => ({
      id: `in-${row.id}`,
      source: "inbound" as const,
      channel: String(row.channel),
      contact: String(row.contact),
      contactName: row.senderName ? String(row.senderName) : null,
      subject: row.subject ? String(row.subject) : null,
      body: String(row.body || ""),
      status: "received",
      isRead: Boolean(row.isRead),
      customerId: row.customerId != null ? Number(row.customerId) : null,
      createdAt: new Date(row.createdAt as string | Date).toISOString(),
    })),
    ...outbound.map((row) => ({
      id: `out-${row.id}`,
      source: "outbound" as const,
      channel: String(row.channel),
      contact: String(row.contact),
      contactName: null,
      subject: row.subject ? String(row.subject) : null,
      body: String(row.body || ""),
      status: String(row.status || "sent"),
      isRead: Boolean(row.isRead),
      customerId: row.customerId != null ? Number(row.customerId) : null,
      createdAt: new Date(row.createdAt as string | Date).toISOString(),
    })),
  ];

  items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return items.slice(0, limit);
}

export async function getInboxUnreadCounts(companyId?: number | null) {
  const scope = companyId
    ? " AND customerId IN (SELECT id FROM Customer WHERE companyId = ?)"
    : "";
  const params = companyId ? [companyId] : [];
  const rows = await query<{ channel: string; count: number }>(
    `SELECT channel, COUNT(*) AS count FROM InboundMessage WHERE isRead = false${scope} GROUP BY channel`,
    params
  );

  const counts: Record<string, number> = { all: 0 };
  for (const row of rows) {
    counts[String(row.channel)] = Number(row.count);
    counts.all += Number(row.count);
  }
  return counts;
}

export async function markInboxMessageRead(id: string) {
  if (id.startsWith("in-")) {
    const numericId = Number(id.slice(3));
    await execute("UPDATE InboundMessage SET isRead = true WHERE id = ?", [numericId]);
    return;
  }
  if (id.startsWith("out-")) {
    const numericId = Number(id.slice(4));
    await execute("UPDATE OutboundMessage SET isRead = true WHERE id = ?", [numericId]);
  }
}

export async function storeInboundMessage(input: {
  channel: string;
  sender: string;
  senderName?: string | null;
  subject?: string | null;
  body: string;
  provider?: string | null;
  providerId?: string | null;
  customerId?: number | null;
}) {
  if (input.provider && input.providerId) {
    const existing = await queryOne<{ id: number }>(
      "SELECT id FROM InboundMessage WHERE provider = ? AND providerId = ? LIMIT 1",
      [input.provider, input.providerId]
    );
    if (existing) return existing.id;
  }

  const result = await execute(
    `INSERT INTO InboundMessage (channel, sender, senderName, subject, body, provider, providerId, customerId, isRead, createdAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, false, NOW())`,
    [
      input.channel,
      input.sender,
      input.senderName || null,
      input.subject || null,
      input.body,
      input.provider || null,
      input.providerId || null,
      input.customerId ?? null,
    ]
  );

  return Number(result.insertId);
}

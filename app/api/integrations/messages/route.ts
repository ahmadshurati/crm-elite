import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { isErrorResponse, requireUser } from "@/lib/permissions";
import { loggedRoute } from "@/lib/api-observability";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function handleGet(req: Request) {
  const auth = await requireUser();
  if (isErrorResponse(auth)) return auth;

  const url = new URL(req.url);
  const limit = Math.min(100, Math.max(1, Number(url.searchParams.get("limit") || 50)));

  const rows = await query<Record<string, unknown>>(
    `SELECT id, channel, recipient, subject, status, provider, providerId, errorMessage, customerId, userId, createdAt, sentAt
     FROM OutboundMessage ORDER BY createdAt DESC LIMIT ?`,
    [limit]
  );

  return NextResponse.json(
    rows.map((row) => ({
      id: Number(row.id),
      channel: String(row.channel),
      recipient: String(row.recipient),
      subject: row.subject ? String(row.subject) : null,
      status: String(row.status),
      provider: row.provider ? String(row.provider) : null,
      errorMessage: row.errorMessage ? String(row.errorMessage) : null,
      customerId: row.customerId != null ? Number(row.customerId) : null,
      createdAt: new Date(row.createdAt as string | Date).toISOString(),
      sentAt: row.sentAt ? new Date(row.sentAt as string | Date).toISOString() : null,
    }))
  );
}

export const GET = loggedRoute("GET /api/integrations/messages", handleGet);

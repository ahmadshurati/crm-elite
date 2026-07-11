import { NextResponse } from "next/server";
import { writeActivityLog } from "@/lib/audit-log";
import { isCommunicationType } from "@/lib/crm/communications";
import { execute, query } from "@/lib/db";
import { isErrorResponse, requirePermission } from "@/lib/permissions";
import { loggedRoute } from "@/lib/api-observability";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function mapRow(row: Record<string, unknown>) {
  return {
    id: Number(row.id),
    customerId: Number(row.customerId),
    userId: row.userId != null ? Number(row.userId) : null,
    username: String(row.username || ""),
    type: String(row.type || "note"),
    occurredAt: new Date(row.occurredAt as string | Date).toISOString(),
    summary: String(row.summary || ""),
    attachmentUrl: row.attachmentUrl ? String(row.attachmentUrl) : null,
    createdAt: new Date(row.createdAt as string | Date).toISOString(),
  };
}

async function handleGet(
  _req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requirePermission("viewSubscribers");
  if (isErrorResponse(auth)) return auth;

  try {
    const { id } = await context.params;
    const customerId = Number(id);

    if (!Number.isFinite(customerId) || customerId <= 0) {
      return NextResponse.json({ error: "Invalid customerId" }, { status: 400 });
    }

    const rows = await query<Record<string, unknown>>(
      `SELECT id, customerId, userId, username, type, occurredAt, summary, attachmentUrl, createdAt
       FROM CustomerCommunication
       WHERE customerId = ?
       ORDER BY occurredAt DESC`,
      [customerId]
    );

    return NextResponse.json(rows.map(mapRow));
  } catch (error: unknown) {
    console.error("GET /api/customers/[id]/communications error:", error);
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: "Failed to load communications", message }, { status: 500 });
  }
}

async function handlePost(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requirePermission("editSubscribers");
  if (isErrorResponse(auth)) return auth;
  const { user: currentUser } = auth;

  try {
    const { id } = await context.params;
    const customerId = Number(id);
    const body = await req.json();

    if (!Number.isFinite(customerId) || customerId <= 0) {
      return NextResponse.json({ error: "Invalid customerId" }, { status: 400 });
    }

    const type = String(body.type || "note");
    const summary = String(body.summary || "").trim();

    if (!summary) {
      return NextResponse.json({ error: "Summary is required" }, { status: 400 });
    }

    if (!isCommunicationType(type)) {
      return NextResponse.json({ error: "Invalid communication type" }, { status: 400 });
    }

    const occurredAt = body.occurredAt ? new Date(body.occurredAt) : new Date();
    if (Number.isNaN(occurredAt.getTime())) {
      return NextResponse.json({ error: "Invalid occurredAt" }, { status: 400 });
    }

    const result = await execute(
      `INSERT INTO CustomerCommunication (customerId, userId, username, type, occurredAt, summary, attachmentUrl, createdAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, NOW())`,
      [
        customerId,
        currentUser.id,
        currentUser.username,
        type,
        occurredAt,
        summary,
        body.attachmentUrl ? String(body.attachmentUrl) : null,
      ]
    );

    const row = await query<Record<string, unknown>>(
      `SELECT id, customerId, userId, username, type, occurredAt, summary, attachmentUrl, createdAt
       FROM CustomerCommunication WHERE id = ? LIMIT 1`,
      [result.insertId]
    );

    await writeActivityLog(
      currentUser,
      "إضافة تواصل",
      "المشتركين",
      summary.slice(0, 80),
      customerId
    );

    return NextResponse.json(mapRow(row[0] || {}));
  } catch (error: unknown) {
    console.error("POST /api/customers/[id]/communications error:", error);
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: "Failed to create communication", message }, { status: 500 });
  }
}

export const GET = loggedRoute("GET /api/customers/[id]/communications", handleGet);
export const POST = loggedRoute("POST /api/customers/[id]/communications", handlePost);

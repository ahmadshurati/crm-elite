import { NextResponse } from "next/server";
import { writeActivityLog } from "@/lib/audit-log";
import {
  calculateDocumentTotals,
  nextDocumentNumber,
  parseLineItems,
  serializeLineItems,
} from "@/lib/crm/line-items";
import { isQuoteStatus } from "@/lib/crm/quotes";
import { execute, query } from "@/lib/db";
import { isErrorResponse, requirePermission } from "@/lib/permissions";
import { requireCompanyId } from "@/lib/tenant";
import { loggedRoute } from "@/lib/api-observability";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function mapRow(row: Record<string, unknown>) {
  return {
    id: Number(row.id),
    customerId: Number(row.customerId),
    createdByUserId: row.createdByUserId != null ? Number(row.createdByUserId) : null,
    quoteNumber: String(row.quoteNumber || ""),
    title: String(row.title || ""),
    status: String(row.status || "draft"),
    lineItems: parseLineItems(row.lineItems),
    subtotal: Number(row.subtotal || 0),
    taxRate: Number(row.taxRate || 0),
    taxAmount: Number(row.taxAmount || 0),
    discount: Number(row.discount || 0),
    total: Number(row.total || 0),
    validUntil: row.validUntil
      ? new Date(row.validUntil as string | Date).toISOString().slice(0, 10)
      : null,
    notes: row.notes ? String(row.notes) : null,
    customerName: row.customerName ? String(row.customerName) : null,
    createdByUsername: row.createdByUsername ? String(row.createdByUsername) : null,
    createdAt: new Date(row.createdAt as string | Date).toISOString(),
    updatedAt: new Date(row.updatedAt as string | Date).toISOString(),
  };
}

async function handleGet(req: Request) {
  const auth = await requirePermission("viewSubscribers");
  if (isErrorResponse(auth)) return auth;

  try {
    const companyId = requireCompanyId(auth.user);
    const url = new URL(req.url);
    const status = url.searchParams.get("status");
    const conditions: string[] = ["c.companyId = ?"];
    const params: unknown[] = [companyId];

    if (status) {
      conditions.push("q.status = ?");
      params.push(status);
    }

    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

    const rows = await query<Record<string, unknown>>(
      `SELECT q.*, c.name AS customerName, u.username AS createdByUsername
       FROM Quote q
       INNER JOIN Customer c ON c.id = q.customerId
       LEFT JOIN AppUser u ON u.id = q.createdByUserId
       ${where}
       ORDER BY q.createdAt DESC`,
      params
    );

    return NextResponse.json(rows.map(mapRow));
  } catch (error: unknown) {
    console.error("GET /api/quotes error:", error);
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: "Failed to load quotes", message }, { status: 500 });
  }
}

async function handlePost(req: Request) {
  const auth = await requirePermission("editSubscribers");
  if (isErrorResponse(auth)) return auth;
  const { user: currentUser } = auth;

  try {
    const body = await req.json();
    const customerId = Number(body.customerId);
    const title = String(body.title || "").trim();

    if (!Number.isFinite(customerId) || customerId <= 0 || !title) {
      return NextResponse.json({ error: "customerId and title are required" }, { status: 400 });
    }

    const status = String(body.status || "draft");
    if (!isQuoteStatus(status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }

    const lineItems = parseLineItems(body.lineItems);
    const totals = calculateDocumentTotals({
      lineItems,
      taxRate: body.taxRate,
      discount: body.discount,
    });

    const latest = await query<{ quoteNumber: string }>(
      "SELECT quoteNumber FROM Quote ORDER BY id DESC LIMIT 1"
    );
    const quoteNumber = nextDocumentNumber("Q", latest[0]?.quoteNumber);
    const validUntil = body.validUntil ? new Date(body.validUntil) : null;

    const result = await execute(
      `INSERT INTO Quote (customerId, createdByUserId, quoteNumber, title, status, lineItems, subtotal, taxRate, taxAmount, discount, total, validUntil, notes, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [
        customerId,
        currentUser.id,
        quoteNumber,
        title,
        status,
        serializeLineItems(lineItems),
        totals.subtotal,
        totals.taxRate,
        totals.taxAmount,
        totals.discount,
        totals.total,
        validUntil,
        body.notes ? String(body.notes) : null,
      ]
    );

    const rows = await query<Record<string, unknown>>(
      `SELECT q.*, c.name AS customerName, u.username AS createdByUsername
       FROM Quote q
       INNER JOIN Customer c ON c.id = q.customerId
       LEFT JOIN AppUser u ON u.id = q.createdByUserId
       WHERE q.id = ? LIMIT 1`,
      [result.insertId]
    );

    await writeActivityLog(currentUser, "إضافة عرض سعر", "العروض", title, result.insertId);
    return NextResponse.json(mapRow(rows[0] || {}));
  } catch (error: unknown) {
    console.error("POST /api/quotes error:", error);
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: "Failed to create quote", message }, { status: 500 });
  }
}

export const GET = loggedRoute("GET /api/quotes", handleGet);
export const POST = loggedRoute("POST /api/quotes", handlePost);

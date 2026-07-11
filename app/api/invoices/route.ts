import { NextResponse } from "next/server";
import { writeActivityLog } from "@/lib/audit-log";
import { deriveInvoiceStatus, isInvoiceStatus } from "@/lib/crm/invoices";
import {
  calculateDocumentTotals,
  nextDocumentNumber,
  parseLineItems,
  serializeLineItems,
} from "@/lib/crm/line-items";
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
    quoteId: row.quoteId != null ? Number(row.quoteId) : null,
    insuranceId: row.insuranceId != null ? Number(row.insuranceId) : null,
    createdByUserId: row.createdByUserId != null ? Number(row.createdByUserId) : null,
    invoiceNumber: String(row.invoiceNumber || ""),
    title: String(row.title || ""),
    status: String(row.status || "draft"),
    lineItems: parseLineItems(row.lineItems),
    subtotal: Number(row.subtotal || 0),
    taxRate: Number(row.taxRate || 0),
    taxAmount: Number(row.taxAmount || 0),
    discount: Number(row.discount || 0),
    total: Number(row.total || 0),
    paidAmount: Number(row.paidAmount || 0),
    dueDate: row.dueDate
      ? new Date(row.dueDate as string | Date).toISOString().slice(0, 10)
      : null,
    notes: row.notes ? String(row.notes) : null,
    customerName: row.customerName ? String(row.customerName) : null,
    createdByUsername: row.createdByUsername ? String(row.createdByUsername) : null,
    createdAt: new Date(row.createdAt as string | Date).toISOString(),
    updatedAt: new Date(row.updatedAt as string | Date).toISOString(),
  };
}

async function handleGet(req: Request) {
  const auth = await requirePermission("viewAccounting");
  if (isErrorResponse(auth)) return auth;

  try {
    const companyId = requireCompanyId(auth.user);
    const url = new URL(req.url);
    const status = url.searchParams.get("status");
    const conditions: string[] = ["c.companyId = ?"];
    const params: unknown[] = [companyId];

    if (status) {
      conditions.push("i.status = ?");
      params.push(status);
    }

    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

    const rows = await query<Record<string, unknown>>(
      `SELECT i.*, c.name AS customerName, u.username AS createdByUsername
       FROM Invoice i
       INNER JOIN Customer c ON c.id = i.customerId
       LEFT JOIN AppUser u ON u.id = i.createdByUserId
       ${where}
       ORDER BY i.createdAt DESC`,
      params
    );

    return NextResponse.json(rows.map(mapRow));
  } catch (error: unknown) {
    console.error("GET /api/invoices error:", error);
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: "Failed to load invoices", message }, { status: 500 });
  }
}

async function handlePost(req: Request) {
  const auth = await requirePermission("editPayments");
  if (isErrorResponse(auth)) return auth;
  const { user: currentUser } = auth;

  try {
    const body = await req.json();
    const customerId = Number(body.customerId);
    const title = String(body.title || "").trim();

    if (!Number.isFinite(customerId) || customerId <= 0 || !title) {
      return NextResponse.json({ error: "customerId and title are required" }, { status: 400 });
    }

    const lineItems = parseLineItems(body.lineItems);
    const totals = calculateDocumentTotals({
      lineItems,
      taxRate: body.taxRate,
      discount: body.discount,
    });

    const paidAmount = Math.max(0, Number(body.paidAmount || 0));
    const dueDate = body.dueDate ? new Date(body.dueDate) : null;
    let status = String(body.status || "unpaid");
    if (!isInvoiceStatus(status)) status = "unpaid";
    status = deriveInvoiceStatus(totals.total, paidAmount, dueDate, status);

    const latest = await query<{ invoiceNumber: string }>(
      "SELECT invoiceNumber FROM Invoice ORDER BY id DESC LIMIT 1"
    );
    const invoiceNumber = nextDocumentNumber("INV", latest[0]?.invoiceNumber);

    const result = await execute(
      `INSERT INTO Invoice (customerId, quoteId, insuranceId, createdByUserId, invoiceNumber, title, status, lineItems, subtotal, taxRate, taxAmount, discount, total, paidAmount, dueDate, notes, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [
        customerId,
        body.quoteId ? Number(body.quoteId) : null,
        body.insuranceId ? Number(body.insuranceId) : null,
        currentUser.id,
        invoiceNumber,
        title,
        status,
        serializeLineItems(lineItems),
        totals.subtotal,
        totals.taxRate,
        totals.taxAmount,
        totals.discount,
        totals.total,
        paidAmount,
        dueDate,
        body.notes ? String(body.notes) : null,
      ]
    );

    const rows = await query<Record<string, unknown>>(
      `SELECT i.*, c.name AS customerName, u.username AS createdByUsername
       FROM Invoice i
       INNER JOIN Customer c ON c.id = i.customerId
       LEFT JOIN AppUser u ON u.id = i.createdByUserId
       WHERE i.id = ? LIMIT 1`,
      [result.insertId]
    );

    await writeActivityLog(currentUser, "إضافة فاتورة", "الفواتير", title, result.insertId);
    return NextResponse.json(mapRow(rows[0] || {}));
  } catch (error: unknown) {
    console.error("POST /api/invoices error:", error);
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: "Failed to create invoice", message }, { status: 500 });
  }
}

export const GET = loggedRoute("GET /api/invoices", handleGet);
export const POST = loggedRoute("POST /api/invoices", handlePost);

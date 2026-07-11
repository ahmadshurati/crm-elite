import { NextResponse } from "next/server";
import { writeActivityLog } from "@/lib/audit-log";
import { buildPrintableHtml } from "@/lib/crm/document-print";
import { deriveInvoiceStatus, isInvoiceStatus } from "@/lib/crm/invoices";
import {
  calculateDocumentTotals,
  parseLineItems,
  serializeLineItems,
} from "@/lib/crm/line-items";
import { execute, query } from "@/lib/db";
import { isErrorResponse, requirePermission } from "@/lib/permissions";
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
    customerPhone: row.customerPhone ? String(row.customerPhone) : null,
    createdByUsername: row.createdByUsername ? String(row.createdByUsername) : null,
    createdAt: new Date(row.createdAt as string | Date).toISOString(),
    updatedAt: new Date(row.updatedAt as string | Date).toISOString(),
  };
}

async function loadInvoice(invoiceId: number) {
  const rows = await query<Record<string, unknown>>(
    `SELECT i.*, c.name AS customerName, c.phone AS customerPhone, u.username AS createdByUsername
     FROM Invoice i
     INNER JOIN Customer c ON c.id = i.customerId
     LEFT JOIN AppUser u ON u.id = i.createdByUserId
     WHERE i.id = ? LIMIT 1`,
    [invoiceId]
  );
  return rows[0] ? mapRow(rows[0]) : null;
}

async function handleGet(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requirePermission("viewAccounting");
  if (isErrorResponse(auth)) return auth;

  try {
    const { id } = await context.params;
    const invoiceId = Number(id);
    const url = new URL(req.url);

    if (!Number.isFinite(invoiceId) || invoiceId <= 0) {
      return NextResponse.json({ error: "Invalid invoice id" }, { status: 400 });
    }

    const invoice = await loadInvoice(invoiceId);
    if (!invoice) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    }

    if (url.searchParams.get("format") === "print") {
      const html = buildPrintableHtml({
        kind: "invoice",
        number: invoice.invoiceNumber,
        title: invoice.title,
        status: invoice.status,
        customerName: invoice.customerName || "",
        customerPhone: invoice.customerPhone,
        lineItems: invoice.lineItems,
        subtotal: invoice.subtotal,
        taxRate: invoice.taxRate,
        taxAmount: invoice.taxAmount,
        discount: invoice.discount,
        total: invoice.total,
        paidAmount: invoice.paidAmount,
        dueDate: invoice.dueDate,
        notes: invoice.notes,
        createdAt: invoice.createdAt,
      });

      return new NextResponse(html, {
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    }

    return NextResponse.json(invoice);
  } catch (error: unknown) {
    console.error("GET /api/invoices/[id] error:", error);
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: "Failed to load invoice", message }, { status: 500 });
  }
}

async function handlePatch(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requirePermission("editPayments");
  if (isErrorResponse(auth)) return auth;
  const { user: currentUser } = auth;

  try {
    const { id } = await context.params;
    const invoiceId = Number(id);
    const body = await req.json();
    const existing = await loadInvoice(invoiceId);

    if (!existing) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    }

    const fields: string[] = [];
    const values: unknown[] = [];

    if (body.title != null) {
      fields.push("title = ?");
      values.push(String(body.title));
    }
    if (body.status != null && isInvoiceStatus(String(body.status))) {
      fields.push("status = ?");
      values.push(String(body.status));
    }
    if (body.notes !== undefined) {
      fields.push("notes = ?");
      values.push(body.notes ? String(body.notes) : null);
    }
    if (body.dueDate !== undefined) {
      fields.push("dueDate = ?");
      values.push(body.dueDate ? new Date(body.dueDate) : null);
    }
    if (body.paidAmount != null) {
      fields.push("paidAmount = ?");
      values.push(Math.max(0, Number(body.paidAmount || 0)));
    }

    const lineItems = body.lineItems != null ? parseLineItems(body.lineItems) : existing.lineItems;
    const totals = calculateDocumentTotals({
      lineItems,
      taxRate: body.taxRate ?? existing.taxRate,
      discount: body.discount ?? existing.discount,
    });

    if (body.lineItems != null || body.taxRate != null || body.discount != null) {
      fields.push("lineItems = ?", "subtotal = ?", "taxRate = ?", "taxAmount = ?", "discount = ?", "total = ?");
      values.push(
        serializeLineItems(lineItems),
        totals.subtotal,
        totals.taxRate,
        totals.taxAmount,
        totals.discount,
        totals.total
      );
    }

    const paidAmount = body.paidAmount != null ? Math.max(0, Number(body.paidAmount || 0)) : existing.paidAmount;
    const dueDate = body.dueDate !== undefined
      ? body.dueDate
        ? new Date(body.dueDate)
        : null
      : existing.dueDate
        ? new Date(existing.dueDate)
        : null;
    const total = body.lineItems != null || body.taxRate != null || body.discount != null ? totals.total : existing.total;
    const currentStatus = body.status != null && isInvoiceStatus(String(body.status)) ? String(body.status) : existing.status;
    const derivedStatus = deriveInvoiceStatus(total, paidAmount, dueDate, currentStatus);

    fields.push("status = ?");
    values.push(derivedStatus);

    if (!fields.length) {
      return NextResponse.json({ error: "No fields to update" }, { status: 400 });
    }

    fields.push("updatedAt = NOW()");
    values.push(invoiceId);
    await execute(`UPDATE Invoice SET ${fields.join(", ")} WHERE id = ?`, values);

    const invoice = await loadInvoice(invoiceId);
    await writeActivityLog(currentUser, "تعديل فاتورة", "الفواتير", invoice?.title || "", invoiceId);
    return NextResponse.json(invoice);
  } catch (error: unknown) {
    console.error("PATCH /api/invoices/[id] error:", error);
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: "Failed to update invoice", message }, { status: 500 });
  }
}

async function handleDelete(
  _req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requirePermission("editPayments");
  if (isErrorResponse(auth)) return auth;
  const { user: currentUser } = auth;

  try {
    const { id } = await context.params;
    const invoiceId = Number(id);
    const existing = await loadInvoice(invoiceId);

    if (!existing) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    }

    await execute("DELETE FROM Invoice WHERE id = ?", [invoiceId]);
    await writeActivityLog(currentUser, "حذف فاتورة", "الفواتير", existing.title, invoiceId);
    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    console.error("DELETE /api/invoices/[id] error:", error);
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: "Failed to delete invoice", message }, { status: 500 });
  }
}

export const GET = loggedRoute("GET /api/invoices/[id]", handleGet);
export const PATCH = loggedRoute("PATCH /api/invoices/[id]", handlePatch);
export const DELETE = loggedRoute("DELETE /api/invoices/[id]", handleDelete);

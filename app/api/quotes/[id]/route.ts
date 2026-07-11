import { NextResponse } from "next/server";
import { writeActivityLog } from "@/lib/audit-log";
import { buildPrintableHtml } from "@/lib/crm/document-print";
import {
  calculateDocumentTotals,
  parseLineItems,
  serializeLineItems,
} from "@/lib/crm/line-items";
import { isQuoteStatus } from "@/lib/crm/quotes";
import { runAutomations } from "@/lib/crm/automation";
import { execute, query } from "@/lib/db";
import { isErrorResponse, requirePermission } from "@/lib/permissions";
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
    customerPhone: row.customerPhone ? String(row.customerPhone) : null,
    createdByUsername: row.createdByUsername ? String(row.createdByUsername) : null,
    createdAt: new Date(row.createdAt as string | Date).toISOString(),
    updatedAt: new Date(row.updatedAt as string | Date).toISOString(),
  };
}

async function loadQuote(quoteId: number) {
  const rows = await query<Record<string, unknown>>(
    `SELECT q.*, c.name AS customerName, c.phone AS customerPhone, u.username AS createdByUsername
     FROM Quote q
     INNER JOIN Customer c ON c.id = q.customerId
     LEFT JOIN AppUser u ON u.id = q.createdByUserId
     WHERE q.id = ? LIMIT 1`,
    [quoteId]
  );
  return rows[0] ? mapRow(rows[0]) : null;
}

async function handleGet(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requirePermission("viewSubscribers");
  if (isErrorResponse(auth)) return auth;

  try {
    const { id } = await context.params;
    const quoteId = Number(id);
    const url = new URL(req.url);

    if (!Number.isFinite(quoteId) || quoteId <= 0) {
      return NextResponse.json({ error: "Invalid quote id" }, { status: 400 });
    }

    const quote = await loadQuote(quoteId);
    if (!quote) {
      return NextResponse.json({ error: "Quote not found" }, { status: 404 });
    }

    if (url.searchParams.get("format") === "print") {
      const html = buildPrintableHtml({
        kind: "quote",
        number: quote.quoteNumber,
        title: quote.title,
        status: quote.status,
        customerName: quote.customerName || "",
        customerPhone: quote.customerPhone,
        lineItems: quote.lineItems,
        subtotal: quote.subtotal,
        taxRate: quote.taxRate,
        taxAmount: quote.taxAmount,
        discount: quote.discount,
        total: quote.total,
        validUntil: quote.validUntil,
        notes: quote.notes,
        createdAt: quote.createdAt,
      });

      return new NextResponse(html, {
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    }

    return NextResponse.json(quote);
  } catch (error: unknown) {
    console.error("GET /api/quotes/[id] error:", error);
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: "Failed to load quote", message }, { status: 500 });
  }
}

async function handlePatch(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requirePermission("editSubscribers");
  if (isErrorResponse(auth)) return auth;
  const { user: currentUser } = auth;

  try {
    const { id } = await context.params;
    const quoteId = Number(id);
    const body = await req.json();

    if (!Number.isFinite(quoteId) || quoteId <= 0) {
      return NextResponse.json({ error: "Invalid quote id" }, { status: 400 });
    }

    const existing = await loadQuote(quoteId);
    if (!existing) {
      return NextResponse.json({ error: "Quote not found" }, { status: 404 });
    }

    const fields: string[] = [];
    const values: unknown[] = [];

    if (body.title != null) {
      fields.push("title = ?");
      values.push(String(body.title));
    }
    if (body.status != null) {
      if (!isQuoteStatus(String(body.status))) {
        return NextResponse.json({ error: "Invalid status" }, { status: 400 });
      }
      fields.push("status = ?");
      values.push(String(body.status));
    }
    if (body.notes !== undefined) {
      fields.push("notes = ?");
      values.push(body.notes ? String(body.notes) : null);
    }
    if (body.validUntil !== undefined) {
      fields.push("validUntil = ?");
      values.push(body.validUntil ? new Date(body.validUntil) : null);
    }

    const lineItems = body.lineItems != null ? parseLineItems(body.lineItems) : existing.lineItems;
    if (body.lineItems != null || body.taxRate != null || body.discount != null) {
      const totals = calculateDocumentTotals({
        lineItems,
        taxRate: body.taxRate ?? existing.taxRate,
        discount: body.discount ?? existing.discount,
      });
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

    if (!fields.length) {
      return NextResponse.json({ error: "No fields to update" }, { status: 400 });
    }

    fields.push("updatedAt = NOW()");
    values.push(quoteId);
    await execute(`UPDATE Quote SET ${fields.join(", ")} WHERE id = ?`, values);

    const quote = await loadQuote(quoteId);

    if (body.status === "approved" && existing.status !== "approved" && quote) {
      await runAutomations("quote_approved", {
        customerId: quote.customerId,
        userId: currentUser.id,
        username: currentUser.username,
        entityId: quoteId,
        entityLabel: quote.title,
      });
    }

    await writeActivityLog(currentUser, "تعديل عرض سعر", "العروض", quote?.title || "", quoteId);
    return NextResponse.json(quote);
  } catch (error: unknown) {
    console.error("PATCH /api/quotes/[id] error:", error);
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: "Failed to update quote", message }, { status: 500 });
  }
}

async function handleDelete(
  _req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requirePermission("editSubscribers");
  if (isErrorResponse(auth)) return auth;
  const { user: currentUser } = auth;

  try {
    const { id } = await context.params;
    const quoteId = Number(id);
    const existing = await loadQuote(quoteId);

    if (!existing) {
      return NextResponse.json({ error: "Quote not found" }, { status: 404 });
    }

    await execute("DELETE FROM Quote WHERE id = ?", [quoteId]);
    await writeActivityLog(currentUser, "حذف عرض سعر", "العروض", existing.title, quoteId);
    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    console.error("DELETE /api/quotes/[id] error:", error);
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: "Failed to delete quote", message }, { status: 500 });
  }
}

export const GET = loggedRoute("GET /api/quotes/[id]", handleGet);
export const PATCH = loggedRoute("PATCH /api/quotes/[id]", handlePatch);
export const DELETE = loggedRoute("DELETE /api/quotes/[id]", handleDelete);

import { NextResponse } from "next/server";
import { execute, query } from "@/lib/db";
import { isErrorResponse, requirePermission } from "@/lib/permissions";
import { loggedRoute } from "@/lib/api-observability";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function mapRow(row: Record<string, unknown>) {
  return {
    id: Number(row.id),
    sku: String(row.sku || ""),
    name: String(row.name || ""),
    category: String(row.category || "insurance"),
    description: row.description ? String(row.description) : null,
    unitPrice: Number(row.unitPrice || 0),
    isActive: Boolean(row.isActive),
    createdAt: new Date(row.createdAt as string | Date).toISOString(),
    updatedAt: new Date(row.updatedAt as string | Date).toISOString(),
  };
}

async function handlePatch(req: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requirePermission("editSubscribers");
  if (isErrorResponse(auth)) return auth;

  const { id } = await context.params;
  const productId = Number(id);
  if (!Number.isFinite(productId)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const body = await req.json();
  const fields: string[] = [];
  const values: unknown[] = [];

  if (body.name != null) {
    fields.push("name = ?");
    values.push(String(body.name));
  }
  if (body.category != null) {
    fields.push("category = ?");
    values.push(String(body.category));
  }
  if (body.description !== undefined) {
    fields.push("description = ?");
    values.push(body.description ? String(body.description) : null);
  }
  if (body.unitPrice != null) {
    fields.push("unitPrice = ?");
    values.push(Number(body.unitPrice || 0));
  }
  if (body.isActive != null) {
    fields.push("isActive = ?");
    values.push(Boolean(body.isActive));
  }

  if (!fields.length) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  fields.push("updatedAt = NOW()");
  values.push(productId);

  await execute(`UPDATE Product SET ${fields.join(", ")} WHERE id = ?`, values);

  const rows = await query<Record<string, unknown>>("SELECT * FROM Product WHERE id = ? LIMIT 1", [productId]);
  if (!rows.length) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json(mapRow(rows[0]));
}

async function handleDelete(_req: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requirePermission("editSubscribers");
  if (isErrorResponse(auth)) return auth;

  const { id } = await context.params;
  const productId = Number(id);
  await execute("UPDATE Product SET isActive = false, updatedAt = NOW() WHERE id = ?", [productId]);
  return NextResponse.json({ ok: true });
}

export const PATCH = loggedRoute("PATCH /api/products/[id]", handlePatch);
export const DELETE = loggedRoute("DELETE /api/products/[id]", handleDelete);

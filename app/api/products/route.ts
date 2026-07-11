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

async function handleGet(req: Request) {
  const auth = await requirePermission("viewSubscribers");
  if (isErrorResponse(auth)) return auth;

  const url = new URL(req.url);
  const activeOnly = url.searchParams.get("active") === "true";

  const rows = await query<Record<string, unknown>>(
    `SELECT * FROM Product ${activeOnly ? "WHERE isActive = true" : ""} ORDER BY name ASC`
  );

  return NextResponse.json(rows.map(mapRow));
}

async function handlePost(req: Request) {
  const auth = await requirePermission("editSubscribers");
  if (isErrorResponse(auth)) return auth;

  const body = await req.json();
  const sku = String(body.sku || "").trim();
  const name = String(body.name || "").trim();

  if (!sku || !name) {
    return NextResponse.json({ error: "sku and name are required" }, { status: 400 });
  }

  const result = await execute(
    `INSERT INTO Product (sku, name, category, description, unitPrice, isActive, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, ?, true, NOW(), NOW())`,
    [
      sku,
      name,
      String(body.category || "insurance"),
      body.description ? String(body.description) : null,
      Number(body.unitPrice || 0),
    ]
  );

  const rows = await query<Record<string, unknown>>("SELECT * FROM Product WHERE id = ? LIMIT 1", [
    result.insertId,
  ]);

  return NextResponse.json(mapRow(rows[0] || {}));
}

export const GET = loggedRoute("GET /api/products", handleGet);
export const POST = loggedRoute("POST /api/products", handlePost);

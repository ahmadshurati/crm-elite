import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { requireSessionOrApiKey } from "@/lib/api-auth";
import { isErrorResponse } from "@/lib/permissions";
import { parsePaginationParams, buildPaginationMeta } from "@/lib/pagination";
import { loggedRoute } from "@/lib/api-observability";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function handleGet(req: Request) {
  const auth = await requireSessionOrApiKey(req, "read:customers");
  if (isErrorResponse(auth)) return auth;

  const url = new URL(req.url);
  const { page, limit, offset } = parsePaginationParams(url);

  const totalRow = await query<{ total: number }>(
    "SELECT COUNT(*) AS total FROM Customer WHERE isArchived = false"
  );
  const total = Number(totalRow[0]?.total || 0);

  const rows = await query<Record<string, unknown>>(
    `SELECT id, name, phone, email, address, city, country, customerStatus, source, tags, createdAt
     FROM Customer
     WHERE isArchived = false
     ORDER BY id DESC
     LIMIT ? OFFSET ?`,
    [limit, offset]
  );

  return NextResponse.json({
    items: rows.map((row) => ({
      id: Number(row.id),
      name: String(row.name || ""),
      phone: row.phone ? String(row.phone) : null,
      email: row.email ? String(row.email) : null,
      address: row.address ? String(row.address) : null,
      city: row.city ? String(row.city) : null,
      country: row.country ? String(row.country) : null,
      customerStatus: row.customerStatus ? String(row.customerStatus) : null,
      source: row.source ? String(row.source) : null,
      tags: row.tags ? String(row.tags) : null,
      createdAt: new Date(row.createdAt as string | Date).toISOString(),
    })),
    pagination: buildPaginationMeta(page, limit, total),
  });
}

export const GET = loggedRoute("GET /api/v1/customers", handleGet);

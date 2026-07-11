import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { requireSessionOrApiKey } from "@/lib/api-auth";
import { isErrorResponse } from "@/lib/permissions";
import { parsePaginationParams, buildPaginationMeta } from "@/lib/pagination";
import { loggedRoute } from "@/lib/api-observability";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function handleGet(req: Request) {
  const auth = await requireSessionOrApiKey(req, "read:deals");
  if (isErrorResponse(auth)) return auth;

  const url = new URL(req.url);
  const { page, limit, offset } = parsePaginationParams(url);

  const totalRow = await query<{ total: number }>(
    "SELECT COUNT(*) AS total FROM Deal WHERE isArchived = false"
  );
  const total = Number(totalRow[0]?.total || 0);

  const rows = await query<Record<string, unknown>>(
    `SELECT d.id, d.customerId, d.title, d.stage, d.value, d.probability, d.expectedClose, d.notes, d.createdAt, c.name AS customerName
     FROM Deal d
     INNER JOIN Customer c ON c.id = d.customerId
     WHERE d.isArchived = false
     ORDER BY d.updatedAt DESC
     LIMIT ? OFFSET ?`,
    [limit, offset]
  );

  return NextResponse.json({
    items: rows.map((row) => ({
      id: Number(row.id),
      customerId: Number(row.customerId),
      customerName: String(row.customerName || ""),
      title: String(row.title || ""),
      stage: String(row.stage || ""),
      value: Number(row.value || 0),
      probability: Number(row.probability || 0),
      expectedClose: row.expectedClose
        ? new Date(row.expectedClose as string | Date).toISOString().slice(0, 10)
        : null,
      notes: row.notes ? String(row.notes) : null,
      createdAt: new Date(row.createdAt as string | Date).toISOString(),
    })),
    pagination: buildPaginationMeta(page, limit, total),
  });
}

export const GET = loggedRoute("GET /api/v1/deals", handleGet);

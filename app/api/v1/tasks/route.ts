import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { requireSessionOrApiKey } from "@/lib/api-auth";
import { isErrorResponse } from "@/lib/permissions";
import { parsePaginationParams, buildPaginationMeta } from "@/lib/pagination";
import { loggedRoute } from "@/lib/api-observability";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function handleGet(req: Request) {
  const auth = await requireSessionOrApiKey(req, "read:tasks");
  if (isErrorResponse(auth)) return auth;

  const url = new URL(req.url);
  const { page, limit, offset } = parsePaginationParams(url);
  const status = url.searchParams.get("status");

  const conditions = ["1=1"];
  const params: unknown[] = [];

  if (status) {
    conditions.push("t.status = ?");
    params.push(status);
  }

  const where = conditions.join(" AND ");

  const totalRow = await query<{ total: number }>(
    `SELECT COUNT(*) AS total FROM CrmTask t WHERE ${where}`,
    params
  );
  const total = Number(totalRow[0]?.total || 0);

  const rows = await query<Record<string, unknown>>(
    `SELECT t.id, t.customerId, t.title, t.type, t.description, t.dueDate, t.dueTime, t.priority, t.status, t.createdAt,
            c.name AS customerName
     FROM CrmTask t
     LEFT JOIN Customer c ON c.id = t.customerId
     WHERE ${where}
     ORDER BY t.dueDate ASC
     LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );

  return NextResponse.json({
    items: rows.map((row) => ({
      id: Number(row.id),
      customerId: row.customerId != null ? Number(row.customerId) : null,
      customerName: row.customerName ? String(row.customerName) : null,
      title: String(row.title || ""),
      type: String(row.type || ""),
      description: row.description ? String(row.description) : null,
      dueDate: new Date(row.dueDate as string | Date).toISOString().slice(0, 10),
      dueTime: row.dueTime ? String(row.dueTime) : null,
      priority: String(row.priority || ""),
      status: String(row.status || ""),
      createdAt: new Date(row.createdAt as string | Date).toISOString(),
    })),
    pagination: buildPaginationMeta(page, limit, total),
  });
}

export const GET = loggedRoute("GET /api/v1/tasks", handleGet);

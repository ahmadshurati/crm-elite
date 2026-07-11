import { NextResponse } from "next/server";
import { writeActivityLog } from "@/lib/audit-log";
import { execute, query } from "@/lib/db";
import { isErrorResponse, requirePermission } from "@/lib/permissions";
import { requireCompanyId } from "@/lib/tenant";
import { loggedRoute } from "@/lib/api-observability";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CONTRACT_STATUSES = new Set(["draft", "sent", "signed", "active", "expired", "cancelled"]);

function mapRow(row: Record<string, unknown>) {
  return {
    id: Number(row.id),
    customerId: Number(row.customerId),
    createdByUserId: row.createdByUserId != null ? Number(row.createdByUserId) : null,
    contractNumber: String(row.contractNumber || ""),
    title: String(row.title || ""),
    status: String(row.status || "draft"),
    startDate: row.startDate ? new Date(row.startDate as string | Date).toISOString().slice(0, 10) : null,
    endDate: row.endDate ? new Date(row.endDate as string | Date).toISOString().slice(0, 10) : null,
    renewalDate: row.renewalDate
      ? new Date(row.renewalDate as string | Date).toISOString().slice(0, 10)
      : null,
    documentUrl: row.documentUrl ? String(row.documentUrl) : null,
    signedAt: row.signedAt ? new Date(row.signedAt as string | Date).toISOString() : null,
    notes: row.notes ? String(row.notes) : null,
    customerName: row.customerName ? String(row.customerName) : null,
    createdAt: new Date(row.createdAt as string | Date).toISOString(),
    updatedAt: new Date(row.updatedAt as string | Date).toISOString(),
  };
}

async function handleGet(req: Request) {
  const auth = await requirePermission("viewSubscribers");
  if (isErrorResponse(auth)) return auth;

  const companyId = requireCompanyId(auth.user);
  const url = new URL(req.url);
  const customerId = url.searchParams.get("customerId");
  const status = url.searchParams.get("status");

  const conditions: string[] = ["c.companyId = ?"];
  const params: unknown[] = [companyId];

  if (customerId) {
    conditions.push("ct.customerId = ?");
    params.push(Number(customerId));
  }
  if (status) {
    conditions.push("ct.status = ?");
    params.push(status);
  }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

  const rows = await query<Record<string, unknown>>(
    `SELECT ct.*, c.name AS customerName
     FROM Contract ct
     INNER JOIN Customer c ON c.id = ct.customerId
     ${where}
     ORDER BY ct.updatedAt DESC`,
    params
  );

  return NextResponse.json(rows.map(mapRow));
}

async function handlePost(req: Request) {
  const auth = await requirePermission("editSubscribers");
  if (isErrorResponse(auth)) return auth;
  const { user } = auth;

  const body = await req.json();
  const customerId = Number(body.customerId);
  const title = String(body.title || "").trim();
  const contractNumber = String(body.contractNumber || `CTR-${Date.now()}`).trim();

  if (!Number.isFinite(customerId) || !title) {
    return NextResponse.json({ error: "customerId and title are required" }, { status: 400 });
  }

  const status = String(body.status || "draft");
  if (!CONTRACT_STATUSES.has(status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  const result = await execute(
    `INSERT INTO Contract (customerId, createdByUserId, contractNumber, title, status, startDate, endDate, renewalDate, documentUrl, signedAt, notes, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
    [
      customerId,
      user.id,
      contractNumber,
      title,
      status,
      body.startDate ? new Date(body.startDate) : null,
      body.endDate ? new Date(body.endDate) : null,
      body.renewalDate ? new Date(body.renewalDate) : null,
      body.documentUrl ? String(body.documentUrl) : null,
      body.signedAt ? new Date(body.signedAt) : null,
      body.notes ? String(body.notes) : null,
    ]
  );

  const rows = await query<Record<string, unknown>>(
    `SELECT ct.*, c.name AS customerName FROM Contract ct INNER JOIN Customer c ON c.id = ct.customerId WHERE ct.id = ? LIMIT 1`,
    [result.insertId]
  );

  await writeActivityLog(user, "إضافة عقد", "العقود", title, result.insertId);

  return NextResponse.json(mapRow(rows[0] || {}));
}

export const GET = loggedRoute("GET /api/contracts", handleGet);
export const POST = loggedRoute("POST /api/contracts", handlePost);

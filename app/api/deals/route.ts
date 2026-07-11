import { NextResponse } from "next/server";
import { writeActivityLog } from "@/lib/audit-log";
import { isDealStage } from "@/lib/crm/deals";
import { execute, query } from "@/lib/db";
import { assertCustomerExists } from "@/lib/ownership";
import { isErrorResponse, requirePermission } from "@/lib/permissions";
import { requireCompanyId } from "@/lib/tenant";
import { loggedRoute } from "@/lib/api-observability";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function mapRow(row: Record<string, unknown>) {
  return {
    id: Number(row.id),
    customerId: Number(row.customerId),
    assignedUserId: row.assignedUserId != null ? Number(row.assignedUserId) : null,
    title: String(row.title || ""),
    stage: String(row.stage || "new-lead"),
    value: Number(row.value || 0),
    probability: Number(row.probability || 0),
    expectedClose: row.expectedClose
      ? new Date(row.expectedClose as string | Date).toISOString().slice(0, 10)
      : null,
    notes: row.notes ? String(row.notes) : null,
    customerName: row.customerName ? String(row.customerName) : null,
    assignedUsername: row.assignedUsername ? String(row.assignedUsername) : null,
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
    const stage = url.searchParams.get("stage");

    const conditions: string[] = ["d.isArchived = false", "c.companyId = ?"];
    const params: unknown[] = [companyId];

    if (stage) {
      conditions.push("d.stage = ?");
      params.push(stage);
    }

    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

    const rows = await query<Record<string, unknown>>(
      `SELECT d.*, c.name AS customerName, u.username AS assignedUsername
       FROM Deal d
       INNER JOIN Customer c ON c.id = d.customerId
       LEFT JOIN AppUser u ON u.id = d.assignedUserId
       ${where}
       ORDER BY d.updatedAt DESC`,
      params
    );

    return NextResponse.json(rows.map(mapRow));
  } catch (error: unknown) {
    console.error("GET /api/deals error:", error);
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: "Failed to load deals", message }, { status: 500 });
  }
}

async function handlePost(req: Request) {
  const auth = await requirePermission("editSubscribers");
  if (isErrorResponse(auth)) return auth;
  const { user: currentUser } = auth;

  try {
    const companyId = requireCompanyId(currentUser);
    const body = await req.json();
    const customerId = Number(body.customerId);
    const title = String(body.title || "").trim();

    if (!Number.isFinite(customerId) || customerId <= 0) {
      return NextResponse.json({ error: "Invalid customerId" }, { status: 400 });
    }

    if (!title) {
      return NextResponse.json({ error: "Title is required" }, { status: 400 });
    }

    await assertCustomerExists(customerId, companyId);

    const stage = String(body.stage || "new-lead");
    if (!isDealStage(stage)) {
      return NextResponse.json({ error: "Invalid stage" }, { status: 400 });
    }

    const value = Number(body.value || 0);
    const probability = Math.min(100, Math.max(0, Number(body.probability || 0)));
    const expectedClose = body.expectedClose ? new Date(body.expectedClose) : null;

    if (expectedClose && Number.isNaN(expectedClose.getTime())) {
      return NextResponse.json({ error: "Invalid expectedClose" }, { status: 400 });
    }

    const assignedUserId =
      body.assignedUserId != null && body.assignedUserId !== "" ? Number(body.assignedUserId) : null;

    const result = await execute(
      `INSERT INTO Deal (customerId, assignedUserId, title, stage, value, probability, expectedClose, notes, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [
        customerId,
        assignedUserId,
        title,
        stage,
        value,
        probability,
        expectedClose,
        body.notes ? String(body.notes) : null,
      ]
    );

    const rows = await query<Record<string, unknown>>(
      `SELECT d.*, c.name AS customerName, u.username AS assignedUsername
       FROM Deal d
       INNER JOIN Customer c ON c.id = d.customerId
       LEFT JOIN AppUser u ON u.id = d.assignedUserId
       WHERE d.id = ? LIMIT 1`,
      [result.insertId]
    );

    await writeActivityLog(currentUser, "إضافة صفقة", "الصفقات", title, result.insertId);

    return NextResponse.json(mapRow(rows[0] || {}));
  } catch (error: unknown) {
    console.error("POST /api/deals error:", error);
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: "Failed to create deal", message }, { status: 500 });
  }
}

export const GET = loggedRoute("GET /api/deals", handleGet);
export const POST = loggedRoute("POST /api/deals", handlePost);

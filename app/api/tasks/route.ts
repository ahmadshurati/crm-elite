import { NextResponse } from "next/server";
import { writeActivityLog } from "@/lib/audit-log";
import { TASK_PRIORITIES, TASK_STATUSES, TASK_TYPES } from "@/lib/crm/tasks";
import { execute, query } from "@/lib/db";
import { isErrorResponse, requirePermission } from "@/lib/permissions";
import { requireCompanyId, taskCompanyScopeClause } from "@/lib/tenant";
import { assertCustomerExists } from "@/lib/ownership";
import { loggedRoute } from "@/lib/api-observability";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function mapRow(row: Record<string, unknown>) {
  return {
    id: Number(row.id),
    customerId: row.customerId != null ? Number(row.customerId) : null,
    assignedUserId: row.assignedUserId != null ? Number(row.assignedUserId) : null,
    createdByUserId: row.createdByUserId != null ? Number(row.createdByUserId) : null,
    title: String(row.title || ""),
    type: String(row.type || "follow-up"),
    description: row.description ? String(row.description) : null,
    dueDate: new Date(row.dueDate as string | Date).toISOString().slice(0, 10),
    dueTime: row.dueTime ? String(row.dueTime) : null,
    priority: String(row.priority || "medium"),
    status: String(row.status || "pending"),
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
    const status = url.searchParams.get("status");
    const from = url.searchParams.get("from");
    const to = url.searchParams.get("to");
    const scope = taskCompanyScopeClause(companyId);

    const conditions: string[] = [`1=1${scope.clause}`];
    const params: unknown[] = [...scope.params];

    if (status) {
      conditions.push("t.status = ?");
      params.push(status);
    }

    if (from) {
      conditions.push("t.dueDate >= ?");
      params.push(from);
    }

    if (to) {
      conditions.push("t.dueDate <= ?");
      params.push(to);
    }

    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

    const rows = await query<Record<string, unknown>>(
      `SELECT t.*, c.name AS customerName, u.username AS assignedUsername
       FROM CrmTask t
       LEFT JOIN Customer c ON c.id = t.customerId
       LEFT JOIN AppUser cb ON cb.id = t.createdByUserId
       LEFT JOIN AppUser u ON u.id = t.assignedUserId
       ${where}
       ORDER BY t.dueDate ASC, t.id DESC`,
      params
    );

    return NextResponse.json(rows.map(mapRow));
  } catch (error: unknown) {
    console.error("GET /api/tasks error:", error);
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: "Failed to load tasks", message }, { status: 500 });
  }
}

async function handlePost(req: Request) {
  const auth = await requirePermission("editSubscribers");
  if (isErrorResponse(auth)) return auth;
  const { user: currentUser } = auth;

  try {
    const companyId = requireCompanyId(currentUser);
    const body = await req.json();
    const title = String(body.title || "").trim();

    if (!title) {
      return NextResponse.json({ error: "Title is required" }, { status: 400 });
    }

    const type = String(body.type || "follow-up");
    const priority = String(body.priority || "medium");
    const status = String(body.status || "pending");

    if (!(TASK_TYPES as readonly string[]).includes(type)) {
      return NextResponse.json({ error: "Invalid task type" }, { status: 400 });
    }
    if (!(TASK_PRIORITIES as readonly string[]).includes(priority)) {
      return NextResponse.json({ error: "Invalid priority" }, { status: 400 });
    }
    if (!(TASK_STATUSES as readonly string[]).includes(status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }

    const dueDate = body.dueDate ? new Date(body.dueDate) : new Date();
    if (Number.isNaN(dueDate.getTime())) {
      return NextResponse.json({ error: "Invalid dueDate" }, { status: 400 });
    }

    const customerId = body.customerId != null && body.customerId !== "" ? Number(body.customerId) : null;
    if (customerId) await assertCustomerExists(customerId, companyId);
    const assignedUserId =
      body.assignedUserId != null && body.assignedUserId !== "" ? Number(body.assignedUserId) : null;

    const result = await execute(
      `INSERT INTO CrmTask (customerId, assignedUserId, createdByUserId, title, type, description, dueDate, dueTime, priority, status, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [
        customerId,
        assignedUserId,
        currentUser.id,
        title,
        type,
        body.description ? String(body.description) : null,
        dueDate,
        body.dueTime ? String(body.dueTime) : null,
        priority,
        status,
      ]
    );

    const rows = await query<Record<string, unknown>>(
      `SELECT t.*, c.name AS customerName, u.username AS assignedUsername
       FROM CrmTask t
       LEFT JOIN Customer c ON c.id = t.customerId
       LEFT JOIN AppUser u ON u.id = t.assignedUserId
       WHERE t.id = ? LIMIT 1`,
      [result.insertId]
    );

    await writeActivityLog(currentUser, "إضافة مهمة", "المهام", title, result.insertId);

    return NextResponse.json(mapRow(rows[0] || {}));
  } catch (error: unknown) {
    console.error("POST /api/tasks error:", error);
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: "Failed to create task", message }, { status: 500 });
  }
}

export const GET = loggedRoute("GET /api/tasks", handleGet);
export const POST = loggedRoute("POST /api/tasks", handlePost);

import { NextResponse } from "next/server";
import { writeActivityLog } from "@/lib/audit-log";
import { TASK_PRIORITIES, TASK_STATUSES, TASK_TYPES } from "@/lib/crm/tasks";
import { execute, query } from "@/lib/db";
import { isErrorResponse, requirePermission } from "@/lib/permissions";
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

async function handlePatch(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requirePermission("editSubscribers");
  if (isErrorResponse(auth)) return auth;
  const { user: currentUser } = auth;

  try {
    const { id } = await context.params;
    const taskId = Number(id);
    const body = await req.json();

    if (!Number.isFinite(taskId) || taskId <= 0) {
      return NextResponse.json({ error: "Invalid task id" }, { status: 400 });
    }

    const existing = await query<Record<string, unknown>>(
      "SELECT id, title FROM CrmTask WHERE id = ? LIMIT 1",
      [taskId]
    );

    if (!existing.length) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    const fields: string[] = [];
    const values: unknown[] = [];

    if (body.title != null) {
      fields.push("title = ?");
      values.push(String(body.title));
    }
    if (body.type != null) {
      if (!(TASK_TYPES as readonly string[]).includes(String(body.type))) {
        return NextResponse.json({ error: "Invalid task type" }, { status: 400 });
      }
      fields.push("type = ?");
      values.push(String(body.type));
    }
    if (body.description !== undefined) {
      fields.push("description = ?");
      values.push(body.description ? String(body.description) : null);
    }
    if (body.dueDate != null) {
      const dueDate = new Date(body.dueDate);
      if (Number.isNaN(dueDate.getTime())) {
        return NextResponse.json({ error: "Invalid dueDate" }, { status: 400 });
      }
      fields.push("dueDate = ?");
      values.push(dueDate);
    }
    if (body.dueTime !== undefined) {
      fields.push("dueTime = ?");
      values.push(body.dueTime ? String(body.dueTime) : null);
    }
    if (body.priority != null) {
      if (!(TASK_PRIORITIES as readonly string[]).includes(String(body.priority))) {
        return NextResponse.json({ error: "Invalid priority" }, { status: 400 });
      }
      fields.push("priority = ?");
      values.push(String(body.priority));
    }
    if (body.status != null) {
      if (!(TASK_STATUSES as readonly string[]).includes(String(body.status))) {
        return NextResponse.json({ error: "Invalid status" }, { status: 400 });
      }
      fields.push("status = ?");
      values.push(String(body.status));
    }
    if (body.customerId !== undefined) {
      fields.push("customerId = ?");
      values.push(body.customerId != null && body.customerId !== "" ? Number(body.customerId) : null);
    }
    if (body.assignedUserId !== undefined) {
      fields.push("assignedUserId = ?");
      values.push(body.assignedUserId != null && body.assignedUserId !== "" ? Number(body.assignedUserId) : null);
    }

    if (!fields.length) {
      return NextResponse.json({ error: "No fields to update" }, { status: 400 });
    }

    fields.push("updatedAt = NOW()");
    values.push(taskId);

    await execute(`UPDATE CrmTask SET ${fields.join(", ")} WHERE id = ?`, values);

    const rows = await query<Record<string, unknown>>(
      `SELECT t.*, c.name AS customerName, u.username AS assignedUsername
       FROM CrmTask t
       LEFT JOIN Customer c ON c.id = t.customerId
       LEFT JOIN AppUser u ON u.id = t.assignedUserId
       WHERE t.id = ? LIMIT 1`,
      [taskId]
    );

    await writeActivityLog(
      currentUser,
      "تعديل مهمة",
      "المهام",
      String(body.title || existing[0].title),
      taskId
    );

    return NextResponse.json(mapRow(rows[0] || {}));
  } catch (error: unknown) {
    console.error("PATCH /api/tasks/[id] error:", error);
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: "Failed to update task", message }, { status: 500 });
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
    const taskId = Number(id);

    if (!Number.isFinite(taskId) || taskId <= 0) {
      return NextResponse.json({ error: "Invalid task id" }, { status: 400 });
    }

    const existing = await query<Record<string, unknown>>(
      "SELECT id, title FROM CrmTask WHERE id = ? LIMIT 1",
      [taskId]
    );

    if (!existing.length) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    await execute("DELETE FROM CrmTask WHERE id = ?", [taskId]);

    await writeActivityLog(
      currentUser,
      "حذف مهمة",
      "المهام",
      String(existing[0].title),
      taskId
    );

    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    console.error("DELETE /api/tasks/[id] error:", error);
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: "Failed to delete task", message }, { status: 500 });
  }
}

export const PATCH = loggedRoute("PATCH /api/tasks/[id]", handlePatch);
export const DELETE = loggedRoute("DELETE /api/tasks/[id]", handleDelete);

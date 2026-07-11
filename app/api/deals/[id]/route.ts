import { NextResponse } from "next/server";
import { writeActivityLog } from "@/lib/audit-log";
import { logFieldChanges } from "@/lib/field-audit";
import { isDealStage } from "@/lib/crm/deals";
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

async function handlePatch(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requirePermission("editSubscribers");
  if (isErrorResponse(auth)) return auth;
  const { user: currentUser } = auth;

  try {
    const { id } = await context.params;
    const dealId = Number(id);
    const body = await req.json();

    if (!Number.isFinite(dealId) || dealId <= 0) {
      return NextResponse.json({ error: "Invalid deal id" }, { status: 400 });
    }

    const existing = await query<Record<string, unknown>>(
      "SELECT id, title, stage, customerId, value, probability, notes FROM Deal WHERE id = ? LIMIT 1",
      [dealId]
    );

    if (!existing.length) {
      return NextResponse.json({ error: "Deal not found" }, { status: 404 });
    }

    if (body.action === "archive") {
      await execute("UPDATE Deal SET isArchived = true, archivedAt = NOW(), updatedAt = NOW() WHERE id = ?", [dealId]);
      await writeActivityLog(currentUser, "أرشفة صفقة", "الصفقات", String(existing[0].title), dealId);
      return NextResponse.json({ ok: true, isArchived: true });
    }

    if (body.action === "restore") {
      await execute("UPDATE Deal SET isArchived = false, archivedAt = NULL, updatedAt = NOW() WHERE id = ?", [dealId]);
      await writeActivityLog(currentUser, "استعادة صفقة", "الصفقات", String(existing[0].title), dealId);
      return NextResponse.json({ ok: true, isArchived: false });
    }

    const fields: string[] = [];
    const values: unknown[] = [];

    if (body.title != null) {
      fields.push("title = ?");
      values.push(String(body.title));
    }
    if (body.stage != null) {
      if (!isDealStage(String(body.stage))) {
        return NextResponse.json({ error: "Invalid stage" }, { status: 400 });
      }
      fields.push("stage = ?");
      values.push(String(body.stage));
    }
    if (body.value != null) {
      fields.push("value = ?");
      values.push(Number(body.value || 0));
    }
    if (body.probability != null) {
      fields.push("probability = ?");
      values.push(Math.min(100, Math.max(0, Number(body.probability || 0))));
    }
    if (body.expectedClose !== undefined) {
      if (body.expectedClose) {
        const expectedClose = new Date(body.expectedClose);
        if (Number.isNaN(expectedClose.getTime())) {
          return NextResponse.json({ error: "Invalid expectedClose" }, { status: 400 });
        }
        fields.push("expectedClose = ?");
        values.push(expectedClose);
      } else {
        fields.push("expectedClose = NULL");
      }
    }
    if (body.notes !== undefined) {
      fields.push("notes = ?");
      values.push(body.notes ? String(body.notes) : null);
    }
    if (body.assignedUserId !== undefined) {
      fields.push("assignedUserId = ?");
      values.push(body.assignedUserId != null && body.assignedUserId !== "" ? Number(body.assignedUserId) : null);
    }

    if (!fields.length) {
      return NextResponse.json({ error: "No fields to update" }, { status: 400 });
    }

    fields.push("updatedAt = NOW()");
    values.push(dealId);

    await execute(`UPDATE Deal SET ${fields.join(", ")} WHERE id = ?`, values);

    await logFieldChanges({
      user: currentUser,
      module: "الصفقات",
      entityType: "Deal",
      entityId: dealId,
      before: existing[0],
      after: {
        title: body.title != null ? String(body.title) : existing[0].title,
        stage: body.stage != null ? String(body.stage) : existing[0].stage,
        value: body.value != null ? Number(body.value || 0) : existing[0].value,
        probability:
          body.probability != null
            ? Math.min(100, Math.max(0, Number(body.probability || 0)))
            : existing[0].probability,
        notes: body.notes !== undefined ? body.notes : existing[0].notes,
      },
      fields: ["title", "stage", "value", "probability", "notes"],
    });

    const rows = await query<Record<string, unknown>>(
      `SELECT d.*, c.name AS customerName, u.username AS assignedUsername
       FROM Deal d
       INNER JOIN Customer c ON c.id = d.customerId
       LEFT JOIN AppUser u ON u.id = d.assignedUserId
       WHERE d.id = ? LIMIT 1`,
      [dealId]
    );

    const deal = mapRow(rows[0] || {});

    if (body.stage === "won" && String(existing[0].stage) !== "won") {
      await runAutomations("deal_won", {
        customerId: Number(existing[0].customerId),
        userId: currentUser.id,
        username: currentUser.username,
        entityId: dealId,
        entityLabel: deal.title,
      });
    }

    await writeActivityLog(
      currentUser,
      "تعديل صفقة",
      "الصفقات",
      String(body.title || existing[0].title),
      dealId
    );

    return NextResponse.json(deal);
  } catch (error: unknown) {
    console.error("PATCH /api/deals/[id] error:", error);
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: "Failed to update deal", message }, { status: 500 });
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
    const dealId = Number(id);

    if (!Number.isFinite(dealId) || dealId <= 0) {
      return NextResponse.json({ error: "Invalid deal id" }, { status: 400 });
    }

    const existing = await query<Record<string, unknown>>(
      "SELECT id, title FROM Deal WHERE id = ? LIMIT 1",
      [dealId]
    );

    if (!existing.length) {
      return NextResponse.json({ error: "Deal not found" }, { status: 404 });
    }

    await execute("DELETE FROM Deal WHERE id = ?", [dealId]);

    await writeActivityLog(
      currentUser,
      "حذف صفقة",
      "الصفقات",
      String(existing[0].title),
      dealId
    );

    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    console.error("DELETE /api/deals/[id] error:", error);
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: "Failed to delete deal", message }, { status: 500 });
  }
}

export const PATCH = loggedRoute("PATCH /api/deals/[id]", handlePatch);
export const DELETE = loggedRoute("DELETE /api/deals/[id]", handleDelete);

import { NextResponse } from "next/server";
import { writeActivityLog } from "@/lib/audit-log";
import { execute, query } from "@/lib/db";
import { isErrorResponse, requirePermission } from "@/lib/permissions";
import { loggedRoute } from "@/lib/api-observability";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function handlePatch(req: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requirePermission("editSubscribers");
  if (isErrorResponse(auth)) return auth;
  const { user } = auth;

  const { id } = await context.params;
  const contractId = Number(id);
  const body = await req.json();

  const fields: string[] = [];
  const values: unknown[] = [];

  const allowed = [
    "title",
    "status",
    "startDate",
    "endDate",
    "renewalDate",
    "documentUrl",
    "signedAt",
    "notes",
  ] as const;

  for (const key of allowed) {
    if (body[key] !== undefined) {
      fields.push(`${key} = ?`);
      if (key.endsWith("Date") || key === "signedAt") {
        values.push(body[key] ? new Date(body[key]) : null);
      } else {
        values.push(body[key] != null ? String(body[key]) : null);
      }
    }
  }

  if (!fields.length) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  fields.push("updatedAt = NOW()");
  values.push(contractId);

  await execute(`UPDATE Contract SET ${fields.join(", ")} WHERE id = ?`, values);

  const rows = await query<Record<string, unknown>>(
    `SELECT ct.*, c.name AS customerName FROM Contract ct INNER JOIN Customer c ON c.id = ct.customerId WHERE ct.id = ? LIMIT 1`,
    [contractId]
  );

  if (!rows.length) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await writeActivityLog(user, "تحديث عقد", "العقود", String(body.title || contractId), contractId);

  return NextResponse.json({
    id: Number(rows[0].id),
    customerId: Number(rows[0].customerId),
    contractNumber: String(rows[0].contractNumber),
    title: String(rows[0].title),
    status: String(rows[0].status),
    documentUrl: rows[0].documentUrl ? String(rows[0].documentUrl) : null,
    customerName: rows[0].customerName ? String(rows[0].customerName) : null,
  });
}

export const PATCH = loggedRoute("PATCH /api/contracts/[id]", handlePatch);

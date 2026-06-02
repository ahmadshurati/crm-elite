import { NextResponse } from "next/server";
import { writeActivityLog } from "@/lib/audit-log";
import { execute, query, queryOne, withTransaction } from "@/lib/db";
import { isErrorResponse, requirePermission } from "@/lib/permissions";
import { loggedRoute } from "@/lib/api-observability";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function getAccident(id: number) {
  const accident = await queryOne<any>("SELECT * FROM AccidentCase WHERE id = ? LIMIT 1", [id]);
  if (!accident) return null;

  const customer = await queryOne<any>("SELECT * FROM Customer WHERE id = ? LIMIT 1", [accident.customerId]);
  const car = await queryOne<any>("SELECT * FROM Car WHERE id = ? LIMIT 1", [accident.carId]);
  const updates = await query<any>("SELECT * FROM AccidentUpdate WHERE accidentCaseId = ? ORDER BY id ASC", [id]);

  return { ...accident, customer, car, updates };
}

async function handleGet(req: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requirePermission("viewAccidents");
  if (isErrorResponse(auth)) return auth;

  try {
    const { id } = await context.params;
    const accident = await getAccident(Number(id));

    if (!accident) {
      return NextResponse.json({ error: "Accident not found" }, { status: 404 });
    }

    return NextResponse.json(accident);
  } catch (error: any) {
    console.error("GET /api/accidents/[id] error:", error);
    return NextResponse.json({ error: "Failed to load accident", message: error?.message }, { status: 500 });
  }
}

async function handlePatch(req: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requirePermission("editAccidents");
  if (isErrorResponse(auth)) return auth;
  const { user: currentUser } = auth;

  try {
    const { id } = await context.params;
    const accidentId = Number(id);
    const body = await req.json();

    const existing = await queryOne<any>("SELECT * FROM AccidentCase WHERE id = ? LIMIT 1", [accidentId]);
    if (!existing) {
      return NextResponse.json({ error: "Accident not found" }, { status: 404 });
    }

    await execute(
      "UPDATE AccidentCase SET details = ?, status = ?, closedAt = ? WHERE id = ?",
      [
        String(body.details || ""),
        String(body.status || "مفتوح"),
        body.status === "مغلق" ? new Date() : null,
        accidentId,
      ]
    );

    const updated = await getAccident(accidentId);

    await writeActivityLog(
      currentUser,
      "تعديل حادث",
      "الحوادث",
      `${String(existing.caseNumber || "")} - ${String(body.details || "").slice(0, 80)}`,
      accidentId
    );

    return NextResponse.json(updated);
  } catch (error: any) {
    console.error("PATCH /api/accidents/[id] error:", error);
    return NextResponse.json({ error: "Failed to update accident", message: error?.message }, { status: 500 });
  }
}

async function handleDelete(req: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requirePermission("deleteAccidents");
  if (isErrorResponse(auth)) return auth;
  const { user: currentUser } = auth;

  try {
    const { id } = await context.params;
    const accidentId = Number(id);

    if (!Number.isFinite(accidentId) || accidentId <= 0) {
      return NextResponse.json({ error: "Invalid accident id" }, { status: 400 });
    }

    const existing = await queryOne<any>(
      "SELECT id, caseNumber, details FROM AccidentCase WHERE id = ? LIMIT 1",
      [accidentId]
    );

    if (!existing) {
      return NextResponse.json({ error: "Accident not found" }, { status: 404 });
    }

    await withTransaction(async (tx) => {
      await tx.execute("DELETE FROM AccidentUpdate WHERE accidentCaseId = ?", [accidentId]);
      await tx.execute("DELETE FROM AccidentCase WHERE id = ?", [accidentId]);
    });

    await writeActivityLog(
      currentUser,
      "حذف حادث",
      "الحوادث",
      `${String(existing.caseNumber || "")} - ${String(existing.details || "").slice(0, 80)}`,
      accidentId
    );

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error("DELETE /api/accidents/[id] error:", error);
    return NextResponse.json({ error: "Failed to delete accident", message: error?.message }, { status: 500 });
  }
}

export const GET = loggedRoute("GET /api/accidents/[id]", handleGet);
export const PATCH = loggedRoute("PATCH /api/accidents/[id]", handlePatch);
export const DELETE = loggedRoute("DELETE /api/accidents/[id]", handleDelete);

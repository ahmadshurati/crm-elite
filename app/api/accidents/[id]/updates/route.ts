import { NextResponse } from "next/server";
import { writeActivityLog } from "@/lib/audit-log";
import { execute, queryOne } from "@/lib/db";
import { isErrorResponse, requirePermission } from "@/lib/permissions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requirePermission("editAccidents");
  if (isErrorResponse(auth)) return auth;
  const { user: currentUser } = auth;

  try {
    const { id } = await context.params;
    const accidentId = Number(id);
    const body = await req.json();

    const accident = await queryOne<any>("SELECT id, caseNumber FROM AccidentCase WHERE id = ? LIMIT 1", [accidentId]);
    if (!accident) {
      return NextResponse.json({ error: "Accident not found" }, { status: 404 });
    }

    const result = await execute(
      "INSERT INTO AccidentUpdate (accidentCaseId, text, createdAt) VALUES (?, ?, NOW())",
      [accidentId, String(body.text || "")]
    );

    const update = await queryOne<any>("SELECT * FROM AccidentUpdate WHERE id = ? LIMIT 1", [result.insertId]);

    await writeActivityLog(
      currentUser,
      "إضافة تحديث حادث",
      "الحوادث",
      `${accident.caseNumber}: ${String(body.text || "").slice(0, 80)}`,
      accidentId
    );

    return NextResponse.json(update);
  } catch (error: any) {
    console.error("POST /api/accidents/[id]/updates error:", error);
    return NextResponse.json({ error: "Failed to add accident update", message: error?.message }, { status: 500 });
  }
}

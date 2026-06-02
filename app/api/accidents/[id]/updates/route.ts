import { NextResponse } from "next/server";
import { execute, queryOne } from "@/lib/db";
import { isErrorResponse, requirePermission } from "@/lib/permissions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requirePermission("editAccidents");
  if (isErrorResponse(auth)) return auth;

  try {
    const { id } = await context.params;
    const body = await req.json();

    const result = await execute(
      "INSERT INTO AccidentUpdate (accidentCaseId, text, createdAt) VALUES (?, ?, NOW())",
      [Number(id), String(body.text || "")]
    );

    const update = await queryOne<any>("SELECT * FROM AccidentUpdate WHERE id = ? LIMIT 1", [result.insertId]);
    return NextResponse.json(update);
  } catch (error: any) {
    console.error("POST /api/accidents/[id]/updates error:", error);
    return NextResponse.json({ error: "Failed to add accident update", message: error?.message }, { status: 500 });
  }
}

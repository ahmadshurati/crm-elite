import { NextResponse } from "next/server";
import { execute, query, queryOne } from "@/lib/db";

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

export async function GET(req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    return NextResponse.json(await getAccident(Number(id)));
  } catch (error: any) {
    console.error("GET /api/accidents/[id] error:", error);
    return NextResponse.json({ error: "Failed to load accident", message: error?.message }, { status: 500 });
  }
}

export async function PATCH(req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const body = await req.json();

    await execute(
      "UPDATE AccidentCase SET details = ?, status = ?, closedAt = ? WHERE id = ?",
      [String(body.details || ""), String(body.status || "مفتوح"), body.status === "مغلق" ? new Date() : null, Number(id)]
    );

    return NextResponse.json(await getAccident(Number(id)));
  } catch (error: any) {
    console.error("PATCH /api/accidents/[id] error:", error);
    return NextResponse.json({ error: "Failed to update accident", message: error?.message }, { status: 500 });
  }
}

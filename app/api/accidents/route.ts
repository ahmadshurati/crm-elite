import { NextResponse } from "next/server";
import { execute, query } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function getAccidents() {
  const accidents = await query<any>("SELECT * FROM AccidentCase ORDER BY id DESC");
  const customers = await query<any>("SELECT * FROM Customer");
  const cars = await query<any>("SELECT * FROM Car");
  const updates = await query<any>("SELECT * FROM AccidentUpdate ORDER BY id ASC");

  return accidents.map((accident) => ({
    ...accident,
    customer: customers.find((customer) => Number(customer.id) === Number(accident.customerId)) || null,
    car: cars.find((car) => Number(car.id) === Number(accident.carId)) || null,
    updates: updates.filter((update) => Number(update.accidentCaseId) === Number(accident.id)),
  }));
}

export async function GET() {
  try {
    return NextResponse.json(await getAccidents());
  } catch (error: any) {
    console.error("GET /api/accidents error:", error);
    return NextResponse.json({ error: "Failed to load accidents", message: error?.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const result = await execute(
      "INSERT INTO AccidentCase (customerId, carId, caseNumber, details, status, openedAt, closedAt) VALUES (?, ?, ?, ?, ?, NOW(), NULL)",
      [
        Number(body.customerId),
        Number(body.carId),
        String(body.caseNumber || ""),
        String(body.details || ""),
        String(body.status || "مفتوح"),
      ]
    );

    const accident = (await getAccidents()).find((row) => Number(row.id) === result.insertId);
    return NextResponse.json(accident);
  } catch (error: any) {
    console.error("POST /api/accidents error:", error);
    return NextResponse.json({ error: "Failed to create accident", message: error?.message }, { status: 500 });
  }
}

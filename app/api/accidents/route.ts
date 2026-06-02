import { NextResponse } from "next/server";
import { writeActivityLog } from "@/lib/audit-log";
import { execute, query } from "@/lib/db";
import { assertCarBelongsToCustomer, OwnershipError } from "@/lib/ownership";
import { isErrorResponse, requirePermission } from "@/lib/permissions";

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
  const auth = await requirePermission("viewAccidents");
  if (isErrorResponse(auth)) return auth;

  try {
    return NextResponse.json(await getAccidents());
  } catch (error: any) {
    console.error("GET /api/accidents error:", error);
    return NextResponse.json({ error: "Failed to load accidents", message: error?.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const auth = await requirePermission("createAccidents");
  if (isErrorResponse(auth)) return auth;
  const { user: currentUser } = auth;

  try {
    const body = await req.json();
    const customerId = Number(body.customerId);
    const carId = Number(body.carId);

    if (!Number.isFinite(customerId) || customerId <= 0 || !Number.isFinite(carId) || carId <= 0) {
      return NextResponse.json({ error: "Invalid customerId or carId" }, { status: 400 });
    }

    await assertCarBelongsToCustomer(carId, customerId);

    const result = await execute(
      "INSERT INTO AccidentCase (customerId, carId, caseNumber, details, status, openedAt, closedAt) VALUES (?, ?, ?, ?, ?, NOW(), NULL)",
      [
        customerId,
        carId,
        String(body.caseNumber || ""),
        String(body.details || ""),
        String(body.status || "مفتوح"),
      ]
    );

    const accident = (await getAccidents()).find((row) => Number(row.id) === result.insertId);

    await writeActivityLog(
      currentUser,
      "إضافة حادث",
      "الحوادث",
      `${String(body.caseNumber || "")} - ${String(body.details || "").slice(0, 80)}`,
      result.insertId
    );

    return NextResponse.json(accident);
  } catch (error: any) {
    console.error("POST /api/accidents error:", error);

    if (error instanceof OwnershipError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ error: "Failed to create accident", message: error?.message }, { status: 500 });
  }
}

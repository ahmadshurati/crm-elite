import { NextResponse } from "next/server";
import { writeActivityLog } from "@/lib/audit-log";
import { execute } from "@/lib/db";
import { getAccidentById, getPaginatedAccidents } from "@/lib/accidents-data";
import { assertCarBelongsToCustomer, OwnershipError } from "@/lib/ownership";
import { parsePaginationParams } from "@/lib/pagination";
import { isErrorResponse, requirePermission } from "@/lib/permissions";
import { requireCompanyId } from "@/lib/tenant";
import { loggedRoute } from "@/lib/api-observability";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function handleGet(req: Request) {
  const auth = await requirePermission("viewAccidents");
  if (isErrorResponse(auth)) return auth;

  try {
    const url = new URL(req.url);
    const { page, limit, offset } = parsePaginationParams(url);
    const filter = String(url.searchParams.get("filter") || "all");
    const search = String(url.searchParams.get("q") || "");

    const companyId = requireCompanyId(auth.user);
    const result = await getPaginatedAccidents({ page, limit, offset, filter, search, companyId });
    return NextResponse.json(result);
  } catch (error: any) {
    console.error("GET /api/accidents error:", error);
    return NextResponse.json({ error: "Failed to load accidents", message: error?.message }, { status: 500 });
  }
}

async function handlePost(req: Request) {
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

    const accident = await getAccidentById(result.insertId);

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

export const GET = loggedRoute("GET /api/accidents", handleGet);
export const POST = loggedRoute("POST /api/accidents", handlePost);

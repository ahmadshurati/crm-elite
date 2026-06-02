import { NextResponse } from "next/server";
import { buildAccountingCsv } from "@/lib/export-accounting";
import { isErrorResponse, requirePermission } from "@/lib/permissions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requirePermission("viewAccounting");
  if (isErrorResponse(auth)) return auth;

  try {
    const csv = await buildAccountingCsv();
    const date = new Date().toISOString().slice(0, 10);
    const filename = `accounting-export-${date}.csv`;

    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error: any) {
    console.error("GET /api/customers/export error:", error);
    return NextResponse.json({ error: "Failed to export data", message: error?.message }, { status: 500 });
  }
}

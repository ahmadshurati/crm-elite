import { NextResponse } from "next/server";
import { writeActivityLog } from "@/lib/audit-log";
import { buildImportTemplateCsv, parseCustomerImportCsv } from "@/lib/crm/csv-import";
import { importCustomerRows } from "@/lib/crm/import-customers";
import { isErrorResponse, requirePermission } from "@/lib/permissions";
import { loggedRoute } from "@/lib/api-observability";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function handleGet() {
  const auth = await requirePermission("createSubscribers");
  if (isErrorResponse(auth)) return auth;

  const csv = buildImportTemplateCsv();
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="customers-import-template.csv"',
    },
  });
}

async function handlePost(req: Request) {
  const auth = await requirePermission("createSubscribers");
  if (isErrorResponse(auth)) return auth;
  const { user: currentUser } = auth;

  try {
    const body = await req.json();
    const csvText = String(body.csv || "");

    if (!csvText.trim()) {
      return NextResponse.json({ error: "CSV content is required" }, { status: 400 });
    }

    const parsed = parseCustomerImportCsv(csvText);
    if (!parsed.rows.length) {
      return NextResponse.json(
        { error: "No valid rows found", details: parsed.errors },
        { status: 400 }
      );
    }

    const result = await importCustomerRows(parsed.rows);

    await writeActivityLog(
      currentUser,
      "استيراد مشتركين",
      "المشتركين",
      `تم استيراد ${result.imported} من ${result.total}`,
      null
    );

    return NextResponse.json({
      ...result,
      parseErrors: parsed.errors,
    });
  } catch (error: unknown) {
    console.error("POST /api/customers/import error:", error);
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: "Import failed", message }, { status: 500 });
  }
}

export const GET = loggedRoute("GET /api/customers/import", handleGet);
export const POST = loggedRoute("POST /api/customers/import", handlePost);

import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { isErrorResponse, requireAnyPermission, requirePermission } from "@/lib/permissions";
import { requireCompanyId } from "@/lib/tenant";
import { loggedRoute } from "@/lib/api-observability";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function csvEscape(value: unknown) {
  const text = String(value ?? "");
  if (text.includes(",") || text.includes('"') || text.includes("\n")) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

async function handleGet(req: Request) {
  const auth = await requireAnyPermission("viewAccounting", "viewSubscribers");
  if (isErrorResponse(auth)) return auth;

  try {
    const companyId = requireCompanyId(auth.user);
    const url = new URL(req.url);
    const type = String(url.searchParams.get("type") || "sales");

    let headers: string[] = [];
    let rows: string[][] = [];
    let filename = "report.csv";

    if (type === "customers") {
      filename = "customers-report.csv";
      headers = ["id", "name", "phone", "email", "city", "status", "createdAt"];
      const data = await query<Record<string, unknown>>(
        `SELECT id, name, phone, email, city, customerStatus, createdAt
         FROM Customer WHERE companyId = ? ORDER BY id DESC`,
        [companyId]
      );
      rows = data.map((row) => [
        row.id,
        row.name,
        row.phone,
        row.email,
        row.city,
        row.customerStatus,
        row.createdAt,
      ].map(csvEscape).map(String));
    } else if (type === "deals") {
      filename = "deals-report.csv";
      headers = ["id", "title", "customer", "stage", "value", "probability", "expectedClose"];
      const data = await query<Record<string, unknown>>(
        `SELECT d.id, d.title, c.name AS customerName, d.stage, d.value, d.probability, d.expectedClose
         FROM Deal d
         INNER JOIN Customer c ON c.id = d.customerId
         WHERE c.companyId = ?
         ORDER BY d.updatedAt DESC`,
        [companyId]
      );
      rows = data.map((row) => [
        row.id,
        row.title,
        row.customerName,
        row.stage,
        row.value,
        row.probability,
        row.expectedClose,
      ].map(csvEscape).map(String));
    } else {
      filename = "sales-report.csv";
      headers = ["insuranceId", "customer", "carNumber", "company", "status", "total", "paid", "remaining"];
      const data = await query<Record<string, unknown>>(
        `SELECT i.id, c.name AS customerName, car.carNumber, i.insuranceCompany, i.status, i.totalAmount, i.paidAmount, i.remainingAmount
         FROM Insurance i
         INNER JOIN Customer c ON c.id = i.customerId
         INNER JOIN Car car ON car.id = i.carId
         WHERE c.companyId = ?
         ORDER BY i.id DESC`,
        [companyId]
      );
      rows = data.map((row) => [
        row.id,
        row.customerName,
        row.carNumber,
        row.insuranceCompany,
        row.status,
        row.totalAmount,
        row.paidAmount,
        row.remainingAmount,
      ].map(csvEscape).map(String));
    }

    const csv = `\uFEFF${headers.join(",")}\n${rows.map((row) => row.join(",")).join("\n")}`;
    const date = new Date().toISOString().slice(0, 10);

    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename.replace(".csv", "")}-${date}.csv"`,
      },
    });
  } catch (error: unknown) {
    console.error("GET /api/reports/export error:", error);
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: "Failed to export report", message }, { status: 500 });
  }
}

export const GET = loggedRoute("GET /api/reports/export", handleGet);

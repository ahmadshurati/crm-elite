import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { isErrorResponse, requireUser } from "@/lib/permissions";
import { requireCompanyId } from "@/lib/tenant";
import { loggedRoute } from "@/lib/api-observability";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type SearchResult = {
  id: string;
  kind: "customer" | "insurance" | "deal" | "task" | "quote" | "invoice" | "accident";
  title: string;
  subtitle: string;
  section: string;
};

async function handleGet(req: Request) {
  const auth = await requireUser();
  if (isErrorResponse(auth)) return auth;

  try {
    const url = new URL(req.url);
    const q = String(url.searchParams.get("q") || "").trim();
    const limit = Math.min(20, Math.max(1, Number(url.searchParams.get("limit") || 10)));

    if (q.length < 2) {
      return NextResponse.json({ results: [] });
    }

    const companyId = requireCompanyId(auth.user);
    const like = `%${q}%`;
    const results: SearchResult[] = [];
    const tenant = " AND companyId = ?";
    const tenantC = " AND c.companyId = ?";

    const [customers, insurances, deals, tasks, quotes, invoices, accidents] = await Promise.all([
      query<Record<string, unknown>>(
        `SELECT id, name, phone, email
         FROM Customer
         WHERE (name LIKE ? OR phone LIKE ? OR email LIKE ? OR tags LIKE ?)${tenant}
         ORDER BY id DESC LIMIT ?`,
        [like, like, like, like, companyId, limit]
      ),
      query<Record<string, unknown>>(
        `SELECT i.id, c.name AS customerName, car.carName, car.carNumber, i.insuranceCompany, i.status
         FROM Insurance i
         INNER JOIN Customer c ON c.id = i.customerId
         INNER JOIN Car car ON car.id = i.carId
         WHERE (c.name LIKE ? OR car.carNumber LIKE ? OR car.carName LIKE ? OR i.insuranceCompany LIKE ?)${tenantC}
         ORDER BY i.id DESC LIMIT ?`,
        [like, like, like, like, companyId, limit]
      ),
      query<Record<string, unknown>>(
        `SELECT d.id, d.title, d.stage, c.name AS customerName
         FROM Deal d
         INNER JOIN Customer c ON c.id = d.customerId
         WHERE (d.title LIKE ? OR c.name LIKE ?)${tenantC}
         ORDER BY d.updatedAt DESC LIMIT ?`,
        [like, like, companyId, limit]
      ),
      query<Record<string, unknown>>(
        `SELECT t.id, t.title, t.status, c.name AS customerName
         FROM CrmTask t
         LEFT JOIN Customer c ON c.id = t.customerId
         LEFT JOIN AppUser cb ON cb.id = t.createdByUserId
         WHERE (t.title LIKE ? OR t.description LIKE ? OR c.name LIKE ?)
           AND (c.companyId = ? OR (t.customerId IS NULL AND cb.companyId = ?))
         ORDER BY t.dueDate ASC LIMIT ?`,
        [like, like, like, companyId, companyId, limit]
      ),
      query<Record<string, unknown>>(
        `SELECT q.id, q.quoteNumber, q.title, q.status, c.name AS customerName
         FROM Quote q
         INNER JOIN Customer c ON c.id = q.customerId
         WHERE (q.title LIKE ? OR q.quoteNumber LIKE ? OR c.name LIKE ?)${tenantC}
         ORDER BY q.createdAt DESC LIMIT ?`,
        [like, like, like, companyId, limit]
      ),
      query<Record<string, unknown>>(
        `SELECT i.id, i.invoiceNumber, i.title, i.status, c.name AS customerName
         FROM Invoice i
         INNER JOIN Customer c ON c.id = i.customerId
         WHERE (i.title LIKE ? OR i.invoiceNumber LIKE ? OR c.name LIKE ?)${tenantC}
         ORDER BY i.createdAt DESC LIMIT ?`,
        [like, like, like, companyId, limit]
      ),
      query<Record<string, unknown>>(
        `SELECT a.id, a.caseNumber, a.details, a.status, c.name AS customerName
         FROM AccidentCase a
         INNER JOIN Customer c ON c.id = a.customerId
         WHERE (a.caseNumber LIKE ? OR a.details LIKE ? OR c.name LIKE ?)${tenantC}
         ORDER BY a.openedAt DESC LIMIT ?`,
        [like, like, like, companyId, limit]
      ),
    ]);

    customers.forEach((row) => {
      results.push({
        id: `customer-${row.id}`,
        kind: "customer",
        title: String(row.name || "عميل"),
        subtitle: String(row.phone || row.email || ""),
        section: "subscriber-history",
      });
    });

    insurances.forEach((row) => {
      results.push({
        id: `insurance-${row.id}`,
        kind: "insurance",
        title: `${row.customerName} — ${row.carNumber}`,
        subtitle: `${row.insuranceCompany} · ${row.status}`,
        section: "active-subscribers",
      });
    });

    deals.forEach((row) => {
      results.push({
        id: `deal-${row.id}`,
        kind: "deal",
        title: String(row.title || "صفقة"),
        subtitle: String(row.customerName || ""),
        section: "deals",
      });
    });

    tasks.forEach((row) => {
      results.push({
        id: `task-${row.id}`,
        kind: "task",
        title: String(row.title || "مهمة"),
        subtitle: String(row.customerName || row.status || ""),
        section: "tasks",
      });
    });

    quotes.forEach((row) => {
      results.push({
        id: `quote-${row.id}`,
        kind: "quote",
        title: `${row.quoteNumber} — ${row.title}`,
        subtitle: String(row.customerName || row.status || ""),
        section: "quotes",
      });
    });

    invoices.forEach((row) => {
      results.push({
        id: `invoice-${row.id}`,
        kind: "invoice",
        title: `${row.invoiceNumber} — ${row.title}`,
        subtitle: String(row.customerName || row.status || ""),
        section: "invoices",
      });
    });

    accidents.forEach((row) => {
      results.push({
        id: `accident-${row.id}`,
        kind: "accident",
        title: `حادث ${row.caseNumber}`,
        subtitle: String(row.customerName || row.status || ""),
        section: "accident",
      });
    });

    return NextResponse.json({ results: results.slice(0, limit * 2) });
  } catch (error: unknown) {
    console.error("GET /api/search error:", error);
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: "Search failed", message }, { status: 500 });
  }
}

export const GET = loggedRoute("GET /api/search", handleGet);

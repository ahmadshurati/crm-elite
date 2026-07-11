import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { isErrorResponse, requireAnyPermission, requirePermission } from "@/lib/permissions";
import { requireCompanyId } from "@/lib/tenant";
import { loggedRoute } from "@/lib/api-observability";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function handleGet() {
  const auth = await requireAnyPermission("viewAccounting", "viewSubscribers");
  if (isErrorResponse(auth)) return auth;

  try {
    const companyId = requireCompanyId(auth.user);
    const [
      customerStats,
      insuranceStats,
      dealStats,
      invoiceStats,
      taskStats,
      revenueByMonth,
      dealsByStage,
    ] = await Promise.all([
      query<{ totalCustomers: number; activeCustomers: number }>(
        `SELECT
          (SELECT COUNT(*) FROM Customer WHERE companyId = ?) AS totalCustomers,
          (SELECT COUNT(DISTINCT i.customerId) FROM Insurance i
           INNER JOIN Customer c ON c.id = i.customerId
           WHERE i.status IN ('فعال', 'جديد') AND i.endDate >= CURDATE() AND c.companyId = ?) AS activeCustomers`,
        [companyId, companyId]
      ),
      query<{ activePolicies: number; expiredPolicies: number; totalRevenue: number; totalRemaining: number }>(
        `SELECT
          SUM(CASE WHEN i.status IN ('فعال', 'جديد') AND i.endDate >= CURDATE() THEN 1 ELSE 0 END) AS activePolicies,
          SUM(CASE WHEN NOT (i.status IN ('فعال', 'جديد') AND i.endDate >= CURDATE()) THEN 1 ELSE 0 END) AS expiredPolicies,
          COALESCE(SUM(i.paidAmount), 0) AS totalRevenue,
          COALESCE(SUM(i.remainingAmount), 0) AS totalRemaining
         FROM Insurance i
         INNER JOIN Customer c ON c.id = i.customerId
         WHERE c.companyId = ?`,
        [companyId]
      ),
      query<{ openDeals: number; wonDeals: number; pipelineValue: number }>(
        `SELECT
          SUM(CASE WHEN d.stage NOT IN ('won', 'lost') THEN 1 ELSE 0 END) AS openDeals,
          SUM(CASE WHEN d.stage = 'won' THEN 1 ELSE 0 END) AS wonDeals,
          COALESCE(SUM(CASE WHEN d.stage NOT IN ('won', 'lost') THEN d.value ELSE 0 END), 0) AS pipelineValue
         FROM Deal d
         INNER JOIN Customer c ON c.id = d.customerId
         WHERE c.companyId = ?`,
        [companyId]
      ),
      query<{ totalInvoices: number; unpaidInvoices: number; invoiceRevenue: number; overdueInvoices: number }>(
        `SELECT
          COUNT(*) AS totalInvoices,
          SUM(CASE WHEN inv.status IN ('unpaid', 'partial', 'overdue') THEN 1 ELSE 0 END) AS unpaidInvoices,
          COALESCE(SUM(inv.paidAmount), 0) AS invoiceRevenue,
          SUM(CASE WHEN inv.status = 'overdue' THEN 1 ELSE 0 END) AS overdueInvoices
         FROM Invoice inv
         INNER JOIN Customer c ON c.id = inv.customerId
         WHERE c.companyId = ?`,
        [companyId]
      ),
      query<{ pendingTasks: number; doneTasks: number }>(
        `SELECT
          SUM(CASE WHEN t.status IN ('pending', 'in_progress') THEN 1 ELSE 0 END) AS pendingTasks,
          SUM(CASE WHEN t.status = 'done' THEN 1 ELSE 0 END) AS doneTasks
         FROM CrmTask t
         LEFT JOIN Customer c ON c.id = t.customerId
         LEFT JOIN AppUser cb ON cb.id = t.createdByUserId
         WHERE c.companyId = ? OR (t.customerId IS NULL AND cb.companyId = ?)`,
        [companyId, companyId]
      ),
      query<{ month: string; revenue: number }>(
        `SELECT DATE_FORMAT(i.startDate, '%Y-%m') AS month, COALESCE(SUM(i.paidAmount), 0) AS revenue
         FROM Insurance i
         INNER JOIN Customer c ON c.id = i.customerId
         WHERE c.companyId = ? AND i.startDate >= DATE_SUB(CURRENT_DATE(), INTERVAL 6 MONTH)
         GROUP BY DATE_FORMAT(i.startDate, '%Y-%m')
         ORDER BY month ASC`,
        [companyId]
      ),
      query<{ stage: string; count: number; value: number }>(
        `SELECT d.stage, COUNT(*) AS count, COALESCE(SUM(d.value), 0) AS value
         FROM Deal d
         INNER JOIN Customer c ON c.id = d.customerId
         WHERE c.companyId = ?
         GROUP BY d.stage
         ORDER BY count DESC`,
        [companyId]
      ),
    ]);

    return NextResponse.json({
      customers: customerStats[0] || { totalCustomers: 0, activeCustomers: 0 },
      insurance: insuranceStats[0] || {
        activePolicies: 0,
        expiredPolicies: 0,
        totalRevenue: 0,
        totalRemaining: 0,
      },
      deals: dealStats[0] || { openDeals: 0, wonDeals: 0, pipelineValue: 0 },
      invoices: invoiceStats[0] || {
        totalInvoices: 0,
        unpaidInvoices: 0,
        invoiceRevenue: 0,
        overdueInvoices: 0,
      },
      tasks: taskStats[0] || { pendingTasks: 0, doneTasks: 0 },
      revenueByMonth: revenueByMonth.map((row) => ({
        month: String(row.month),
        revenue: Number(row.revenue || 0),
      })),
      dealsByStage: dealsByStage.map((row) => ({
        stage: String(row.stage),
        count: Number(row.count || 0),
        value: Number(row.value || 0),
      })),
    });
  } catch (error: unknown) {
    console.error("GET /api/reports/summary error:", error);
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: "Failed to load reports", message }, { status: 500 });
  }
}

export const GET = loggedRoute("GET /api/reports/summary", handleGet);

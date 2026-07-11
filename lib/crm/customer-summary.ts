import { query } from "@/lib/db";
import { formatMoney } from "@/lib/crm/utils";

export type CustomerSummary = {
  customerId: number;
  customerName: string;
  generatedAt: string;
  highlights: string[];
  recommendations: string[];
  stats: {
    activeInsurances: number;
    totalPaid: number;
    totalRemaining: number;
    openTasks: number;
    openDeals: number;
    communications: number;
  };
};

export async function buildCustomerSummary(customerId: number): Promise<CustomerSummary | null> {
  const customer = await query<Record<string, unknown>>(
    `SELECT id, name, phone, email, city, customerStatus, source, tags
     FROM Customer WHERE id = ? LIMIT 1`,
    [customerId]
  );

  if (!customer.length) return null;

  const row = customer[0];
  const [insuranceStats, taskStats, dealStats, commStats, latestInsurance] = await Promise.all([
    query<{ activeCount: number; totalPaid: number; totalRemaining: number }>(
      `SELECT
        SUM(CASE WHEN status = 'فعال' THEN 1 ELSE 0 END) AS activeCount,
        COALESCE(SUM(paidAmount), 0) AS totalPaid,
        COALESCE(SUM(remainingAmount), 0) AS totalRemaining
       FROM Insurance WHERE customerId = ?`,
      [customerId]
    ),
    query<{ openTasks: number }>(
      `SELECT COUNT(*) AS openTasks FROM CrmTask
       WHERE customerId = ? AND status IN ('pending', 'in_progress')`,
      [customerId]
    ),
    query<{ openDeals: number }>(
      `SELECT COUNT(*) AS openDeals FROM Deal
       WHERE customerId = ? AND stage NOT IN ('won', 'lost')`,
      [customerId]
    ),
    query<{ communications: number }>(
      `SELECT COUNT(*) AS communications FROM CustomerCommunication WHERE customerId = ?`,
      [customerId]
    ),
    query<Record<string, unknown>>(
      `SELECT i.endDate, i.insuranceCompany, i.status, car.carNumber
       FROM Insurance i
       INNER JOIN Car car ON car.id = i.carId
       WHERE i.customerId = ?
       ORDER BY i.endDate DESC LIMIT 1`,
      [customerId]
    ),
  ]);

  const stats = {
    activeInsurances: Number(insuranceStats[0]?.activeCount || 0),
    totalPaid: Number(insuranceStats[0]?.totalPaid || 0),
    totalRemaining: Number(insuranceStats[0]?.totalRemaining || 0),
    openTasks: Number(taskStats[0]?.openTasks || 0),
    openDeals: Number(dealStats[0]?.openDeals || 0),
    communications: Number(commStats[0]?.communications || 0),
  };

  const highlights: string[] = [];
  const recommendations: string[] = [];
  const name = String(row.name || "العميل");

  highlights.push(`${name} — ${stats.activeInsurances} تأمين فعال`);
  if (row.phone) highlights.push(`الهاتف: ${String(row.phone)}`);
  if (row.city) highlights.push(`المدينة: ${String(row.city)}`);
  if (row.source) highlights.push(`المصدر: ${String(row.source)}`);

  highlights.push(`إجمالي المدفوع: ${formatMoney(stats.totalPaid)}`);
  if (stats.totalRemaining > 0) {
    highlights.push(`متبقي للتحصيل: ${formatMoney(stats.totalRemaining)}`);
  }

  if (latestInsurance[0]) {
    const endDate = new Date(latestInsurance[0].endDate as string | Date);
    highlights.push(
      `آخر وثيقة: ${String(latestInsurance[0].insuranceCompany || "")} — ${String(latestInsurance[0].carNumber || "")} (${String(latestInsurance[0].status || "")})`
    );

    if (!Number.isNaN(endDate.getTime())) {
      const daysLeft = Math.ceil((endDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
      if (daysLeft <= 30 && daysLeft >= 0) {
        recommendations.push(`التأمين ينتهي خلال ${daysLeft} يوم — تواصل للتجديد`);
      } else if (daysLeft < 0) {
        recommendations.push("التأمين منتهي — حدّد موعد تجديد أو متابعة");
      }
    }
  }

  if (stats.totalRemaining > 0) {
    recommendations.push("متابعة تحصيل المبلغ المتبقي");
  }
  if (stats.openTasks === 0 && stats.activeInsurances > 0) {
    recommendations.push("جدولة مهمة متابعة دورية مع العميل");
  }
  if (stats.communications === 0) {
    recommendations.push("تسجيل أول تواصل (مكالمة أو واتساب) في الخط الزمني");
  }
  if (stats.openDeals > 0) {
    recommendations.push(`متابعة ${stats.openDeals} صفقة/صفقات مفتوحة`);
  }

  if (recommendations.length === 0) {
    recommendations.push("الملف محدّث — لا توجد إجراءات عاجلة");
  }

  return {
    customerId,
    customerName: name,
    generatedAt: new Date().toISOString(),
    highlights,
    recommendations,
    stats,
  };
}

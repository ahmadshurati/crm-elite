import { query, queryOne } from "@/lib/db";
import { buildInsuranceFilterClause, buildSearchClause } from "@/lib/customers-data";
import { customerCompanyClause, DEMO_COMPANY_ID } from "@/lib/tenant";

type SqlParam = string | number;

export type InsightChart = {
  kind: "pie" | "bar" | "area";
  title: string;
  badge: string;
  data: { name: string; value: number }[];
  money?: boolean;
};

export type InsightCard = {
  label: string;
  value: number | string;
  helper: string;
};

export type DashboardInsightsPayload = {
  totalRecords: number;
  eyebrow: string;
  description: string;
  cards: InsightCard[];
  charts: InsightChart[];
};

type InsightMode =
  | "active-subscribers"
  | "active-customers"
  | "inactive-subscribers"
  | "subscriber-history"
  | "renewals-this-month"
  | "accounting";

function money(value: number) {
  return Number(value || 0).toLocaleString("he-IL", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

function buildFromClause(filter: string, search: string, companyId?: number | null) {
  const searchClause = buildSearchClause(search);
  const tenant = customerCompanyClause("c", companyId);
  const whereClause = `${buildInsuranceFilterClause(filter)}${searchClause.clause}${tenant.clause}`;
  const fromSql = `FROM Insurance i
    INNER JOIN Car car ON car.id = i.carId
    INNER JOIN Customer c ON c.id = i.customerId
    WHERE ${whereClause}`;

  return {
    fromSql,
    params: [...searchClause.params, ...tenant.params] as SqlParam[],
    whereClause,
  };
}

async function countRows(fromSql: string, params: SqlParam[]) {
  const row = await queryOne<{ total: number }>(`SELECT COUNT(*) as total ${fromSql}`, params);
  return Number(row?.total || 0);
}

async function countDistinctCustomers(fromSql: string, params: SqlParam[]) {
  const row = await queryOne<{ total: number }>(
    `SELECT COUNT(DISTINCT c.id) as total ${fromSql}`,
    params
  );
  return Number(row?.total || 0);
}

async function groupCount(
  fromSql: string,
  params: SqlParam[],
  expression: string,
  groupBy: string,
  limit = 7
) {
  const rows = await query<{ name: string; value: number }>(
    `SELECT ${expression} as name, COUNT(*) as value
     ${fromSql}
     GROUP BY ${groupBy}
     ORDER BY value DESC
     LIMIT ${limit}`,
    params
  );

  return rows.map((row) => ({
    name: String(row.name || "غير محدد").trim() || "غير محدد",
    value: Number(row.value || 0),
  }));
}

async function groupByMonth(
  fromSql: string,
  params: SqlParam[],
  dateColumn: "i.endDate" | "i.startDate"
) {
  const rows = await query<{ name: string; value: number }>(
    `SELECT CONCAT(MONTH(${dateColumn}), '/', YEAR(${dateColumn})) as name, COUNT(*) as value
     ${fromSql}
     GROUP BY YEAR(${dateColumn}), MONTH(${dateColumn})
     ORDER BY YEAR(${dateColumn}), MONTH(${dateColumn})
     LIMIT 8`,
    params
  );

  return rows.map((row) => ({
    name: String(row.name || "غير محدد"),
    value: Number(row.value || 0),
  }));
}

async function countExpiringThisMonth(fromSql: string, params: SqlParam[]) {
  const row = await queryOne<{ total: number }>(
    `SELECT COUNT(*) as total ${fromSql}
     AND MONTH(i.endDate) = MONTH(CURDATE())
     AND YEAR(i.endDate) = YEAR(CURDATE())`,
    params
  );
  return Number(row?.total || 0);
}

async function countRenewalPending(fromSql: string, params: SqlParam[]) {
  const row = await queryOne<{ total: number }>(
    `SELECT COUNT(*) as total ${fromSql}
     AND NOT EXISTS (
       SELECT 1
       FROM Insurance newer
       WHERE newer.customerId = i.customerId
         AND newer.id <> i.id
         AND newer.status IN ('فعال', 'جديد')
         AND newer.endDate > i.endDate
     )`,
    params
  );
  return Number(row?.total || 0);
}

async function countByStatus(fromSql: string, params: SqlParam[], status: string) {
  const row = await queryOne<{ total: number }>(
    `SELECT COUNT(*) as total ${fromSql} AND i.status = ?`,
    [...params, status]
  );
  return Number(row?.total || 0);
}

async function countActivePolicies(fromSql: string, params: SqlParam[]) {
  const row = await queryOne<{ total: number }>(
    `SELECT COUNT(*) as total ${fromSql}
     AND i.status IN ('فعال', 'جديد')
     AND i.endDate >= CURDATE()`,
    params
  );
  return Number(row?.total || 0);
}

async function countExpiredPolicies(fromSql: string, params: SqlParam[]) {
  const row = await queryOne<{ total: number }>(
    `SELECT COUNT(*) as total ${fromSql}
     AND (i.status IN ('غير فعال', 'منتهي') OR i.endDate < CURDATE())`,
    params
  );
  return Number(row?.total || 0);
}

async function countDistinctCars(fromSql: string, params: SqlParam[]) {
  const row = await queryOne<{ total: number }>(
    `SELECT COUNT(DISTINCT car.id) as total ${fromSql}`,
    params
  );
  return Number(row?.total || 0);
}

async function financialTotals(fromSql: string, params: SqlParam[]) {
  const row = await queryOne<{
    totalRevenue: number;
    totalPaid: number;
    totalRemaining: number;
    cashTotal: number;
    visaTotal: number;
    checksTotal: number;
  }>(
    `SELECT
      COALESCE(SUM(i.totalAmount), 0) as totalRevenue,
      COALESCE(SUM(i.paidAmount), 0) as totalPaid,
      COALESCE(SUM(i.remainingAmount), 0) as totalRemaining,
      COALESCE(SUM(i.cashAmount), 0) as cashTotal,
      COALESCE(SUM(i.visaAmount), 0) as visaTotal,
      COALESCE(SUM(i.checksAmount), 0) as checksTotal
     ${fromSql}`,
    params
  );

  return {
    totalRevenue: Number(row?.totalRevenue || 0),
    totalPaid: Number(row?.totalPaid || 0),
    totalRemaining: Number(row?.totalRemaining || 0),
    cashTotal: Number(row?.cashTotal || 0),
    visaTotal: Number(row?.visaTotal || 0),
    checksTotal: Number(row?.checksTotal || 0),
  };
}

export async function getDashboardInsights(
  filter: string,
  search: string,
  mode: InsightMode,
  companyId?: number | null
): Promise<DashboardInsightsPayload> {
  const { fromSql, params } = buildFromClause(filter, search, companyId);
  const isDemo = companyId != null && Number(companyId) === DEMO_COMPANY_ID;

  const [
    totalRecords,
    uniqueCustomers,
    companyData,
    typeData,
    statusData,
    endMonthData,
    startMonthData,
    customerLoadData,
    carsPerCustomerData,
  ] = await Promise.all([
    countRows(fromSql, params),
    countDistinctCustomers(fromSql, params),
    groupCount(fromSql, params, "i.insuranceCompany", "i.insuranceCompany"),
    groupCount(fromSql, params, "i.insuranceType", "i.insuranceType"),
    groupCount(fromSql, params, "i.status", "i.status"),
    groupByMonth(fromSql, params, "i.endDate"),
    groupByMonth(fromSql, params, "i.startDate"),
    groupCount(fromSql, params, "c.name", "c.id, c.name"),
    query<{ name: string; value: number }>(
      `SELECT c.name as name, COUNT(DISTINCT car.id) as value
       ${fromSql}
       GROUP BY c.id, c.name
       ORDER BY value DESC
       LIMIT 7`,
      params
    ).then((rows) =>
      rows.map((row) => ({
        name: String(row.name || "بدون اسم"),
        value: Number(row.value || 0),
      }))
    ),
  ]);

  if (mode === "active-subscribers") {
    const expiringThisMonth = await countExpiringThisMonth(fromSql, params);

    return {
      totalRecords,
      eyebrow: "",
      description: isDemo
        ? "تحليل شامل للحسابات النشطة: العملاء، أنواع الخدمة، وقرب التجديد."
        : "تحليل خاص بالتأمينات الفعالة: شركات التأمين، أنواع التغطية، وقرب الانتهاء.",
      cards: [
        { label: isDemo ? "حسابات نشطة" : "تأمينات فعالة", value: totalRecords, helper: isDemo ? "حساب" : "سجل تأمين" },
        { label: isDemo ? "عملاء" : "زبائن", value: uniqueCustomers, helper: isDemo ? "عميل" : "زبون" },
        { label: isDemo ? "الجهات" : "شركات تأمين", value: companyData.length, helper: isDemo ? "جهة" : "شركة" },
        { label: isDemo ? "أنواع الخدمة" : "أنواع تغطية", value: typeData.length, helper: "نوع" },
        { label: "تنتهي هذا الشهر", value: expiringThisMonth, helper: "تنبيه" },
      ],
      charts: [
        { kind: "pie", title: isDemo ? "توزيع الحسابات حسب الجهة" : "توزيع التأمينات حسب الشركة", badge: "Companies", data: companyData },
        { kind: "bar", title: isDemo ? "أنواع الخدمة" : "أنواع التأمين الفعالة", badge: "Coverage", data: typeData },
        { kind: "area", title: isDemo ? "مواعيد التجديد القادمة" : "مواعيد الانتهاء القادمة", badge: "Expiry", data: endMonthData },
      ],
    };
  }

  if (mode === "active-customers") {
    const activeCars = await countDistinctCars(fromSql, params);

    return {
      totalRecords,
      eyebrow: "",
      description: isDemo
        ? "تحليل شامل للعملاء النشطين: كل عميل مرة واحدة مع عدد حساباته وخدماته."
        : "تحليل خاص بالمشتركين الفعالين: كل زبون مرة واحدة مع ثقل التأمينات والسيارات المرتبطة به.",
      cards: [
        { label: isDemo ? "عملاء نشطون" : "مشتركين فعالين", value: uniqueCustomers, helper: isDemo ? "عميل" : "زبون" },
        { label: isDemo ? "حسابات نشطة" : "تأمينات فعالة", value: totalRecords, helper: isDemo ? "حساب" : "تأمين" },
        {
          label: isDemo ? "متوسط الحسابات" : "متوسط التأمينات",
          value: uniqueCustomers ? Number((totalRecords / uniqueCustomers).toFixed(1)) : 0,
          helper: isDemo ? "لكل عميل" : "لكل زبون",
        },
        { label: isDemo ? "أكثر عميل" : "أكثر زبون", value: customerLoadData[0]?.value || 0, helper: isDemo ? "حسابات" : "تأمينات" },
        { label: isDemo ? "خدمات فعّالة" : "سيارات فعالة", value: activeCars, helper: isDemo ? "خدمة" : "سيارة" },
      ],
      charts: [
        { kind: "bar", title: isDemo ? "أكثر العملاء لديهم حسابات" : "أكثر الزبائن لديهم تأمينات", badge: "Clients", data: customerLoadData },
        { kind: "pie", title: isDemo ? "توزيع جهات العملاء النشطين" : "توزيع شركات زبائن فعالين", badge: "Companies", data: companyData },
        { kind: "area", title: isDemo ? "عدد الحسابات لكل عميل" : "عدد السيارات لكل زبون", badge: "Vehicles", data: carsPerCustomerData },
      ],
    };
  }

  if (mode === "inactive-subscribers") {
    const expired = await countByStatus(fromSql, params, "منتهي");
    const inactive = await countByStatus(fromSql, params, "غير فعال");

    return {
      totalRecords,
      eyebrow: "",
      description: isDemo
        ? "تحليل شامل للحسابات غير النشطة/المغلقة وتوزيعها."
        : "تحليل خاص بالمنتهية وغير الفعالة: أين تتراكم الانتهاءات ومن أي شركات تأتي.",
      cards: [
        { label: isDemo ? "حسابات غير نشطة" : "سجلات غير فعالة", value: totalRecords, helper: isDemo ? "حساب" : "سجل" },
        { label: "منتهية", value: expired, helper: "منتهي" },
        { label: "غير فعالة", value: inactive, helper: "غير فعال" },
        { label: isDemo ? "عملاء متأثرون" : "زبائن متأثرين", value: uniqueCustomers, helper: isDemo ? "عميل" : "زبون" },
        { label: isDemo ? "الجهات" : "شركات", value: companyData.length, helper: isDemo ? "جهة" : "شركة" },
      ],
      charts: [
        { kind: "pie", title: isDemo ? "توزيع الحالات المغلقة وغير النشطة" : "توزيع حالات الإيقاف والانتهاء", badge: "Status", data: statusData },
        { kind: "bar", title: isDemo ? "جهات لديها حسابات منتهية" : "شركات لديها سجلات منتهية", badge: "Companies", data: companyData },
        { kind: "area", title: isDemo ? "الإغلاق حسب الأشهر" : "الانتهاء حسب الأشهر", badge: "Timeline", data: endMonthData },
      ],
    };
  }

  if (mode === "subscriber-history") {
    const activePolicies = await countActivePolicies(fromSql, params);
    const expiredPolicies = await countExpiredPolicies(fromSql, params);

    return {
      totalRecords,
      eyebrow: "",
      description: isDemo
        ? "تحليل شامل للسجل: عدد الحسابات لكل عميل، النشاط التاريخي، والحالات المتراكمة."
        : "تحليل خاص بالسجل: كثافة التأمينات لكل زبون، النشاط التاريخي، والحالات المتراكمة.",
      cards: [
        { label: isDemo ? "عملاء بالسجل" : "زبائن بالسجل", value: uniqueCustomers, helper: isDemo ? "عميل" : "زبون" },
        { label: isDemo ? "كل الحسابات" : "كل التأمينات", value: totalRecords, helper: "سجل" },
        { label: "فعالة", value: activePolicies, helper: "Active" },
        { label: "منتهية/غير فعالة", value: expiredPolicies, helper: "Closed" },
        { label: "أعلى سجل", value: customerLoadData[0]?.value || 0, helper: isDemo ? "حسابات" : "تأمينات" },
      ],
      charts: [
        { kind: "bar", title: isDemo ? "عدد الحسابات لكل عميل" : "عدد التأمينات لكل زبون", badge: "Customer Depth", data: customerLoadData },
        { kind: "pie", title: isDemo ? "الحالات داخل السجل" : "حالات التأمين داخل السجل", badge: "Status", data: statusData },
        { kind: "area", title: isDemo ? "الحركة التاريخية حسب بداية الحساب" : "الحركة التاريخية حسب بداية التأمين", badge: "Activity", data: startMonthData },
      ],
    };
  }

  if (mode === "renewals-this-month") {
    const renewalPending = await countRenewalPending(fromSql, params);
    const renewalDone = Math.max(totalRecords - renewalPending, 0);
    const renewalStateData = [
      { name: "تم تجديده", value: renewalDone },
      { name: "لم يتم بعد", value: renewalPending },
    ];

    return {
      totalRecords,
      eyebrow: "",
      description: isDemo
        ? "تحليل شامل لمتابعات وتجديدات الشهر: من تمّ ومن بقي للتواصل معه، مع توزيع الجهات والمواعيد."
        : "تحليل خاص بتجديدات الشهر: من تم تجديده ومن بقي للتواصل معه، مع توزيع الشركات والمواعيد.",
      cards: [
        { label: isDemo ? "مطلوب متابعة" : "مطلوب تجديد", value: totalRecords, helper: "هذا الشهر" },
        { label: isDemo ? "تمّت" : "تم تجديده", value: renewalDone, helper: "Done" },
        { label: isDemo ? "باقية" : "باقي للتجديد", value: renewalPending, helper: "Pending" },
        { label: isDemo ? "عملاء" : "زبائن", value: uniqueCustomers, helper: isDemo ? "عميل" : "زبون" },
        { label: isDemo ? "الجهات" : "شركات", value: companyData.length, helper: isDemo ? "جهة" : "شركة" },
      ],
      charts: [
        { kind: "pie", title: isDemo ? "حالة المتابعة لهذا الشهر" : "حالة التجديد لهذا الشهر", badge: "Progress", data: renewalStateData },
        { kind: "bar", title: isDemo ? "المتابعات حسب الجهة" : "التجديدات حسب شركة التأمين", badge: "Companies", data: companyData },
        { kind: "area", title: isDemo ? "توزيع مواعيد التجديد" : "توزيع تواريخ انتهاء التجديدات", badge: "Due Dates", data: endMonthData },
      ],
    };
  }

  const totals = await financialTotals(fromSql, params);
  const paymentMethodData = [
    { name: "كاش", value: totals.cashTotal },
    { name: "فيزا", value: totals.visaTotal },
    { name: "شيكات", value: totals.checksTotal },
  ].filter((item) => item.value > 0);
  const collectionData = [
    { name: "مدفوع", value: totals.totalPaid },
    { name: "متبقي", value: totals.totalRemaining },
  ];

  return {
    totalRecords,
    eyebrow: "Financial",
    description: "تحليل خاص بالحسابات فقط: المدفوع، المتبقي، طرق الدفع، والتحصيل الشهري.",
    cards: [
      { label: "إجمالي المطلوب", value: money(totals.totalRevenue), helper: "Revenue" },
      { label: "إجمالي المدفوع", value: money(totals.totalPaid), helper: "Collected" },
      { label: "إجمالي المتبقي", value: money(totals.totalRemaining), helper: "Outstanding" },
      { label: "كاش", value: money(totals.cashTotal), helper: "Cash" },
      { label: "فيزا + شيكات", value: money(totals.visaTotal + totals.checksTotal), helper: "Non-cash" },
    ],
    charts: [
      { kind: "area", title: "المدفوع مقابل المتبقي", badge: "Collection", data: collectionData, money: true },
      {
        kind: "pie",
        title: "توزيع طرق الدفع",
        badge: "Payment Mix",
        data: paymentMethodData.length ? paymentMethodData : [{ name: "لا يوجد", value: 1 }],
        money: true,
      },
      { kind: "bar", title: isDemo ? "التحصيل حسب شهر بداية الحساب" : "التحصيل حسب شهر بداية التأمين", badge: "Monthly", data: startMonthData },
    ],
  };
}

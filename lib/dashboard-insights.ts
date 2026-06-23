import { query, queryOne } from "@/lib/db";
import { buildInsuranceFilterClause, buildSearchClause } from "@/lib/customers-data";

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

function buildFromClause(filter: string, search: string) {
  const searchClause = buildSearchClause(search);
  const whereClause = `${buildInsuranceFilterClause(filter)}${searchClause.clause}`;
  const fromSql = `FROM Insurance i
    INNER JOIN Car car ON car.id = i.carId
    INNER JOIN Customer c ON c.id = i.customerId
    WHERE ${whereClause}`;

  return { fromSql, params: searchClause.params, whereClause };
}

async function countRows(fromSql: string, params: string[]) {
  const row = await queryOne<{ total: number }>(`SELECT COUNT(*) as total ${fromSql}`, params);
  return Number(row?.total || 0);
}

async function countDistinctCustomers(fromSql: string, params: string[]) {
  const row = await queryOne<{ total: number }>(
    `SELECT COUNT(DISTINCT c.id) as total ${fromSql}`,
    params
  );
  return Number(row?.total || 0);
}

async function groupCount(
  fromSql: string,
  params: string[],
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
  params: string[],
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

async function countExpiringThisMonth(fromSql: string, params: string[]) {
  const row = await queryOne<{ total: number }>(
    `SELECT COUNT(*) as total ${fromSql}
     AND MONTH(i.endDate) = MONTH(CURDATE())
     AND YEAR(i.endDate) = YEAR(CURDATE())`,
    params
  );
  return Number(row?.total || 0);
}

async function countRenewalPending(fromSql: string, params: string[]) {
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

async function countByStatus(fromSql: string, params: string[], status: string) {
  const row = await queryOne<{ total: number }>(
    `SELECT COUNT(*) as total ${fromSql} AND i.status = ?`,
    [...params, status]
  );
  return Number(row?.total || 0);
}

async function countActivePolicies(fromSql: string, params: string[]) {
  const row = await queryOne<{ total: number }>(
    `SELECT COUNT(*) as total ${fromSql}
     AND i.status IN ('فعال', 'جديد')
     AND i.endDate >= CURDATE()`,
    params
  );
  return Number(row?.total || 0);
}

async function countExpiredPolicies(fromSql: string, params: string[]) {
  const row = await queryOne<{ total: number }>(
    `SELECT COUNT(*) as total ${fromSql}
     AND (i.status IN ('غير فعال', 'منتهي') OR i.endDate < CURDATE())`,
    params
  );
  return Number(row?.total || 0);
}

async function countDistinctCars(fromSql: string, params: string[]) {
  const row = await queryOne<{ total: number }>(
    `SELECT COUNT(DISTINCT car.id) as total ${fromSql}`,
    params
  );
  return Number(row?.total || 0);
}

async function financialTotals(fromSql: string, params: string[]) {
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
  mode: InsightMode
): Promise<DashboardInsightsPayload> {
  const { fromSql, params } = buildFromClause(filter, search);

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
      description: "تحليل خاص بالتأمينات الفعالة: شركات التأمين، أنواع التغطية، وقرب الانتهاء.",
      cards: [
        { label: "تأمينات فعالة", value: totalRecords, helper: "سجل تأمين" },
        { label: "زبائن", value: uniqueCustomers, helper: "زبون" },
        { label: "شركات تأمين", value: companyData.length, helper: "شركة" },
        { label: "أنواع تغطية", value: typeData.length, helper: "نوع" },
        { label: "تنتهي هذا الشهر", value: expiringThisMonth, helper: "تنبيه" },
      ],
      charts: [
        { kind: "pie", title: "توزيع التأمينات حسب الشركة", badge: "Companies", data: companyData },
        { kind: "bar", title: "أنواع التأمين الفعالة", badge: "Coverage", data: typeData },
        { kind: "area", title: "مواعيد الانتهاء القادمة", badge: "Expiry", data: endMonthData },
      ],
    };
  }

  if (mode === "active-customers") {
    const activeCars = await countDistinctCars(fromSql, params);

    return {
      totalRecords,
      eyebrow: "",
      description: "تحليل خاص بالمشتركين الفعالين: كل زبون مرة واحدة مع ثقل التأمينات والسيارات المرتبطة به.",
      cards: [
        { label: "مشتركين فعالين", value: uniqueCustomers, helper: "زبون" },
        { label: "تأمينات فعالة", value: totalRecords, helper: "تأمين" },
        {
          label: "متوسط التأمينات",
          value: uniqueCustomers ? Number((totalRecords / uniqueCustomers).toFixed(1)) : 0,
          helper: "لكل زبون",
        },
        { label: "أكثر زبون", value: customerLoadData[0]?.value || 0, helper: "تأمينات" },
        { label: "سيارات فعالة", value: activeCars, helper: "سيارة" },
      ],
      charts: [
        { kind: "bar", title: "أكثر الزبائن لديهم تأمينات", badge: "Clients", data: customerLoadData },
        { kind: "pie", title: "توزيع شركات زبائن فعالين", badge: "Companies", data: companyData },
        { kind: "area", title: "عدد السيارات لكل زبون", badge: "Vehicles", data: carsPerCustomerData },
      ],
    };
  }

  if (mode === "inactive-subscribers") {
    const expired = await countByStatus(fromSql, params, "منتهي");
    const inactive = await countByStatus(fromSql, params, "غير فعال");

    return {
      totalRecords,
      eyebrow: "",
      description: "تحليل خاص بالمنتهية وغير الفعالة: أين تتراكم الانتهاءات ومن أي شركات تأتي.",
      cards: [
        { label: "سجلات غير فعالة", value: totalRecords, helper: "سجل" },
        { label: "منتهية", value: expired, helper: "منتهي" },
        { label: "غير فعالة", value: inactive, helper: "غير فعال" },
        { label: "زبائن متأثرين", value: uniqueCustomers, helper: "زبون" },
        { label: "شركات", value: companyData.length, helper: "شركة" },
      ],
      charts: [
        { kind: "pie", title: "توزيع حالات الإيقاف والانتهاء", badge: "Status", data: statusData },
        { kind: "bar", title: "شركات لديها سجلات منتهية", badge: "Companies", data: companyData },
        { kind: "area", title: "الانتهاء حسب الأشهر", badge: "Timeline", data: endMonthData },
      ],
    };
  }

  if (mode === "subscriber-history") {
    const activePolicies = await countActivePolicies(fromSql, params);
    const expiredPolicies = await countExpiredPolicies(fromSql, params);

    return {
      totalRecords,
      eyebrow: "",
      description: "تحليل خاص بالسجل: كثافة التأمينات لكل زبون، النشاط التاريخي، والحالات المتراكمة.",
      cards: [
        { label: "زبائن بالسجل", value: uniqueCustomers, helper: "زبون" },
        { label: "كل التأمينات", value: totalRecords, helper: "سجل" },
        { label: "فعالة", value: activePolicies, helper: "Active" },
        { label: "منتهية/غير فعالة", value: expiredPolicies, helper: "Closed" },
        { label: "أعلى سجل", value: customerLoadData[0]?.value || 0, helper: "تأمينات" },
      ],
      charts: [
        { kind: "bar", title: "عدد التأمينات لكل زبون", badge: "Customer Depth", data: customerLoadData },
        { kind: "pie", title: "حالات التأمين داخل السجل", badge: "Status", data: statusData },
        { kind: "area", title: "الحركة التاريخية حسب بداية التأمين", badge: "Activity", data: startMonthData },
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
      description: "تحليل خاص بتجديدات الشهر: من تم تجديده ومن بقي للتواصل معه، مع توزيع الشركات والمواعيد.",
      cards: [
        { label: "مطلوب تجديد", value: totalRecords, helper: "هذا الشهر" },
        { label: "تم تجديده", value: renewalDone, helper: "Done" },
        { label: "باقي للتجديد", value: renewalPending, helper: "Pending" },
        { label: "زبائن", value: uniqueCustomers, helper: "زبون" },
        { label: "شركات", value: companyData.length, helper: "شركة" },
      ],
      charts: [
        { kind: "pie", title: "حالة التجديد لهذا الشهر", badge: "Progress", data: renewalStateData },
        { kind: "bar", title: "التجديدات حسب شركة التأمين", badge: "Companies", data: companyData },
        { kind: "area", title: "توزيع تواريخ انتهاء التجديدات", badge: "Due Dates", data: endMonthData },
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
      { kind: "bar", title: "التحصيل حسب شهر بداية التأمين", badge: "Monthly", data: startMonthData },
    ],
  };
}

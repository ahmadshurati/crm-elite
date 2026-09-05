"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Bell,
  CalendarDays,
  Car,
  Copy,
  Eye,
  Loader2,
  Menu,
  Pencil,
  Plus,
  Search,
  Trash2,
  X,
} from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  Tooltip,
  CartesianGrid,
  YAxis,
} from "recharts";
import { useModalA11y } from "@/lib/modal-a11y";
import { buildSectionUrl, parseMenuFromSearchParams, type MenuKey } from "@/lib/menu-navigation";
import {
  ACCIDENTS_API_URL,
  CUSTOMERS_API_URL,
  CUSTOMERS_INSIGHTS_API_URL,
  DEFAULT_PAGE_LIMIT,
  INSIGHT_MENUS,
  documentLabels,
  emptyDocuments,
  emptyForm,
} from "@/lib/crm/constants";
import { buildCustomerProfileBody } from "@/lib/crm/customer-profile";
import {
  buildCustomerNodes,
  mapDbAccidentToCase,
  mapDbCustomersToSubscribers,
} from "@/lib/crm/mappers";
import { formatHeaderDate, mapMenuToCustomerFilter } from "@/lib/crm/navigation-ui";
import {
  getCrmVocabulary,
  getPageDescriptionForTenant,
  getPageTitle,
  resolveBranding,
  type CrmVocabulary,
  type TenantBranding,
} from "@/lib/crm/vocabulary";
import { DEMO_COMPANY_ID } from "@/lib/tenant";
import type {
  AccidentCase,
  AccidentStatus,
  ActivityLog,
  AppUser,
  CheckItem,
  CustomerNode,
  DashboardStats,
  DocumentKey,
  FormState,
  InsuranceMainType,
  MenuInsightsData,
  PaidStatus,
  PaginationMeta,
  Subscriber,
} from "@/lib/crm/types";
import {
  accidentStatusColor,
  buildInsuranceText,
  calcPaymentStatus,
  compactSearchText,
  formatDateForInput,
  formatMoney,
  isExpiringThisMonth,
  normalizeSearchText,
  numberValue,
  paidColor,
  parseEndDate,
  parseInsuranceText,
  paymentStatusColor,
  statusColor,
  todayString,
} from "@/lib/crm/utils";
import { TablePagination } from "@/components/crm/layout/table-pagination";
import { CustomerTimelinePanel } from "@/components/crm/customer-timeline-panel";
import { TasksDashboard } from "@/components/crm/tasks-dashboard";
import { CalendarDashboard } from "@/components/crm/calendar-dashboard";
import { DealsPipeline } from "@/components/crm/deals-pipeline";
import { QuotesDashboard } from "@/components/crm/quotes-dashboard";
import { InvoicesDashboard } from "@/components/crm/invoices-dashboard";
import { ReportsDashboard } from "@/components/crm/reports-dashboard";
import { GlobalSearchPanel } from "@/components/crm/global-search-panel";
import { CrmNotificationsPanel, useNotificationCount } from "@/components/crm/crm-notifications-panel";
import { RoleTemplatesDashboard } from "@/components/crm/role-templates-dashboard";
import { SettingsDashboard } from "@/components/crm/settings-dashboard";
import { ImportDashboard } from "@/components/crm/import-dashboard";
import { AutomationDashboard } from "@/components/crm/automation-dashboard";
import { IntegrationsDashboard } from "@/components/crm/integrations-dashboard";
import { ProductsDashboard } from "@/components/crm/products-dashboard";
import { ContractsDashboard } from "@/components/crm/contracts-dashboard";
import { ArchivedCustomersDashboard } from "@/components/crm/archived-customers-dashboard";
import { FilesDashboard } from "@/components/crm/files-dashboard";
import { FieldAuditDashboard } from "@/components/crm/field-audit-dashboard";
import { InboxDashboard } from "@/components/crm/inbox-dashboard";
import { ExecutiveDashboard } from "@/components/crm/executive-dashboard";
import { CrmSidebar } from "@/components/crm/crm-sidebar";
import { CustomerSummaryPanel } from "@/components/crm/customer-summary-panel";
import { ROLES_API_URL } from "@/lib/crm/constants";
import { PERMISSION_FIELDS, permissionLabels } from "@/lib/crm/user-permissions";
import type { RoleTemplateRecord } from "@/lib/crm/role-templates-data";

function StatCard({
  label,
  value,
  helper,
}: {
  label: string;
  value: number;
  helper: string;
}) {
  return (
    <div className="rounded-[26px] border border-[#EAECEF] bg-white p-5 shadow-sm">
      <p className="text-sm text-[#707A84]">{label}</p>
      <div className="mt-3 flex items-end justify-between">
        <span className="text-4xl font-semibold text-[#1F2937]">{value}</span>
        <span className="rounded-full bg-[#EFF4FF] px-3 py-1 text-xs font-semibold text-[#3B82F6]">
          {helper}
        </span>
      </div>
    </div>
  );
}


function DashboardInsights({
  subscribers,
  allSubscribers,
  title = "تحليل ذكي للبيانات",
  mode,
  insightsData,
  totalRecords,
  isDemo = false,
}: {
  subscribers: Subscriber[];
  allSubscribers?: Subscriber[];
  title?: string;
  mode: MenuKey;
  isDemo?: boolean;
  insightsData?: {
    eyebrow: string;
    description: string;
    cards: { label: string; value: number | string; helper: string }[];
    charts: {
      kind: "pie" | "bar" | "area";
      title: string;
      badge: string;
      data: { name: string; value: number }[];
      money?: boolean;
    }[];
  } | null;
  totalRecords?: number | null;
}) {
  const safeSubscribers = Array.isArray(subscribers) ? subscribers : [];
  const fullSubscribers = Array.isArray(allSubscribers) ? allSubscribers : safeSubscribers;
  const useServerInsights = Boolean(insightsData);

  const COLORS = ["#3B82F6", "#3B82F6", "#7C3AED", "#10B981", "#F59E0B", "#EF4444", "#14B8A6", "#0EA5E9"];

  const money = (value: number) => formatMoney(numberValue(value));

  const countBy = (items: Subscriber[], getter: (item: Subscriber) => string) => {
    const map = new Map<string, number>();

    items.forEach((item) => {
      const key = String(getter(item) || "غير محدد").trim() || "غير محدد";
      map.set(key, (map.get(key) || 0) + 1);
    });

    return Array.from(map.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 7);
  };

  const monthLabel = (value: string) => {
    const date = parseEndDate(value);
    if (!date) return "غير محدد";
    return `${date.getMonth() + 1}/${date.getFullYear()}`;
  };

  const countByMonth = (items: Subscriber[], dateGetter: (item: Subscriber) => string) => {
    const map = new Map<string, number>();

    items.forEach((item) => {
      const label = monthLabel(dateGetter(item));
      map.set(label, (map.get(label) || 0) + 1);
    });

    return Array.from(map.entries())
      .map(([name, value]) => ({ name, value }))
      .slice(-8);
  };

  const uniqueCustomers = new Set(
    safeSubscribers
      .map((item) => Number(item.customerId))
      .filter((id) => Number.isFinite(id) && id > 0)
  ).size;

  const activePolicies = safeSubscribers.filter((item) => item.insuranceStatus === "فعال").length;
  const expiredPolicies = safeSubscribers.filter(
    (item) => item.insuranceStatus === "منتهي" || item.insuranceStatus === "غير فعال"
  ).length;

  const customerGroups = Array.from(
    safeSubscribers.reduce((map, item) => {
      const key = Number(item.customerId);
      if (!map.has(key)) map.set(key, [] as Subscriber[]);
      map.get(key)?.push(item);
      return map;
    }, new Map<number, Subscriber[]>()).values()
  );

  const customerLoadData = customerGroups
    .map((items) => ({
      name: items[0]?.subscriberName || "بدون اسم",
      value: items.length,
    }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 7);

  const carsPerCustomerData = customerGroups
    .map((items) => ({
      name: items[0]?.subscriberName || "بدون اسم",
      value: new Set(items.map((item) => item.carId)).size,
    }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 7);

  const renewalPending = safeSubscribers.filter((item) => {
    const itemEnd = parseEndDate(item.endDate);
    if (!itemEnd) return true;

    return !fullSubscribers.some((other) => {
      if (Number(other.customerId) !== Number(item.customerId)) return false;
      if (Number(other.id) === Number(item.id)) return false;

      const otherStart = parseEndDate(other.startDate);
      const otherEnd = parseEndDate(other.endDate);

      return Boolean(
        otherStart &&
        otherEnd &&
        (otherStart > itemEnd || otherEnd > itemEnd)
      );
    });
  }).length;

  const renewalDone = Math.max(safeSubscribers.length - renewalPending, 0);

  const totalPaid = safeSubscribers.reduce((sum, item) => sum + numberValue(item.paidAmount), 0);
  const totalRemaining = safeSubscribers.reduce((sum, item) => sum + numberValue(item.remainingAmount), 0);
  const cashTotal = safeSubscribers.reduce((sum, item) => sum + numberValue(item.cashAmount), 0);
  const visaTotal = safeSubscribers.reduce((sum, item) => sum + numberValue(item.visaAmount), 0);
  const checksTotal = safeSubscribers.reduce((sum, item) => sum + numberValue(item.checksAmount), 0);
  const totalRevenue = safeSubscribers.reduce((sum, item) => sum + numberValue(item.totalAmount), 0);

  const companyData = countBy(safeSubscribers, (item) => item.insuranceCompany);
  const typeData = countBy(safeSubscribers, (item) => item.insuranceType);
  const statusData = countBy(safeSubscribers, (item) => item.insuranceStatus);
  const endMonthData = countByMonth(safeSubscribers, (item) => item.endDate);
  const startMonthData = countByMonth(safeSubscribers, (item) => item.startDate);
  const paymentMethodData = [
    { name: "كاش", value: cashTotal },
    { name: "فيزا", value: visaTotal },
    { name: "شيكات", value: checksTotal },
  ].filter((item) => item.value > 0);

  const collectionData = [
    { name: "مدفوع", value: totalPaid },
    { name: "متبقي", value: totalRemaining },
  ];

  const buildConfig = () => {
    if (mode === "active-subscribers") {
      return {
        eyebrow: "",
        description: isDemo
          ? "تحليل شامل للحسابات النشطة: العملاء، أنواع الخدمة، وقرب التجديد."
          : "تحليل خاص بالتأمينات الفعالة: شركات التأمين، أنواع التغطية، وقرب الانتهاء.",
        cards: [
          { label: isDemo ? "حسابات نشطة" : "تأمينات فعالة", value: safeSubscribers.length, helper: isDemo ? "حساب" : "سجل تأمين" },
          { label: isDemo ? "عملاء" : "زبائن", value: uniqueCustomers, helper: isDemo ? "عميل" : "زبون" },
          { label: isDemo ? "الجهات" : "شركات تأمين", value: companyData.length, helper: isDemo ? "جهة" : "شركة" },
          { label: isDemo ? "أنواع الخدمة" : "أنواع تغطية", value: typeData.length, helper: "نوع" },
          { label: "تنتهي هذا الشهر", value: safeSubscribers.filter((item) => isExpiringThisMonth(item.endDate)).length, helper: "تنبيه" },
        ],
        charts: [
          { kind: "pie", title: isDemo ? "توزيع الحسابات حسب الجهة" : "توزيع التأمينات حسب الشركة", badge: "Companies", data: companyData },
          { kind: "bar", title: isDemo ? "أنواع الخدمة" : "أنواع التأمين الفعالة", badge: "Coverage", data: typeData },
          { kind: "area", title: isDemo ? "مواعيد التجديد القادمة" : "مواعيد الانتهاء القادمة", badge: "Expiry", data: endMonthData },
        ],
      };
    }

    if (mode === "active-customers") {
      return {
        eyebrow: "",
        description: isDemo
          ? "تحليل شامل للعملاء النشطين: كل عميل مرة واحدة مع عدد حساباته وخدماته."
          : "تحليل خاص بالمشتركين الفعالين: كل زبون مرة واحدة مع ثقل التأمينات والسيارات المرتبطة به.",
        cards: [
          { label: isDemo ? "عملاء نشطون" : "مشتركين فعالين", value: uniqueCustomers, helper: isDemo ? "عميل" : "زبون" },
          { label: isDemo ? "حسابات نشطة" : "تأمينات فعالة", value: safeSubscribers.length, helper: isDemo ? "حساب" : "تأمين" },
          { label: isDemo ? "متوسط الحسابات" : "متوسط التأمينات", value: uniqueCustomers ? Number((safeSubscribers.length / uniqueCustomers).toFixed(1)) : 0, helper: isDemo ? "لكل عميل" : "لكل زبون" },
          { label: isDemo ? "أكثر عميل" : "أكثر زبون", value: customerLoadData[0]?.value || 0, helper: isDemo ? "حسابات" : "تأمينات" },
          { label: isDemo ? "خدمات فعّالة" : "سيارات فعالة", value: new Set(safeSubscribers.map((item) => item.carId)).size, helper: isDemo ? "خدمة" : "سيارة" },
        ],
        charts: [
          { kind: "bar", title: isDemo ? "أكثر العملاء لديهم حسابات" : "أكثر الزبائن لديهم تأمينات", badge: "Clients", data: customerLoadData },
          { kind: "pie", title: isDemo ? "توزيع جهات العملاء النشطين" : "توزيع شركات زبائن فعالين", badge: "Companies", data: companyData },
          { kind: "area", title: isDemo ? "عدد الحسابات لكل عميل" : "عدد السيارات لكل زبون", badge: "Vehicles", data: carsPerCustomerData },
        ],
      };
    }

    if (mode === "inactive-subscribers") {
      return {
        eyebrow: "",
        description: isDemo
          ? "تحليل شامل للحسابات غير النشطة/المغلقة وتوزيعها."
          : "تحليل خاص بالمنتهية وغير الفعالة: أين تتراكم الانتهاءات ومن أي شركات تأتي.",
        cards: [
          { label: isDemo ? "حسابات غير نشطة" : "سجلات غير فعالة", value: safeSubscribers.length, helper: isDemo ? "حساب" : "سجل" },
          { label: "منتهية", value: safeSubscribers.filter((item) => item.insuranceStatus === "منتهي").length, helper: "منتهي" },
          { label: "غير فعالة", value: safeSubscribers.filter((item) => item.insuranceStatus === "غير فعال").length, helper: "غير فعال" },
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
      return {
        eyebrow: "",
        description: isDemo
          ? "تحليل شامل للسجل: عدد الحسابات لكل عميل، النشاط التاريخي، والحالات المتراكمة."
          : "تحليل خاص بالسجل: كثافة التأمينات لكل زبون، النشاط التاريخي، والحالات المتراكمة.",
        cards: [
          { label: isDemo ? "عملاء بالسجل" : "زبائن بالسجل", value: uniqueCustomers, helper: isDemo ? "عميل" : "زبون" },
          { label: isDemo ? "كل الحسابات" : "كل التأمينات", value: safeSubscribers.length, helper: "سجل" },
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
      const renewalStateData = [
        { name: "تم تجديده", value: renewalDone },
        { name: "لم يتم بعد", value: renewalPending },
      ];

      return {
        eyebrow: "",
        description: isDemo
          ? "تحليل شامل لمتابعات وتجديدات الشهر: من تمّ ومن بقي للتواصل معه، مع توزيع الجهات والمواعيد."
          : "تحليل خاص بتجديدات الشهر: من تم تجديده ومن بقي للتواصل معه، مع توزيع الشركات والمواعيد.",
        cards: [
          { label: isDemo ? "مطلوب متابعة" : "مطلوب تجديد", value: safeSubscribers.length, helper: "هذا الشهر" },
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

    return {
      eyebrow: "Financial",
      description: "تحليل خاص بالحسابات فقط: المدفوع، المتبقي، طرق الدفع، والتحصيل الشهري.",
      cards: [
        { label: "إجمالي المطلوب", value: money(totalRevenue), helper: "Revenue" },
        { label: "إجمالي المدفوع", value: money(totalPaid), helper: "Collected" },
        { label: "إجمالي المتبقي", value: money(totalRemaining), helper: "Outstanding" },
        { label: "كاش", value: money(cashTotal), helper: "Cash" },
        { label: "فيزا + شيكات", value: money(visaTotal + checksTotal), helper: "Non-cash" },
      ],
      charts: [
        { kind: "area", title: "المدفوع مقابل المتبقي", badge: "Collection", data: collectionData, money: true },
        { kind: "pie", title: "توزيع طرق الدفع", badge: "Payment Mix", data: paymentMethodData.length ? paymentMethodData : [{ name: "لا يوجد", value: 1 }], money: true },
        { kind: "bar", title: isDemo ? "التحصيل حسب شهر بداية الحساب" : "التحصيل حسب شهر بداية التأمين", badge: "Monthly", data: startMonthData },
      ],
    };
  };

  const config = useServerInsights
    ? {
        eyebrow: insightsData!.eyebrow,
        description: insightsData!.description,
        cards: insightsData!.cards,
        charts: insightsData!.charts,
      }
    : buildConfig();

  const displayedTotal =
    typeof totalRecords === "number" && totalRecords >= 0
      ? totalRecords
      : safeSubscribers.length;

  const renderValue = (value: any) => {
    if (typeof value === "string") return value;
    return Number(value || 0).toLocaleString("he-IL");
  };

  const renderTooltipValue = (chart: any, value: any) =>
    chart.money ? money(Number(value)) : Number(value || 0).toLocaleString("he-IL");

  const chartTotal = (data: any[]) =>
    data.reduce((sum, item) => sum + numberValue(item.value), 0);

  const ProTooltip = ({ active, payload, label, chart }: any) => {
    if (!active || !payload || !payload.length) return null;

    const item = payload[0];
    const name = item?.payload?.name || label || "";
    const value = item?.value ?? item?.payload?.value ?? 0;

    return (
      <div className="rounded-2xl border border-white/70 bg-white/95 px-4 py-3 text-right shadow-2xl backdrop-blur-xl">
        <p className="text-[12px] font-black text-[#1F2937]">{name}</p>
        <p className="mt-1 text-[15px] font-black text-[#3B82F6]">
          {renderTooltipValue(chart, value)}
        </p>
      </div>
    );
  };

  const renderChart = (chart: any, index: number) => {
    const data = chart.data && chart.data.length ? chart.data : [{ name: "لا يوجد", value: 1 }];
    const gradientId = `analyticsGradient-${mode}-${index}`;
    const barGradientId = `barGradient-${mode}-${index}`;
    const shadowId = `chartShadow-${mode}-${index}`;
    const total = chartTotal(data);

    if (chart.kind === "pie") {
      return (
        <PieChart>
          <defs>
            <filter id={shadowId} x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="8" stdDeviation="8" floodColor="#0F172A" floodOpacity="0.16" />
            </filter>
            {data.map((_: any, i: number) => (
              <linearGradient key={`pie-gradient-${mode}-${index}-${i}`} id={`pieFill-${mode}-${index}-${i}`} x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor={COLORS[i % COLORS.length]} stopOpacity="0.95" />
                <stop offset="100%" stopColor={COLORS[(i + 2) % COLORS.length]} stopOpacity="0.72" />
              </linearGradient>
            ))}
          </defs>

          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            innerRadius={72}
            outerRadius={106}
            paddingAngle={4}
            cornerRadius={12}
            stroke="rgba(255,255,255,0.9)"
            strokeWidth={3}
            filter={`url(#${shadowId})`}
          >
            {data.map((_: any, i: number) => (
              <Cell key={`cell-${mode}-${index}-${i}`} fill={`url(#pieFill-${mode}-${index}-${i})`} />
            ))}
          </Pie>

          <text x="50%" y="45%" textAnchor="middle" dominantBaseline="middle" className="fill-[#8B95A1] text-[11px] font-bold">
            المجموع
          </text>
          <text x="50%" y="55%" textAnchor="middle" dominantBaseline="middle" className="fill-[#1F2937] text-[20px] font-black">
            {chart.money ? money(total) : total.toLocaleString("he-IL")}
          </text>

          <Tooltip content={<ProTooltip chart={chart} />} />
        </PieChart>
      );
    }

    if (chart.kind === "bar") {
      return (
        <BarChart data={data} margin={{ top: 18, right: 8, left: 8, bottom: 0 }}>
          <defs>
            <linearGradient id={barGradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#3B82F6" stopOpacity="1" />
              <stop offset="55%" stopColor="#14B8A6" stopOpacity="0.88" />
              <stop offset="100%" stopColor="#CCFBF1" stopOpacity="0.8" />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke="#EEF2F6" strokeDasharray="4 8" />
          <XAxis
            dataKey="name"
            tickLine={false}
            axisLine={false}
            fontSize={11}
            tickMargin={12}
            interval={0}
            minTickGap={8}
          />
          <YAxis hide />
          <Tooltip cursor={{ fill: "rgba(15,139,148,0.06)", radius: 18 }} content={<ProTooltip chart={chart} />} />
          <Bar
            dataKey="value"
            fill={`url(#${barGradientId})`}
            radius={[18, 18, 8, 8]}
            maxBarSize={58}
            background={{ fill: "#F8FAFC", radius: 18 }}
          />
        </BarChart>
      );
    }

    return (
      <AreaChart data={data} margin={{ top: 20, right: 8, left: 8, bottom: 0 }}>
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#3B82F6" stopOpacity={0.44} />
            <stop offset="45%" stopColor="#14B8A6" stopOpacity={0.18} />
            <stop offset="100%" stopColor="#FFFFFF" stopOpacity={0.02} />
          </linearGradient>
          <filter id={shadowId} x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="8" stdDeviation="8" floodColor="#3B82F6" floodOpacity="0.18" />
          </filter>
        </defs>
        <CartesianGrid vertical={false} stroke="#EEF2F6" strokeDasharray="4 8" />
        <XAxis dataKey="name" tickLine={false} axisLine={false} fontSize={11} tickMargin={12} />
        <YAxis hide />
        <Tooltip cursor={{ stroke: "#3B82F6", strokeWidth: 1, strokeDasharray: "5 5" }} content={<ProTooltip chart={chart} />} />
        <Area
          type="monotone"
          dataKey="value"
          stroke="#3B82F6"
          strokeWidth={4}
          fill={`url(#${gradientId})`}
          dot={false}
          activeDot={{ r: 7, strokeWidth: 4, stroke: "#FFFFFF", fill: "#3B82F6" }}
          filter={`url(#${shadowId})`}
        />
      </AreaChart>
    );
  };

  return (
    <section className="mt-8 overflow-hidden rounded-[28px] border border-[#EAECEF] bg-white shadow-sm">
      <div className="border-b border-[#E6EEF1] bg-[#EFF4FF] px-7 py-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="text-right">
            {config.eyebrow ? (
              <p className="text-[13px] font-bold text-[#3B82F6]">{config.eyebrow}</p>
            ) : null}
            <h2 className="mt-1 text-3xl font-bold text-[#1F2937]">{title}</h2>
            <p className="mt-2 max-w-3xl text-sm leading-7 text-[#707A84]">{config.description}</p>
          </div>

          <div className="rounded-2xl border border-[#D9EFEE] bg-white px-5 py-4 text-right shadow-sm">
            <p className="text-[11px] font-bold text-[#8B95A1]">إجمالي السجلات</p>
            <p className="mt-1 text-2xl font-bold text-[#3B82F6]">
              {displayedTotal.toLocaleString("he-IL")}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 p-6 md:grid-cols-5">
        {config.cards.map((card: any, index: number) => (
          <div
            key={`${mode}-card-${index}`}
            className="group relative overflow-hidden rounded-[30px] border border-white/80 bg-white p-5 shadow-[0_16px_40px_rgba(15,23,42,0.06)] ring-1 ring-[#EEF2F6] transition hover:-translate-y-1 hover:shadow-[0_24px_60px_rgba(15,23,42,0.10)]"
          >
            <div className="absolute -left-8 -top-8 h-20 w-20 rounded-full bg-[#3B82F6]/10 blur-2xl" />
            <p className="relative text-xs font-extrabold text-[#8B95A1]">{card.label}</p>
            <p className="relative mt-3 truncate text-3xl font-black tracking-tight text-[#1F2937]">{renderValue(card.value)}</p>
            <span className="relative mt-3 inline-flex rounded-full bg-[#EFF4FF] px-3 py-1 text-[11px] font-bold text-[#3B82F6]">
              {card.helper}
            </span>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 px-6 pb-6 xl:grid-cols-3">
        {config.charts.map((chart: any, index: number) => {
          const data = chart.data && chart.data.length ? chart.data : [];

          return (
            <div
              key={`${mode}-chart-${index}`}
              className="group relative overflow-hidden rounded-[34px] border border-white/80 bg-white p-5 shadow-[0_18px_55px_rgba(15,23,42,0.07)] ring-1 ring-[#E8EEF2] transition hover:-translate-y-1 hover:shadow-[0_28px_75px_rgba(15,23,42,0.12)]"
            >
              <div className="pointer-events-none absolute -left-16 -top-16 h-36 w-36 rounded-full bg-[#3B82F6]/10 blur-3xl" />
              <div className="pointer-events-none absolute -right-16 bottom-0 h-32 w-32 rounded-full bg-[#7C3AED]/10 blur-3xl" />

              <div className="relative mb-4 flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-[15px] font-black text-[#1F2937]">{chart.title}</h3>
                  <p className="mt-1 text-[11px] font-bold text-[#8B95A1]">Live data visualization</p>
                </div>
                <span className="rounded-full border border-[#D8F3F1] bg-[#EFF4FF] px-3 py-1 text-[11px] font-extrabold text-[#3B82F6] shadow-sm">
                  {chart.badge}
                </span>
              </div>

              <div className="relative h-[295px] rounded-[28px] bg-[linear-gradient(180deg,#FFFFFF_0%,#F8FAFC_100%)] p-2">
                <ResponsiveContainer width="100%" height="100%">
                  {renderChart(chart, index)}
                </ResponsiveContainer>
              </div>

              {data.length > 0 && (
                <div className="relative mt-4 flex flex-wrap gap-2">
                  {data.slice(0, 4).map((item: any, i: number) => (
                    <span key={`${chart.title}-${item.name}-${i}`} className="rounded-full bg-[#F8FAFC] px-3 py-1 text-[11px] font-bold text-[#4B5563]">
                      <span
                        className="ml-1 inline-block h-2 w-2 rounded-full"
                        style={{ backgroundColor: COLORS[i % COLORS.length] }}
                      />
                      {item.name}: {chart.money ? money(Number(item.value)) : Number(item.value || 0).toLocaleString("he-IL")}
                    </span>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

function SubscribersTable({
  data,
  title,
  labels,
  loading,
  pagination,
  onPageChange,
  onViewDocuments,
  onOpenHistory,
  onEdit,
  onDelete,
}: {
  data: Subscriber[];
  title: string;
  labels: CrmVocabulary;
  loading: boolean;
  pagination?: PaginationMeta | null;
  onPageChange?: (page: number) => void;
  onViewDocuments: (subscriber: Subscriber) => void;
  onOpenHistory: (subscriber: Subscriber) => void;
  onEdit: (subscriber: Subscriber) => void;
  onDelete: (id: number) => void;
}) {
  return (
    <section className="mt-8 rounded-[28px] border border-[#EAECEF] bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-[#EEF1F4] px-5 py-4">
        <div>
          <h3 className="text-[18px] font-semibold text-[#1F2937]">{title}</h3>
          <p className="mt-1 text-[13px] text-[#707A84]">
            {loading ? "جاري تحميل البيانات..." : pagination ? `عدد السجلات: ${pagination.total} (الصفحة ${pagination.page})` : `عدد السجلات: ${data.length}`}
          </p>
        </div>
      </div>

      <div className="overflow-hidden">
        <table className="w-full table-fixed text-right text-[9px] leading-5">
          <thead>
            <tr className="border-b border-[#EEF1F4] text-[#8B95A1]">
              <th className="w-[12%] px-1 py-3">الاسم</th>
              <th className="w-[8%] px-1 py-3">{labels.tableCar}</th>
              <th className="w-[7%] px-1 py-3">{labels.tableCarNumber}</th>
              <th className="w-[8%] px-1 py-3">الهاتف</th>
              <th className="w-[8%] px-1 py-3">{labels.tableService}</th>
              <th className="w-[8%] px-1 py-3">{labels.tableProvider}</th>
              <th className="w-[7%] px-1 py-3">النهاية</th>
              <th className="w-[8%] px-1 py-3">أُضيف</th>
              <th className="w-[6%] px-1 py-3">الحالة</th>
              <th className="w-[6%] px-1 py-3">الدفع</th>
              <th className="w-[8%] px-1 py-3">السجل</th>
              <th className="w-[4%] px-1 py-3">{labels.tableDocument}</th>
              <th className="w-[10%] px-1 py-3">إجراءات</th>
            </tr>
          </thead>

          <tbody>
            {loading ? (
              <tr>
                <td colSpan={13} className="px-6 py-12 text-center text-[#707A84]">
                  جاري تحميل البيانات من قاعدة البيانات...
                </td>
              </tr>
            ) : data.length === 0 ? (
              <tr>
                <td colSpan={13} className="px-6 py-12 text-center text-[#707A84]">
                  لا توجد بيانات
                </td>
              </tr>
            ) : (
              data.map((row) => (
                <tr
                  key={row.id}
                  className="border-b border-[#F1F5F9] last:border-none"
                >
                  <td className="truncate px-1 py-3 font-medium text-[#1F2937]">
                    {row.subscriberName}
                  </td>
                  <td className="truncate px-1 py-3 text-[#4B5563]">{row.carName}</td>
                  <td className="truncate px-1 py-3 text-[#4B5563]">{row.carNumber}</td>
                  <td className="truncate px-1 py-3 text-[#4B5563]" dir="ltr">
                    {row.customerNumber}
                  </td>
                  <td className="truncate px-1 py-3 text-[#4B5563]">
                    {row.insuranceType}
                  </td>
                  <td className="truncate px-1 py-3 text-[#4B5563]">
                    {row.insuranceCompany}
                  </td>
                  <td className="truncate px-1 py-3 text-[#4B5563]">{row.endDate}</td>
                  <td className="truncate px-1 py-3 text-[#4B5563]" dir="ltr">{row.dateAdded || "-"}</td>

                  <td className="px-1 py-3">
                    <span
                      className={`rounded-full px-2 py-1 text-[9px] font-semibold ${statusColor(
                        row.insuranceStatus
                      )}`}
                    >
                      {row.insuranceStatus}
                    </span>
                  </td>

                  <td className="px-1 py-3">
                    <span
                      className={`rounded-full px-2 py-1 text-[9px] font-semibold ${paidColor(
                        row.paidStatus
                      )}`}
                    >
                      {row.paidStatus}
                    </span>
                  </td>

                  <td className="px-1 py-3">
                    <button
                      type="button"
                      onClick={() => onOpenHistory(row)}
                      className="rounded-xl border border-[#E5E7EB] bg-white px-3 py-2 text-[10px] font-bold text-[#3B82F6] transition hover:bg-[#EFF4FF]"
                      title={labels.tableHistory}
                    >
                      عرض السجل
                    </button>
                  </td>

                  <td className="px-1 py-3">
                    <button
                      type="button"
                      onClick={() => onViewDocuments(row)}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-[#E5E7EB] bg-white transition hover:bg-[#EFF4FF]"
                      title="عرض المستندات"
                    >
                      <Eye className="h-4 w-4 text-[#3B82F6]" />
                    </button>
                  </td>

                  <td className="px-1 py-3">
                    <div className="flex items-center justify-center gap-1">
                      <button
                        onClick={() => onEdit(row)}
                        className="inline-flex h-7 w-7 items-center justify-center rounded-xl border border-[#E5E7EB] bg-white hover:bg-blue-50"
                        title="تعديل"
                      >
                        <Pencil className="h-3.5 w-3.5 text-blue-600" />
                      </button>

                      <button
                        onClick={() => onDelete(row.id)}
                        className="inline-flex h-7 w-7 items-center justify-center rounded-xl border border-[#E5E7EB] bg-white hover:bg-rose-50"
                        title="حذف"
                      >
                        <Trash2 className="h-3.5 w-3.5 text-rose-600" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <TablePagination pagination={pagination || null} onPageChange={onPageChange || (() => {})} loading={loading} />
    </section>
  );
}

function AccidentTable({
  data,
  labels,
  loading,
  pagination,
  onPageChange,
  onOpenCase,
}: {
  data: AccidentCase[];
  labels: CrmVocabulary;
  loading?: boolean;
  pagination?: PaginationMeta | null;
  onPageChange?: (page: number) => void;
  onOpenCase: (accident: AccidentCase) => void;
}) {
  return (
    <section className="mt-8 rounded-[28px] border border-[#EAECEF] bg-white shadow-sm">
      <div className="border-b border-[#EEF1F4] px-6 py-5">
        <h3 className="text-[20px] font-semibold">{labels.accidentTitle}</h3>
        <p className="mt-1 text-[14px] text-[#707A84]">{pagination ? `عدد الحالات: ${pagination.total} (الصفحة ${pagination.page})` : `عدد الحالات: ${data.length}`}</p>
      </div>

      <table className="min-w-full text-right text-sm">
        <thead>
          <tr className="border-b text-[14px] text-[#8B95A1]">
            <th className="px-6 py-4">رقم الملف</th>
            <th className="px-6 py-4">{labels.accidentCustomer}</th>
            <th className="px-6 py-4">الهاتف</th>
            <th className="px-6 py-4">{labels.tableCar}</th>
            <th className="px-6 py-4">{labels.tableCarNumber}</th>
            <th className="px-6 py-4">الحالة</th>
            <th className="px-6 py-4">التاريخ</th>
          </tr>
        </thead>

        <tbody>
          {data.length === 0 ? (
            <tr>
              <td colSpan={7} className="px-6 py-12 text-center text-[#707A84]">
                {labels.accidentEmpty}
              </td>
            </tr>
          ) : (
            data.map((row) => (
              <tr
                key={row.id}
                onDoubleClick={() => onOpenCase(row)}
                className="cursor-pointer border-b transition last:border-none hover:bg-[#F8FAFC]"
                title="دبل كليك لفتح الحالة"
              >
                <td className="px-6 py-4 font-semibold">{row.caseNumber}</td>
                <td className="px-6 py-4">{row.subscriberName}</td>
                <td className="px-6 py-4" dir="ltr">
                  {row.customerNumber}
                </td>
                <td className="px-6 py-4">{row.carName}</td>
                <td className="px-6 py-4">{row.carNumber}</td>
                <td className="px-6 py-4">
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-bold ${accidentStatusColor(
                      row.status
                    )}`}
                  >
                    {row.status}
                  </span>
                </td>
                <td className="px-6 py-4">{row.openedAt}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
      <TablePagination pagination={pagination || null} onPageChange={onPageChange || (() => {})} loading={loading} />
    </section>
  );
}

function AddAccidentModal({
  customers,
  onClose,
  onSave,
}: {
  customers: CustomerNode[];
  onClose: () => void;
  onSave: (accident: Omit<AccidentCase, "id" | "updates">) => void;
}) {
  useModalA11y(true, onClose);
  const [query, setQuery] = useState("");
  const [selectedCustomerKey, setSelectedCustomerKey] = useState("");
  const [selectedCarId, setSelectedCarId] = useState("");
  const [caseNumber, setCaseNumber] = useState(`ACC-${Date.now()}`);
  const [details, setDetails] = useState("");
  const [status, setStatus] = useState<AccidentStatus>("مفتوح");

  const filteredCustomers = customers.filter((customer) => {
    const term = query.trim().toLowerCase();
    if (!term) return true;

    const text = [
      customer.subscriberName,
      customer.customerNumber,
      ...customer.cars.map((car) => `${car.carName} ${car.carNumber}`),
    ]
      .join(" ")
      .toLowerCase();

    return text.includes(term);
  });

  const selectedCustomer =
    customers.find((customer) => customer.customerKey === selectedCustomerKey) || null;

  const selectedCar =
    selectedCustomer?.cars.find((car) => String(car.id) === selectedCarId) || null;

  const inputClass =
    "h-12 w-full rounded-2xl border border-[#E5E7EB] bg-white px-4 text-[15px] text-[#1F2937] outline-none focus:border-[#3B82F6]";
  const labelClass = "mb-2 block text-[14px] font-medium text-[#374151]";

  const handleSave = () => {
    if (!selectedCustomer || !selectedCar) {
      alert("اختار زبون وسيارة");
      return;
    }

    if (!caseNumber.trim()) {
      alert("اكتب رقم الملف");
      return;
    }

    if (!details.trim()) {
      alert("اكتب تفاصيل الحادث");
      return;
    }

    onSave({
      customerId: selectedCustomer.customerId,
      carId: selectedCar.carId,
      caseNumber: caseNumber.trim(),
      subscriberName: selectedCustomer.subscriberName,
      customerNumber: selectedCustomer.customerNumber,
      carName: selectedCar.carName,
      carNumber: selectedCar.carNumber,
      insuranceCompany: selectedCar.insuranceCompany,
      insuranceType: selectedCar.insuranceType,
      details: details.trim(),
      status,
      openedAt: todayString(),
    });

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-6">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-accident-title"
        className="relative max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl"
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="إغلاق"
          className="absolute left-5 top-5 rounded-full bg-white p-2 shadow hover:bg-gray-100"
        >
          <X className="h-5 w-5" />
        </button>

        <h3 id="add-accident-title" className="text-2xl font-bold text-[#1F2937]">
          إضافة حالة حادث جديدة
        </h3>
        <p className="mt-1 text-sm text-[#707A84]">
          اختار الزبون حسب الاسم أو رقم الهاتف أو رقم السيارة
        </p>

        <div className="mt-6 grid grid-cols-1 gap-5 md:grid-cols-2">
          <div className="md:col-span-2">
            <label htmlFor="add-accident-search" className={labelClass}>
              بحث عن الزبون
            </label>
            <input
              id="add-accident-search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className={inputClass}
              placeholder="اسم الزبون، رقم الهاتف، رقم السيارة..."
            />
          </div>

          <div>
            <label className={labelClass}>اسم الزبون</label>
            <select
              value={selectedCustomerKey}
              onChange={(e) => {
                setSelectedCustomerKey(e.target.value);
                setSelectedCarId("");
              }}
              className={inputClass}
            >
              <option value="">اختار الزبون</option>
              {filteredCustomers.map((customer) => (
                <option key={customer.customerKey} value={customer.customerKey}>
                  {customer.subscriberName} - {customer.customerNumber || "بدون هاتف"}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className={labelClass}>السيارة</label>
            <select
              value={selectedCarId}
              onChange={(e) => setSelectedCarId(e.target.value)}
              disabled={!selectedCustomer}
              className={`${inputClass} disabled:bg-gray-100`}
            >
              <option value="">اختار السيارة</option>
              {selectedCustomer?.cars.map((car) => (
                <option key={car.id} value={car.id}>
                  {car.carName} - {car.carNumber} - {car.insuranceCompany}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className={labelClass}>رقم الملف</label>
            <input
              value={caseNumber}
              onChange={(e) => setCaseNumber(e.target.value)}
              className={inputClass}
              dir="ltr"
            />
          </div>

          <div>
            <label className={labelClass}>حالة الحادث</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as AccidentStatus)}
              className={inputClass}
            >
              <option value="مفتوح">مفتوح</option>
              <option value="مغلق">مغلق</option>
            </select>
          </div>

          {selectedCar && (
            <div className="md:col-span-2 rounded-2xl border border-[#E5E7EB] bg-[#FAFAFA] p-4">
              <p className="font-bold text-[#1F2937]">بيانات السيارة المختارة</p>
              <div className="mt-3 grid grid-cols-1 gap-3 text-sm text-[#4B5563] md:grid-cols-4">
                <div>{selectedCar.carName}</div>
                <div>{selectedCar.carNumber}</div>
                <div>{selectedCar.insuranceCompany}</div>
                <div>{selectedCar.insuranceType}</div>
              </div>
            </div>
          )}

          <div className="md:col-span-2">
            <label htmlFor="add-accident-details" className={labelClass}>
              تفاصيل الحادث
            </label>
            <textarea
              id="add-accident-details"
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              className="min-h-[140px] w-full rounded-2xl border border-[#E5E7EB] bg-white px-4 py-3 text-[15px] text-[#1F2937] outline-none focus:border-[#3B82F6]"
              placeholder="اكتب تفاصيل الحادث..."
            />
          </div>

          <div className="flex gap-3 md:col-span-2">
            <button
              type="button"
              onClick={handleSave}
              className="rounded-2xl bg-[#3B82F6] px-8 py-3 font-bold text-white"
            >
              حفظ
            </button>

            <button
              type="button"
              onClick={onClose}
              className="rounded-2xl border border-[#E5E7EB] bg-white px-8 py-3 font-bold text-[#374151]"
            >
              إلغاء
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function AccidentDetailsModal({
  accident,
  onClose,
  onSave,
  canDelete,
  onDelete,
}: {
  accident: AccidentCase;
  onClose: () => void;
  onSave: (accident: AccidentCase) => void;
  canDelete?: boolean;
  onDelete?: (id: number) => void;
}) {
  useModalA11y(true, onClose);
  const [localAccident, setLocalAccident] = useState<AccidentCase>(accident);
  const [newUpdate, setNewUpdate] = useState("");

  const addUpdate = () => {
    if (!newUpdate.trim()) {
      alert("اكتب التحديث قبل الإضافة");
      return;
    }

    setLocalAccident((prev) => ({
      ...prev,
      updates: [
        ...prev.updates,
        {
          id: Date.now(),
          text: newUpdate.trim(),
          date: todayString(),
        },
      ],
    }));

    setNewUpdate("");
  };

  const saveAndClose = () => {
    onSave(localAccident);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-6">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="accident-details-title"
        className="relative max-h-[90vh] w-full max-w-5xl overflow-y-auto rounded-3xl bg-[#F7F8FA] p-6 shadow-2xl"
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="إغلاق"
          className="absolute left-5 top-5 z-10 rounded-full bg-white p-2 shadow hover:bg-gray-100"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="rounded-3xl border border-[#E5E7EB] bg-white p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h3 id="accident-details-title" className="text-2xl font-bold text-[#1F2937]">
                حالة حادث: {localAccident.caseNumber}
              </h3>
              <p className="mt-2 text-sm text-[#707A84]">
                {localAccident.subscriberName} - {localAccident.customerNumber}
              </p>
            </div>

            <select
              value={localAccident.status}
              onChange={(e) =>
                setLocalAccident((prev) => ({
                  ...prev,
                  status: e.target.value as AccidentStatus,
                }))
              }
              className="h-11 rounded-2xl border border-[#E5E7EB] bg-white px-4 text-sm font-bold outline-none focus:border-[#3B82F6]"
            >
              <option value="مفتوح">مفتوح</option>
              <option value="مغلق">مغلق</option>
            </select>
          </div>

          <div className="mt-6 grid grid-cols-1 gap-4 text-sm md:grid-cols-4">
            <div className="rounded-2xl bg-[#FAFAFA] p-4">
              <p className="text-[#8B95A1]">السيارة</p>
              <p className="mt-1 font-bold text-[#1F2937]">{localAccident.carName}</p>
            </div>

            <div className="rounded-2xl bg-[#FAFAFA] p-4">
              <p className="text-[#8B95A1]">رقم السيارة</p>
              <p className="mt-1 font-bold text-[#1F2937]">{localAccident.carNumber}</p>
            </div>

            <div className="rounded-2xl bg-[#FAFAFA] p-4">
              <p className="text-[#8B95A1]">شركة التأمين</p>
              <p className="mt-1 font-bold text-[#1F2937]">
                {localAccident.insuranceCompany}
              </p>
            </div>

            <div className="rounded-2xl bg-[#FAFAFA] p-4">
              <p className="text-[#8B95A1]">نوع التأمين</p>
              <p className="mt-1 font-bold text-[#1F2937]">
                {localAccident.insuranceType}
              </p>
            </div>
          </div>

          <div className="mt-6">
            <label htmlFor="accident-details-text" className="mb-2 block text-sm font-bold text-[#374151]">
              تفاصيل الحادث
            </label>
            <textarea
              id="accident-details-text"
              value={localAccident.details}
              onChange={(e) =>
                setLocalAccident((prev) => ({
                  ...prev,
                  details: e.target.value,
                }))
              }
              className="min-h-[130px] w-full rounded-2xl border border-[#E5E7EB] bg-white px-4 py-3 text-[15px] text-[#1F2937] outline-none focus:border-[#3B82F6]"
            />
          </div>
        </div>

        <div className="mt-5 rounded-3xl border border-[#E5E7EB] bg-white p-6">
          <h4 className="text-xl font-bold text-[#1F2937]">التحديثات</h4>

          <div className="mt-5 space-y-3">
            {localAccident.updates.length === 0 ? (
              <div className="rounded-2xl bg-[#FAFAFA] p-6 text-center text-[#707A84]">
                لا توجد تحديثات بعد
              </div>
            ) : (
              localAccident.updates.map((update) => (
                <div
                  key={update.id}
                  className="rounded-2xl border border-[#E5E7EB] bg-[#FAFAFA] p-4"
                >
                  <div className="mb-2 text-xs font-bold text-[#3B82F6]">
                    {update.date}
                  </div>
                  <p className="whitespace-pre-wrap text-sm leading-7 text-[#374151]">
                    {update.text}
                  </p>
                </div>
              ))
            )}
          </div>

          <div className="mt-6">
            <label htmlFor="accident-new-update" className="mb-2 block text-sm font-bold text-[#374151]">
              إضافة تحديث جديد
            </label>

            <textarea
              id="accident-new-update"
              value={newUpdate}
              onChange={(e) => setNewUpdate(e.target.value)}
              className="min-h-[110px] w-full rounded-2xl border border-[#E5E7EB] bg-white px-4 py-3 text-[15px] text-[#1F2937] outline-none focus:border-[#3B82F6]"
              placeholder="اكتب التحديث الجديد..."
            />

            <div className="mt-4 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={addUpdate}
                className="rounded-2xl bg-[#3B82F6] px-6 py-3 font-bold text-white"
              >
                إضافة التحديث
              </button>

              <button
                type="button"
                onClick={saveAndClose}
                className="rounded-2xl bg-[#1F2937] px-6 py-3 font-bold text-white"
              >
                حفظ والرجوع
              </button>

              <button
                type="button"
                onClick={onClose}
                className="rounded-2xl border border-[#E5E7EB] bg-white px-6 py-3 font-bold text-[#374151]"
              >
                رجوع بدون حفظ
              </button>

              {canDelete && onDelete && (
                <button
                  type="button"
                  onClick={() => onDelete(localAccident.id)}
                  className="rounded-2xl bg-rose-600 px-6 py-3 font-bold text-white"
                >
                  حذف الحادث
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function NotificationPanel({
  open,
  renewals,
  onClose,
  onOpenRenewals,
  onOpenSubscriber,
}: {
  open: boolean;
  renewals: Subscriber[];
  onClose: () => void;
  onOpenRenewals: () => void;
  onOpenSubscriber: (subscriber: Subscriber) => void;
}) {
  if (!open) return null;

  return (
    <>
      <button
        type="button"
        onClick={onClose}
        className="fixed inset-0 z-40 cursor-default bg-transparent"
        aria-label="Close notifications"
      />

      <div
        dir="rtl"
        className="fixed right-[82px] top-[96px] z-50 w-[min(390px,calc(100vw-48px))] overflow-hidden rounded-[28px] border border-[#EAECEF] bg-white shadow-2xl"
      >
        <div className="border-b border-[#EEF1F4] px-5 py-4">
          <div className="flex items-center justify-between">
            <h3 className="text-[18px] font-bold text-[#1F2937]">التنبيهات</h3>

            <button
              type="button"
              onClick={onClose}
              className="rounded-full p-2 text-[#707A84] hover:bg-gray-100"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <p className="mt-1 text-[13px] text-[#707A84]">
            عندك {renewals.length} تأمينات بتنتهي هذا الشهر
          </p>
        </div>

        <div className="max-h-[420px] overflow-y-auto">
          {renewals.length === 0 ? (
            <div className="px-5 py-10 text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[#EFF4FF]">
                <Bell className="h-6 w-6 text-[#3B82F6]" />
              </div>
              <p className="text-[14px] font-semibold text-[#1F2937]">
                لا يوجد تأمينات للتجديد هذا الشهر
              </p>
            </div>
          ) : (
            renewals.slice(0, 10).map((subscriber) => (
              <button
                key={subscriber.id}
                type="button"
                onClick={() => onOpenSubscriber(subscriber)}
                className="block w-full border-b border-[#F1F5F9] px-5 py-4 text-right transition last:border-none hover:bg-[#F8FAFC]"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-[14px] font-bold text-[#1F2937]">
                      {subscriber.subscriberName || "بدون اسم"}
                    </p>
                    <p className="mt-1 truncate text-[12px] text-[#707A84]">
                      {subscriber.carName} - {subscriber.carNumber}
                    </p>
                    <p className="mt-1 truncate text-[12px] text-[#707A84]">
                      {subscriber.insuranceCompany}
                    </p>
                  </div>

                  <span className="shrink-0 rounded-full bg-rose-50 px-3 py-1 text-[11px] font-bold text-rose-600">
                    {subscriber.endDate}
                  </span>
                </div>
              </button>
            ))
          )}
        </div>

        {renewals.length > 0 && (
          <div className="border-t border-[#EEF1F4] p-4">
            <button
              type="button"
              onClick={onOpenRenewals}
              className="w-full rounded-2xl bg-[#3B82F6] px-4 py-3 text-[14px] font-bold text-white transition hover:opacity-90"
            >
              عرض كل تجديدات هذا الشهر
            </button>
          </div>
        )}
      </div>
    </>
  );
}

function DocumentPreviewBox({ label, url }: { label: string; url: string }) {
  const isImage =
    url.startsWith("blob:") ||
    url.match(/\.(jpg|jpeg|png|gif|webp|bmp|svg)$/i);

  return (
    <div className="rounded-3xl border border-[#E5E7EB] bg-white p-4">
      <div className="mb-3 flex items-center justify-between">
        <h4 className="text-[16px] font-semibold text-[#1F2937]">{label}</h4>

        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          className="rounded-xl bg-[#3B82F6] px-4 py-2 text-[13px] font-semibold text-white"
        >
          فتح
        </a>
      </div>

      {isImage ? (
        <img
          src={url}
          alt={label}
          className="max-h-[360px] w-full rounded-2xl object-contain"
        />
      ) : (
        <iframe
          src={url}
          className="h-[360px] w-full rounded-2xl border"
          title={label}
        />
      )}
    </div>
  );
}

function DocumentsModal({
  subscriber,
  onClose,
}: {
  subscriber: Subscriber;
  onClose: () => void;
}) {
  useModalA11y(true, onClose);
  const documentsList = [
    {
      label: "صورة وثيقة التأمين",
      url: subscriber.policyImage,
    },
    ...(Object.keys(documentLabels) as DocumentKey[]).map((key) => ({
      label: documentLabels[key],
      url: subscriber.documents?.[key],
    })),
  ].filter((item) => item.url);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-6">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="documents-modal-title"
        className="relative max-h-[90vh] w-full max-w-6xl overflow-y-auto rounded-3xl bg-[#F7F8FA] p-6 shadow-2xl"
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="إغلاق"
          className="absolute left-5 top-5 z-10 rounded-full bg-white p-2 shadow hover:bg-gray-100"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="mb-6 pr-2">
          <h3 id="documents-modal-title" className="text-2xl font-bold text-[#1F2937]">
            مستندات {subscriber.subscriberName}
          </h3>
          <p className="mt-1 text-sm text-[#707A84]">
            رخصة القيادة، وثائق التأمين، والمستندات الأخرى
          </p>
        </div>

        {documentsList.length === 0 ? (
          <div className="rounded-3xl bg-white p-10 text-center text-[#707A84]">
            لا توجد مستندات لهذا المشترك
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            {documentsList.map((doc) => (
              <DocumentPreviewBox key={doc.label} label={doc.label} url={doc.url} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

type DuplicateEntryUI = {
  customerId: number;
  customerName: string;
  phone: string | null;
  carNumber: string;
  insuranceCount: number;
  createdAt: string | null;
};

type DuplicateGroupUI = {
  carNumber: string;
  keepCustomerId: number;
  entries: DuplicateEntryUI[];
};

function DuplicatesModal({ onClose, onCleaned }: { onClose: () => void; onCleaned: () => void }) {
  useModalA11y(true, onClose);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [groups, setGroups] = useState<DuplicateGroupUI[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/customers/duplicates");
      if (!res.ok) throw new Error();
      const data = await res.json();
      setGroups(Array.isArray(data.groups) ? data.groups : []);
    } catch {
      setError("تعذّر تحميل قائمة المكررات");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const totalExtras = groups.reduce((sum, group) => sum + (group.entries.length - 1), 0);

  async function cleanup() {
    if (busy || totalExtras === 0) return;
    const ok = confirm(
      `سيتم الإبقاء على مشترك واحد لكل رقم سيارة وأرشفة ${totalExtras} مشترك مكرر.\nيمكنك استعادتهم لاحقًا من "العملاء المؤرشفون". هل تريد المتابعة؟`
    );
    if (!ok) return;
    setBusy(true);
    try {
      const res = await fetch("/api/customers/duplicates", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "");
      alert(`تم أرشفة ${data.archived || 0} مشترك مكرر.`);
      onCleaned();
      onClose();
    } catch (e) {
      alert(e instanceof Error && e.message ? e.message : "تعذّر تنظيف المكررات");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-6">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="duplicates-modal-title"
        className="relative flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-3xl bg-[#F7F8FA] shadow-2xl"
      >
        <div className="flex items-start justify-between gap-3 border-b border-[#EAECEF] bg-white px-6 py-5">
          <div>
            <h3 id="duplicates-modal-title" className="text-xl font-bold text-[#1F2937]">
              المشتركون المكرّرون (حسب رقم السيارة)
            </h3>
            <p className="mt-1 text-sm text-[#707A84]">
              يُبقى على السجل الأكثر اكتمالاً لكل رقم سيارة، وتُؤرشف الباقي (يمكن استعادتها).
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="إغلاق"
            className="rounded-full bg-[#F1F5F9] p-2 text-[#475569] hover:bg-[#E2E8F0]"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center py-16 text-[#707A84]">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : error ? (
            <div className="rounded-2xl bg-rose-50 p-6 text-center text-sm font-bold text-rose-600">
              {error}
              <button onClick={load} className="mt-3 block w-full rounded-xl bg-white py-2 text-[#1F2937]">
                إعادة المحاولة
              </button>
            </div>
          ) : groups.length === 0 ? (
            <div className="rounded-2xl bg-white p-10 text-center text-[#707A84]">
              لا يوجد مشتركون مكرّرون. كل أرقام السيارات فريدة.
            </div>
          ) : (
            <div className="space-y-4">
              {groups.map((group) => (
                <div
                  key={`${group.carNumber}-${group.keepCustomerId}`}
                  className="rounded-2xl border border-[#EAECEF] bg-white p-4"
                >
                  <div className="mb-3 flex items-center gap-2">
                    <Car className="h-4 w-4 text-[#3B82F6]" />
                    <span className="font-mono text-sm font-bold text-[#1F2937]" dir="ltr">
                      {group.carNumber}
                    </span>
                    <span className="rounded-full bg-[#FEF3C7] px-2 py-0.5 text-[11px] font-bold text-[#B45309]">
                      {group.entries.length} سجلات
                    </span>
                  </div>
                  <div className="space-y-2">
                    {group.entries.map((entry) => {
                      const keep = entry.customerId === group.keepCustomerId;
                      return (
                        <div
                          key={entry.customerId}
                          className={`flex flex-wrap items-center justify-between gap-2 rounded-xl px-3 py-2 text-sm ${keep ? "bg-emerald-50" : "bg-rose-50/70"}`}
                        >
                          <div className="min-w-0">
                            <p className="font-bold text-[#1F2937]">{entry.customerName || "بدون اسم"}</p>
                            <p className="text-xs text-[#707A84]" dir="ltr">
                              {entry.phone || "—"} · {entry.insuranceCount} تأمين · {dmyFromValue(entry.createdAt || "") || "—"}
                            </p>
                          </div>
                          <span
                            className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold ${keep ? "bg-emerald-600 text-white" : "bg-rose-100 text-rose-700"}`}
                          >
                            {keep ? "يبقى" : "سيُؤرشف"}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-[#EAECEF] bg-white px-6 py-4">
          <span className="text-sm text-[#707A84]">
            {groups.length > 0 ? `${totalExtras} سجل مكرر سيُؤرشف` : ""}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-[#E5E7EB] bg-white px-5 py-2.5 text-sm font-bold text-[#475569] hover:bg-[#F8FAFC]"
            >
              إغلاق
            </button>
            <button
              type="button"
              onClick={cleanup}
              disabled={busy || totalExtras === 0}
              className="rounded-xl bg-rose-600 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-rose-700 disabled:opacity-50"
            >
              {busy ? "جارِ الأرشفة…" : "أرشفة المكرر (إبقاء واحد)"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}



function CustomerHistoryModal({
  subscriber,
  subscribers,
  onClose,
  onViewDocuments,
  canEdit,
}: {
  subscriber: Subscriber;
  subscribers: Subscriber[];
  onClose: () => void;
  onViewDocuments: (subscriber: Subscriber) => void;
  canEdit: boolean;
}) {
  const customerHistory = subscribers
    .filter((item) => Number(item.customerId) === Number(subscriber.customerId))
    .sort((a, b) => String(b.startDate || "").localeCompare(String(a.startDate || "")));

  const totalPaid = customerHistory.reduce(
    (sum, item) => sum + numberValue(item.paidAmount),
    0
  );

  const totalRemaining = customerHistory.reduce(
    (sum, item) => sum + numberValue(item.remainingAmount),
    0
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-6">
      <div className="relative max-h-[90vh] w-full max-w-6xl overflow-y-auto rounded-3xl bg-[#F7F8FA] p-6 shadow-2xl">
        <button
          onClick={onClose}
          className="absolute left-5 top-5 z-10 rounded-full bg-white p-2 shadow hover:bg-gray-100"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="rounded-3xl border border-[#E5E7EB] bg-white p-6">
          <h3 className="text-2xl font-bold text-[#1F2937]">
            سجل المشترك: {subscriber.subscriberName || "بدون اسم"}
          </h3>
          <p className="mt-2 text-sm text-[#707A84]" dir="ltr">
            {subscriber.customerNumber || "بدون هاتف"}
          </p>

          <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-4">
            <div className="rounded-2xl bg-[#FAFAFA] p-4">
              <p className="text-sm text-[#8B95A1]">عدد التأمينات</p>
              <p className="mt-2 text-2xl font-bold text-[#1F2937]">{customerHistory.length}</p>
            </div>
            <div className="rounded-2xl bg-[#FAFAFA] p-4">
              <p className="text-sm text-[#8B95A1]">آخر حالة</p>
              <p className="mt-2 text-2xl font-bold text-[#1F2937]">{subscriber.insuranceStatus}</p>
            </div>
            <div className="rounded-2xl bg-[#FAFAFA] p-4">
              <p className="text-sm text-[#8B95A1]">إجمالي المدفوع</p>
              <p className="mt-2 text-2xl font-bold text-emerald-700">{formatMoney(totalPaid)}</p>
            </div>
            <div className="rounded-2xl bg-[#FAFAFA] p-4">
              <p className="text-sm text-[#8B95A1]">إجمالي المتبقي</p>
              <p className="mt-2 text-2xl font-bold text-rose-600">{formatMoney(totalRemaining)}</p>
            </div>
          </div>
        </div>

        <div className="mt-5 rounded-3xl border border-[#E5E7EB] bg-white p-6">
          <h4 className="text-xl font-bold text-[#1F2937]">كل التأمينات المرتبطة بهذا الزبون</h4>

          <div className="mt-5 overflow-x-auto">
            <table className="min-w-[980px] w-full text-right text-sm">
              <thead>
                <tr className="border-b border-[#EEF1F4] text-[#8B95A1]">
                  <th className="px-4 py-3">السيارة</th>
                  <th className="px-4 py-3">رقم السيارة</th>
                  <th className="px-4 py-3">نوع التأمين</th>
                  <th className="px-4 py-3">الشركة</th>
                  <th className="px-4 py-3">البداية</th>
                  <th className="px-4 py-3">النهاية</th>
                  <th className="px-4 py-3">الحالة</th>
                  <th className="px-4 py-3">الدفع</th>
                  <th className="px-4 py-3">وثائق</th>
                </tr>
              </thead>
              <tbody>
                {customerHistory.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-6 py-10 text-center text-[#707A84]">
                      لا يوجد سجل لهذا المشترك
                    </td>
                  </tr>
                ) : (
                  customerHistory.map((item) => (
                    <tr key={item.id} className="border-b border-[#F1F5F9] last:border-none">
                      <td className="px-4 py-4 font-semibold text-[#1F2937]">{item.carName || "-"}</td>
                      <td className="px-4 py-4 text-[#4B5563]">{item.carNumber || "-"}</td>
                      <td className="px-4 py-4 text-[#4B5563]">{item.insuranceType || "-"}</td>
                      <td className="px-4 py-4 text-[#4B5563]">{item.insuranceCompany || "-"}</td>
                      <td className="px-4 py-4 text-[#4B5563]">{item.startDate || "-"}</td>
                      <td className="px-4 py-4 text-[#4B5563]">{item.endDate || "-"}</td>
                      <td className="px-4 py-4">
                        <span className={`rounded-full px-3 py-1 text-xs font-bold ${statusColor(item.insuranceStatus)}`}>
                          {item.insuranceStatus}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <span className={`rounded-full px-3 py-1 text-xs font-bold ${paymentStatusColor(item.paymentStatus)}`}>
                          {item.paymentStatus}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <button
                          type="button"
                          onClick={() => onViewDocuments(item)}
                          className="rounded-xl border border-[#E5E7EB] bg-white px-4 py-2 text-xs font-bold text-[#3B82F6] hover:bg-[#EFF4FF]"
                        >
                          عرض الوثائق
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <CustomerSummaryPanel customerId={Number(subscriber.customerId)} />

        <CustomerTimelinePanel
          customerId={Number(subscriber.customerId)}
          canEdit={canEdit}
        />
      </div>
    </div>
  );
}

function SubscriberHistoryDashboard({
  subscribers,
  loading,
  onOpenHistory,
}: {
  subscribers: Subscriber[];
  loading: boolean;
  onOpenHistory: (subscriber: Subscriber) => void;
}) {
  const [query, setQuery] = useState("");

  const customerRows = useMemo(() => {
    const map = new Map<number, Subscriber[]>();

    subscribers.forEach((subscriber) => {
      const key = Number(subscriber.customerId);
      map.set(key, [...(map.get(key) || []), subscriber]);
    });

    return Array.from(map.values()).map((items) => {
      const sorted = [...items].sort((a, b) => String(b.endDate || "").localeCompare(String(a.endDate || "")));
      const latest = sorted[0];

      return {
        latest,
        count: items.length,
        activeCount: items.filter((item) => item.insuranceStatus === "فعال").length,
        expiredCount: items.filter((item) => item.insuranceStatus === "منتهي" || item.insuranceStatus === "غير فعال").length,
      };
    });
  }, [subscribers]);

  const filteredRows = customerRows.filter((row) => {
    const term = normalizeSearchText(query);
    const compactTerm = compactSearchText(query);
    if (!term && !compactTerm) return true;

    const text = normalizeSearchText([
      row.latest.subscriberName,
      row.latest.customerNumber,
      row.latest.carName,
      row.latest.carNumber,
      row.latest.insuranceCompany,
      row.latest.insuranceType,
    ].join(" "));

    const compactText = compactSearchText(text);

    return text.includes(term) || (!!compactTerm && compactText.includes(compactTerm));
  });

  return (
    <section className="mt-8 rounded-[28px] border border-[#EAECEF] bg-white shadow-sm">
      <div className="border-b border-[#EEF1F4] px-6 py-5">
        <h3 className="text-[22px] font-bold text-[#1F2937]">سجل المشتركين</h3>
        <p className="mt-1 text-[14px] text-[#707A84]">
          ابحث عن أي زبون واعرض كل التأمينات السابقة والحالية المرتبطة به
        </p>

        <div className="relative mt-5 max-w-xl">
          <Search className="absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#A7B0B8]" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="h-12 w-full rounded-2xl border border-[#E5E7EB] bg-white px-4 pr-11 text-[14px] outline-none focus:border-[#3B82F6]"
            placeholder="بحث باسم الزبون، الهاتف، رقم السيارة..."
          />
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-[980px] w-full text-right text-sm">
          <thead>
            <tr className="border-b border-[#EEF1F4] text-[#8B95A1]">
              <th className="px-5 py-4">اسم الزبون</th>
              <th className="px-5 py-4">الهاتف</th>
              <th className="px-5 py-4">آخر سيارة</th>
              <th className="px-5 py-4">آخر شركة</th>
              <th className="px-5 py-4">عدد التأمينات</th>
              <th className="px-5 py-4">فعال</th>
              <th className="px-5 py-4">منتهي</th>
              <th className="px-5 py-4">إجراء</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={8} className="px-6 py-12 text-center text-[#707A84]">
                  جاري تحميل السجل...
                </td>
              </tr>
            ) : filteredRows.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-6 py-12 text-center text-[#707A84]">
                  لا يوجد نتائج
                </td>
              </tr>
            ) : (
              filteredRows.map((row) => (
                <tr key={row.latest.customerId} className="border-b border-[#F1F5F9] last:border-none hover:bg-[#F8FAFC]">
                  <td className="px-5 py-4 font-bold text-[#1F2937]">{row.latest.subscriberName || "بدون اسم"}</td>
                  <td className="px-5 py-4 text-[#4B5563]" dir="ltr">{row.latest.customerNumber || "-"}</td>
                  <td className="px-5 py-4 text-[#4B5563]">{row.latest.carName || "-"} - {row.latest.carNumber || "-"}</td>
                  <td className="px-5 py-4 text-[#4B5563]">{row.latest.insuranceCompany || "-"}</td>
                  <td className="px-5 py-4 font-bold text-[#1F2937]">{row.count}</td>
                  <td className="px-5 py-4 text-emerald-700 font-bold">{row.activeCount}</td>
                  <td className="px-5 py-4 text-rose-600 font-bold">{row.expiredCount}</td>
                  <td className="px-5 py-4">
                    <button
                      type="button"
                      onClick={() => onOpenHistory(row.latest)}
                      className="rounded-xl bg-[#3B82F6] px-4 py-2 text-xs font-bold text-white hover:opacity-90"
                    >
                      عرض السجل
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}


function ActiveCustomersDashboard({
  subscribers,
  labels,
  loading,
  onOpenHistory,
}: {
  subscribers: Subscriber[];
  labels: CrmVocabulary;
  loading: boolean;
  onOpenHistory: (subscriber: Subscriber) => void;
}) {
  const [query, setQuery] = useState("");

  const rows = useMemo(() => {
    const map = new Map<number, Subscriber[]>();

    subscribers
      .filter((subscriber) => subscriber.insuranceStatus === "فعال")
      .forEach((subscriber) => {
        const key = Number(subscriber.customerId);
        map.set(key, [...(map.get(key) || []), subscriber]);
      });

    return Array.from(map.values())
      .map((items) => {
        const sorted = [...items].sort((a, b) =>
          String(b.endDate || "").localeCompare(String(a.endDate || ""))
        );

        const latest = sorted[0];

        return {
          latest,
          activeInsuranceCount: items.length,
          carsText: Array.from(
            new Set(items.map((item) => `${item.carName || "-"} - ${item.carNumber || "-"}`))
          ).join(" / "),
        };
      })
      // Newest-added clients first so the most recently added appears on top.
      .sort((a, b) => Number(b.latest.customerId) - Number(a.latest.customerId));
  }, [subscribers]);

  const filteredRows = rows.filter((row) => {
    const term = normalizeSearchText(query);
    const compactTerm = compactSearchText(query);
    if (!term && !compactTerm) return true;

    const text = normalizeSearchText([
      row.latest.subscriberName,
      row.latest.customerNumber,
      row.carsText,
      row.latest.insuranceCompany,
      row.latest.insuranceType,
    ].join(" "));

    const compactText = compactSearchText(text);

    return text.includes(term) || (!!compactTerm && compactText.includes(compactTerm));
  });

  return (
    <section className="mt-8 rounded-[28px] border border-[#EAECEF] bg-white shadow-sm">
      <div className="border-b border-[#EEF1F4] px-6 py-5">
        <h3 className="text-[22px] font-bold text-[#1F2937]">{labels.activeCustomersTitle}</h3>
        <p className="mt-1 text-[14px] text-[#707A84]">
          {labels.activeCustomersSubtitle}
        </p>

        <div className="relative mt-5 max-w-xl">
          <Search className="absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#A7B0B8]" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="h-12 w-full rounded-2xl border border-[#E5E7EB] bg-white px-4 pr-11 text-[14px] outline-none focus:border-[#3B82F6]"
            placeholder={labels.activeCustomersSearch}
          />
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-[980px] w-full text-right text-sm">
          <thead>
            <tr className="border-b border-[#EEF1F4] text-[#8B95A1]">
              <th className="px-5 py-4">اسم الزبون</th>
              <th className="px-5 py-4">الهاتف</th>
              <th className="px-5 py-4">تاريخ الإضافة</th>
              <th className="px-5 py-4">السيارات الفعالة</th>
              <th className="px-5 py-4">آخر شركة</th>
              <th className="px-5 py-4">عدد التأمينات الفعالة</th>
              <th className="px-5 py-4">إجراء</th>
            </tr>
          </thead>

          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} className="px-6 py-12 text-center text-[#707A84]">
                  جاري تحميل المشتركين الفعالين...
                </td>
              </tr>
            ) : filteredRows.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-6 py-12 text-center text-[#707A84]">
                  لا يوجد مشتركين فعالين
                </td>
              </tr>
            ) : (
              filteredRows.map((row) => (
                <tr key={row.latest.customerId} className="border-b border-[#F1F5F9] last:border-none hover:bg-[#F8FAFC]">
                  <td className="px-5 py-4 font-bold text-[#1F2937]">{row.latest.subscriberName || "بدون اسم"}</td>
                  <td className="px-5 py-4 text-[#4B5563]" dir="ltr">{row.latest.customerNumber || "-"}</td>
                  <td className="px-5 py-4 text-[#4B5563]" dir="ltr">{row.latest.dateAdded || "-"}</td>
                  <td className="px-5 py-4 text-[#4B5563]">{row.carsText || "-"}</td>
                  <td className="px-5 py-4 text-[#4B5563]">{row.latest.insuranceCompany || "-"}</td>
                  <td className="px-5 py-4 font-bold text-emerald-700">{row.activeInsuranceCount}</td>
                  <td className="px-5 py-4">
                    <button
                      type="button"
                      onClick={() => onOpenHistory(row.latest)}
                      className="rounded-xl bg-[#3B82F6] px-4 py-2 text-xs font-bold text-white hover:opacity-90"
                    >
                      عرض السجل
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}


function RenewalsTable({
  data,
  loading,
  onRenew,
  onTerminate,
  onOpenHistory,
  onViewDocuments,
  isRenewed,
}: {
  data: Subscriber[];
  loading: boolean;
  onRenew: (subscriber: Subscriber) => void;
  onTerminate: (subscriber: Subscriber) => void;
  onOpenHistory: (subscriber: Subscriber) => void;
  onViewDocuments: (subscriber: Subscriber) => void;
  isRenewed: (subscriber: Subscriber) => boolean;
}) {
  return (
    <section className="mt-8 rounded-[28px] border border-[#EAECEF] bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-[#EEF1F4] px-5 py-4">
        <div>
          <h3 className="text-[18px] font-semibold text-[#1F2937]">التأمينات التي تحتاج تجديد هذا الشهر</h3>
          <p className="mt-1 text-[13px] text-[#707A84]">
            {loading ? "جاري تحميل البيانات..." : `عدد السجلات: ${data.length}`}
          </p>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-[1100px] w-full text-right text-sm">
          <thead>
            <tr className="border-b border-[#EEF1F4] text-[#8B95A1]">
              <th className="px-5 py-4">الاسم</th>
              <th className="px-5 py-4">الهاتف</th>
              <th className="px-5 py-4">السيارة</th>
              <th className="px-5 py-4">الشركة</th>
              <th className="px-5 py-4">تاريخ الانتهاء</th>
              <th className="px-5 py-4">الحالة</th>
              <th className="px-5 py-4">السجل</th>
              <th className="px-5 py-4">وثائق</th>
              <th className="px-5 py-4">إجراءات التجديد</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={9} className="px-6 py-12 text-center text-[#707A84]">
                  جاري تحميل التجديدات...
                </td>
              </tr>
            ) : data.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-6 py-12 text-center text-[#707A84]">
                  لا يوجد تأمينات تحتاج تجديد هذا الشهر
                </td>
              </tr>
            ) : (
              data.map((row) => (
                <tr key={row.id} className="border-b border-[#F1F5F9] last:border-none hover:bg-[#F8FAFC]">
                  <td className="px-5 py-4 font-bold text-[#1F2937]">{row.subscriberName}</td>
                  <td className="px-5 py-4 text-[#4B5563]" dir="ltr">{row.customerNumber || "-"}</td>
                  <td className="px-5 py-4 text-[#4B5563]">{row.carName} - {row.carNumber}</td>
                  <td className="px-5 py-4 text-[#4B5563]">{row.insuranceCompany}</td>
                  <td className="px-5 py-4 font-bold text-rose-600">{row.endDate}</td>
                  <td className="px-5 py-4">
                    <span className={`rounded-full px-3 py-1 text-xs font-bold ${statusColor(row.insuranceStatus)}`}>
                      {row.insuranceStatus}
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    <button
                      type="button"
                      onClick={() => onOpenHistory(row)}
                      className="rounded-xl border border-[#E5E7EB] bg-white px-4 py-2 text-xs font-bold text-[#3B82F6] hover:bg-[#EFF4FF]"
                    >
                      عرض السجل
                    </button>
                  </td>
                  <td className="px-5 py-4">
                    <button
                      type="button"
                      onClick={() => onViewDocuments(row)}
                      className="rounded-xl border border-[#E5E7EB] bg-white px-4 py-2 text-xs font-bold text-[#3B82F6] hover:bg-[#EFF4FF]"
                    >
                      عرض الوثائق
                    </button>
                  </td>
                  <td className="px-5 py-4">
                    {isRenewed(row) ? (
                      <span className="inline-flex rounded-xl bg-emerald-50 px-4 py-2 text-xs font-bold text-emerald-700">
                        تم تجديده
                      </span>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => onRenew(row)}
                          className="rounded-xl bg-[#3B82F6] px-4 py-2 text-xs font-bold text-white hover:opacity-90"
                        >
                          تجديد
                        </button>
                        <button
                          type="button"
                          onClick={() => onTerminate(row)}
                          className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-xs font-bold text-rose-700 hover:bg-rose-100"
                        >
                          إنهاء الاشتراك
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}


function AccountingCard({
  label,
  value,
  helper,
}: {
  label: string;
  value: string;
  helper: string;
}) {
  return (
    <div className="rounded-[26px] border border-[#EAECEF] bg-white p-5 shadow-sm">
      <p className="text-sm text-[#707A84]">{label}</p>
      <p className="mt-3 text-3xl font-bold text-[#1F2937]">{value}</p>
      <p className="mt-2 text-xs font-semibold text-[#3B82F6]">{helper}</p>
    </div>
  );
}

function AccountingDashboard({
  subscribers,
  loading,
  onEdit,
  canExport,
}: {
  subscribers: Subscriber[];
  loading: boolean;
  onEdit: (subscriber: Subscriber) => void;
  canExport?: boolean;
}) {
  const [paymentFilter, setPaymentFilter] = useState<
    "all" | "paid" | "partial" | "unpaid" | "checks" | "remaining"
  >("all");

  const [query, setQuery] = useState("");

  const totalRequired = subscribers.reduce(
    (sum, subscriber) => sum + numberValue(subscriber.totalAmount),
    0
  );

  const totalPaid = subscribers.reduce(
    (sum, subscriber) => sum + numberValue(subscriber.paidAmount),
    0
  );

  const totalRemaining = subscribers.reduce(
    (sum, subscriber) => sum + numberValue(subscriber.remainingAmount),
    0
  );

  const paidCount = subscribers.filter(
    (subscriber) => subscriber.paymentStatus === "مدفوع كامل"
  ).length;

  const partialCount = subscribers.filter(
    (subscriber) => subscriber.paymentStatus === "مدفوع جزئي"
  ).length;

  const unpaidCount = subscribers.filter(
    (subscriber) =>
      subscriber.paymentStatus === "غير مدفوع" ||
      numberValue(subscriber.paidAmount) <= 0
  ).length;

  const checksTotal = subscribers
    .flatMap((subscriber) => subscriber.checks || [])
    .reduce((sum, check) => sum + numberValue(check.amount), 0);

  const filteredRows = subscribers.filter((subscriber) => {
    const searchText = [
      subscriber.subscriberName,
      subscriber.customerNumber,
      subscriber.carName,
      subscriber.carNumber,
      subscriber.insuranceType,
      subscriber.insuranceCompany,
      subscriber.paymentStatus,
      subscriber.paidStatus,
      ...(subscriber.checks || []).map(
        (check) => `${check.checkNumber} ${check.bankName} ${check.dueDate}`
      ),
    ]
      .join(" ")
      .toLowerCase();

    const matchesSearch = query.trim()
      ? searchText.includes(query.trim().toLowerCase())
      : true;

    const matchesFilter =
      paymentFilter === "all"
        ? true
        : paymentFilter === "paid"
        ? subscriber.paymentStatus === "مدفوع كامل"
        : paymentFilter === "partial"
        ? subscriber.paymentStatus === "مدفوع جزئي"
        : paymentFilter === "unpaid"
        ? subscriber.paymentStatus === "غير مدفوع" ||
          numberValue(subscriber.paidAmount) <= 0
        : paymentFilter === "checks"
        ? subscriber.paidStatus === "شيكات"
        : numberValue(subscriber.remainingAmount) > 0;

    return matchesSearch && matchesFilter;
  });

  const inputClass =
    "h-12 rounded-2xl border border-[#E5E7EB] bg-white px-4 text-[14px] text-[#1F2937] outline-none focus:border-[#3B82F6]";

  return (
    <section className="mt-8 space-y-6">
      <div className="rounded-[28px] border border-[#EAECEF] bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h3 className="text-[24px] font-bold text-[#1F2937]">
              الحسابات والجباية
            </h3>
            <p className="mt-1 text-[14px] text-[#707A84]">
              متابعة كل المدفوعات، المتبقي، الشيكات، وحالة الجباية لكل مشترك
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {canExport && (
              <button
                type="button"
                onClick={() => {
                  window.location.href = "/api/customers/export";
                }}
                className="rounded-2xl border border-[#3B82F6] bg-white px-4 py-2 text-[13px] font-bold text-[#3B82F6] hover:bg-[#EFF4FF]"
              >
                تصدير CSV
              </button>
            )}
            <span className="rounded-full bg-[#EFF4FF] px-4 py-2 text-[13px] font-bold text-[#3B82F6]">
              {subscribers.length} مشترك
            </span>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-4">
          <AccountingCard
            label="إجمالي المطلوب"
            value={formatMoney(totalRequired)}
            helper="مجموع كل التأمينات"
          />
          <AccountingCard
            label="إجمالي المدفوع"
            value={formatMoney(totalPaid)}
            helper={`${paidCount} دفعوا كامل`}
          />
          <AccountingCard
            label="إجمالي المتبقي"
            value={formatMoney(totalRemaining)}
            helper={`${partialCount + unpaidCount} عليهم مبالغ`}
          />
          <AccountingCard
            label="قيمة الشيكات"
            value={formatMoney(checksTotal)}
            helper="مجموع الشيكات المسجلة"
          />
        </div>
      </div>

      <div className="rounded-[28px] border border-[#EAECEF] bg-white p-5 shadow-sm">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-[1fr_240px]">
          <div className="relative">
            <Search className="absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#A7B0B8]" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className={`${inputClass} w-full pr-11`}
              placeholder="بحث بالاسم، الهاتف، رقم السيارة، البنك، رقم الشيك..."
            />
          </div>

          <select
            value={paymentFilter}
            onChange={(e) =>
              setPaymentFilter(e.target.value as typeof paymentFilter)
            }
            className={`${inputClass} w-full`}
          >
            <option value="all">كل الحسابات</option>
            <option value="paid">دافع كامل</option>
            <option value="partial">دافع جزئي</option>
            <option value="unpaid">مش دافع</option>
            <option value="remaining">عليه متبقي</option>
            <option value="checks">دفع شيكات</option>
          </select>
        </div>
      </div>

      <div className="rounded-[28px] border border-[#EAECEF] bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-[#EEF1F4] px-5 py-4">
          <div>
            <h3 className="text-[18px] font-semibold text-[#1F2937]">
              تفاصيل الجباية
            </h3>
            <p className="mt-1 text-[13px] text-[#707A84]">
              {loading
                ? "جاري تحميل البيانات..."
                : `عدد النتائج: ${filteredRows.length}`}
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-[1280px] w-full text-right text-[12px]">
            <thead>
              <tr className="border-b border-[#EEF1F4] text-[#8B95A1]">
                <th className="px-4 py-3">المشترك</th>
                <th className="px-4 py-3">السيارة</th>
                <th className="px-4 py-3">نوع التأمين</th>
                <th className="px-4 py-3">حوفا</th>
                <th className="px-4 py-3">طرف ثالث</th>
                <th className="px-4 py-3">شامل</th>
                <th className="px-4 py-3">المجموع</th>
                <th className="px-4 py-3">المدفوع</th>
                <th className="px-4 py-3">المتبقي</th>
                <th className="px-4 py-3">حالة الدفع</th>
                <th className="px-4 py-3">طريقة الدفع</th>
                <th className="px-4 py-3">تفاصيل الشيكات</th>
                <th className="px-4 py-3">إجراء</th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={13} className="px-6 py-12 text-center text-[#707A84]">
                    جاري تحميل الحسابات...
                  </td>
                </tr>
              ) : filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={13} className="px-6 py-12 text-center text-[#707A84]">
                    لا توجد نتائج
                  </td>
                </tr>
              ) : (
                filteredRows.map((subscriber) => (
                  <tr
                    key={subscriber.id}
                    className="border-b border-[#F1F5F9] align-top last:border-none hover:bg-[#F8FAFC]"
                  >
                    <td className="px-4 py-4">
                      <p className="font-bold text-[#1F2937]">
                        {subscriber.subscriberName || "بدون اسم"}
                      </p>
                      <p className="mt-1 text-[11px] text-[#707A84]" dir="ltr">
                        {subscriber.customerNumber || "بدون هاتف"}
                      </p>
                    </td>

                    <td className="px-4 py-4">
                      <p className="font-semibold text-[#374151]">
                        {subscriber.carName || "-"}
                      </p>
                      <p className="mt-1 text-[11px] text-[#707A84]">
                        {subscriber.carNumber || "-"}
                      </p>
                    </td>

                    <td className="px-4 py-4">
                      <p>{subscriber.insuranceType}</p>
                      <p className="mt-1 text-[11px] text-[#707A84]">
                        {subscriber.insuranceCompany}
                      </p>
                    </td>

                    <td className="px-4 py-4">
                      {subscriber.hofaaEnabled ? (
                        <span className="font-bold text-[#1F2937]">
                          {formatMoney(subscriber.hofaaPrice)}
                        </span>
                      ) : (
                        <span className="text-[#A7B0B8]">-</span>
                      )}
                    </td>

                    <td className="px-4 py-4">
                      {subscriber.thirdPartyEnabled ? (
                        <span className="font-bold text-[#1F2937]">
                          {formatMoney(subscriber.thirdPartyPrice)}
                        </span>
                      ) : (
                        <span className="text-[#A7B0B8]">-</span>
                      )}
                    </td>

                    <td className="px-4 py-4">
                      {subscriber.fullEnabled ? (
                        <span className="font-bold text-[#1F2937]">
                          {formatMoney(subscriber.fullPrice)}
                        </span>
                      ) : (
                        <span className="text-[#A7B0B8]">-</span>
                      )}
                    </td>

                    <td className="px-4 py-4 font-bold">
                      {formatMoney(subscriber.totalAmount)}
                    </td>

                    <td className="px-4 py-4 font-bold text-emerald-700">
                      {formatMoney(subscriber.paidAmount)}
                    </td>

                    <td className="px-4 py-4 font-bold text-rose-600">
                      {formatMoney(subscriber.remainingAmount)}
                    </td>

                    <td className="px-4 py-4">
                      <span
                        className={`rounded-full px-3 py-1 text-[11px] font-bold ${paymentStatusColor(
                          subscriber.paymentStatus
                        )}`}
                      >
                        {subscriber.paymentStatus}
                      </span>
                    </td>

                    <td className="px-4 py-4">
                      <span
                        className={`rounded-full px-3 py-1 text-[11px] font-bold ${paidColor(
                          subscriber.paidStatus
                        )}`}
                      >
                        {subscriber.paidStatus}
                      </span>
                    </td>

                    <td className="px-4 py-4">
                      {subscriber.paidStatus === "شيكات" &&
                      subscriber.checks.length > 0 ? (
                        <div className="space-y-2">
                          {subscriber.checks.map((check, index) => (
                            <div
                              key={`${subscriber.id}-${index}`}
                              className="rounded-2xl border border-[#E5E7EB] bg-white p-3"
                            >
                              <p className="font-bold text-[#1F2937]" dir="ltr">
                                #{check.checkNumber || "-"}
                              </p>
                              <p className="mt-1 text-[11px] text-[#707A84]">
                                {check.bankName || "بدون بنك"} -{" "}
                                {check.dueDate || "بدون تاريخ"}
                              </p>
                              <p className="mt-1 text-[12px] font-bold text-[#3B82F6]">
                                {formatMoney(check.amount)}
                              </p>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <span className="text-[#A7B0B8]">لا يوجد شيكات</span>
                      )}
                    </td>

                    <td className="px-4 py-4">
                      <button
                        type="button"
                        onClick={() => onEdit(subscriber)}
                        className="rounded-xl border border-[#E5E7EB] bg-white px-4 py-2 text-[12px] font-bold text-blue-600 hover:bg-blue-50"
                      >
                        تعديل
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}


function ProfileDropdown({ user }: { user: AppUser | null }) {
  const [open, setOpen] = useState(false);
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [show2faForm, setShow2faForm] = useState(false);
  const [totpSetup, setTotpSetup] = useState<{ otpauthUrl: string } | null>(null);
  const [totpCode, setTotpCode] = useState("");
  const [totpMessage, setTotpMessage] = useState("");
  const [totpError, setTotpError] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordMessage, setPasswordMessage] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [passwordSaving, setPasswordSaving] = useState(false);

  const handleLogout = async () => {
    await fetch("/api/logout", { method: "POST" });
    window.location.href = "/login";
  };

  const displayName = user?.username || "مستخدم";

  const handlePasswordChange = async (event: React.FormEvent) => {
    event.preventDefault();
    setPasswordMessage("");
    setPasswordError("");

    if (newPassword.length < 8) {
      setPasswordError("كلمة المرور الجديدة يجب أن تكون 8 أحرف على الأقل");
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError("كلمة المرور الجديدة وتأكيدها غير متطابقين");
      return;
    }

    try {
      setPasswordSaving(true);

      const res = await fetch("/api/me/password", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setPasswordError(String(data.error || "فشل تغيير كلمة المرور"));
        return;
      }

      setPasswordMessage("تم تغيير كلمة المرور بنجاح");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setShowPasswordForm(false);
    } catch (error) {
      console.error("Password change error:", error);
      setPasswordError("صار خطأ أثناء تغيير كلمة المرور");
    } finally {
      setPasswordSaving(false);
    }
  };

  const handle2faSetup = async () => {
    setTotpMessage("");
    setTotpError("");
    const res = await fetch("/api/me/2fa/setup", { method: "POST" });
    const data = await res.json();
    if (!res.ok) {
      setTotpError(String(data.error || "فشل تفعيل 2FA"));
      return;
    }
    setTotpSetup({ otpauthUrl: String(data.otpauthUrl || "") });
    setShow2faForm(true);
  };

  const handle2faVerify = async (event: React.FormEvent) => {
    event.preventDefault();
    setTotpMessage("");
    setTotpError("");
    const res = await fetch("/api/me/2fa/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: totpCode }),
    });
    const data = await res.json();
    if (!res.ok) {
      setTotpError(String(data.error || "رمز غير صحيح"));
      return;
    }
    setTotpMessage("تم تفعيل المصادقة الثنائية");
    setTotpSetup(null);
    setTotpCode("");
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-300 text-sm font-bold text-[#1F2937] hover:ring-4 hover:ring-gray-100"
        title={displayName}
      >
        {displayName.slice(0, 1).toUpperCase()}
      </button>

      {open && (
        <>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-40 cursor-default bg-transparent"
            aria-label="close profile menu"
          />

          <div className="absolute right-0 top-12 z-50 w-64 overflow-hidden rounded-3xl border border-[#EAECEF] bg-white text-right shadow-2xl">
            <div className="border-b border-[#EEF1F4] p-4">
              <p className="text-sm text-[#707A84]">مسجل دخول باسم</p>
              <p className="mt-1 truncate font-bold text-[#1F2937]" dir="ltr">
                {displayName}
              </p>
              {user?.role === "master" && (
                <span className="mt-3 inline-block rounded-full bg-[#EFF4FF] px-3 py-1 text-xs font-bold text-[#3B82F6]">
                  Master User
                </span>
              )}
            </div>

            <div className="border-b border-[#EEF1F4] p-4">
              <button
                type="button"
                onClick={() => {
                  setShowPasswordForm((prev) => !prev);
                  setPasswordMessage("");
                  setPasswordError("");
                }}
                className="block w-full px-0 py-1 text-right text-sm font-bold text-[#3B82F6] hover:text-[#2563EB]"
              >
                {showPasswordForm ? "إخفاء تغيير كلمة المرور" : "تغيير كلمة المرور"}
              </button>

              {showPasswordForm && (
                <form onSubmit={handlePasswordChange} className="mt-3 space-y-3">
                  <div>
                    <label htmlFor="profile-current-password" className="mb-1 block text-xs text-[#707A84]">
                      كلمة المرور الحالية
                    </label>
                    <input
                      id="profile-current-password"
                      type="password"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      className="h-10 w-full rounded-xl border border-[#E5E7EB] px-3 text-sm outline-none focus:border-[#3B82F6]"
                      autoComplete="current-password"
                    />
                  </div>
                  <div>
                    <label htmlFor="profile-new-password" className="mb-1 block text-xs text-[#707A84]">
                      كلمة المرور الجديدة
                    </label>
                    <input
                      id="profile-new-password"
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="h-10 w-full rounded-xl border border-[#E5E7EB] px-3 text-sm outline-none focus:border-[#3B82F6]"
                      autoComplete="new-password"
                    />
                  </div>
                  <div>
                    <label htmlFor="profile-confirm-password" className="mb-1 block text-xs text-[#707A84]">
                      تأكيد كلمة المرور
                    </label>
                    <input
                      id="profile-confirm-password"
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="h-10 w-full rounded-xl border border-[#E5E7EB] px-3 text-sm outline-none focus:border-[#3B82F6]"
                      autoComplete="new-password"
                    />
                  </div>
                  {passwordError && (
                    <p className="text-xs font-bold text-rose-600">{passwordError}</p>
                  )}
                  {passwordMessage && (
                    <p className="text-xs font-bold text-[#3B82F6]">{passwordMessage}</p>
                  )}
                  <button
                    type="submit"
                    disabled={passwordSaving}
                    className="w-full rounded-xl bg-[#3B82F6] px-4 py-2 text-sm font-bold text-white disabled:opacity-60"
                  >
                    {passwordSaving ? "جاري الحفظ..." : "حفظ كلمة المرور"}
                  </button>
                </form>
              )}
            </div>

            <div className="border-b border-[#EEF1F4] p-4">
              <button
                type="button"
                onClick={() => {
                  setShow2faForm((prev) => !prev);
                  setTotpMessage("");
                  setTotpError("");
                }}
                className="block w-full px-0 py-1 text-right text-sm font-bold text-[#3B82F6] hover:text-[#2563EB]"
              >
                {show2faForm ? "إخفاء المصادقة الثنائية" : "المصادقة الثنائية (2FA)"}
              </button>

              {show2faForm && (
                <div className="mt-3 space-y-3">
                  {!totpSetup ? (
                    <button
                      type="button"
                      onClick={handle2faSetup}
                      className="w-full rounded-xl border border-[#3B82F6] px-4 py-2 text-sm font-bold text-[#3B82F6]"
                    >
                      بدء الإعداد
                    </button>
                  ) : (
                    <>
                      <p className="text-xs text-[#707A84]">امسح الرابط في Google Authenticator:</p>
                      <a
                        href={totpSetup.otpauthUrl}
                        className="block break-all text-xs text-[#3B82F6]"
                        dir="ltr"
                      >
                        {totpSetup.otpauthUrl}
                      </a>
                      <form onSubmit={handle2faVerify} className="space-y-2">
                        <input
                          value={totpCode}
                          onChange={(e) => setTotpCode(e.target.value)}
                          placeholder="123456"
                          className="h-10 w-full rounded-xl border border-[#E5E7EB] px-3 text-sm"
                          dir="ltr"
                          required
                        />
                        <button
                          type="submit"
                          className="w-full rounded-xl bg-[#3B82F6] px-4 py-2 text-sm font-bold text-white"
                        >
                          تأكيد التفعيل
                        </button>
                      </form>
                    </>
                  )}
                  {totpError && <p className="text-xs font-bold text-rose-600">{totpError}</p>}
                  {totpMessage && <p className="text-xs font-bold text-[#3B82F6]">{totpMessage}</p>}
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={handleLogout}
              className="block w-full px-4 py-4 text-right text-sm font-bold text-rose-600 hover:bg-rose-50"
            >
              تسجيل الخروج
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function defaultUserForm() {
  return {
    username: "",
    password: "",
    isActive: true,
    viewSubscribers: true,
    createSubscribers: false,
    editSubscribers: false,
    deleteSubscribers: false,
    viewAccidents: true,
    createAccidents: false,
    editAccidents: false,
    deleteAccidents: false,
    viewAccounting: false,
    editPayments: false,
    viewUsers: false,
    createUsers: false,
    editUsers: false,
    deleteUsers: false,
    viewActivityLog: false,
  };
}

function UsersManagementDashboard({ currentUser }: { currentUser: AppUser | null }) {
  const [users, setUsers] = useState<AppUser[]>([]);
  const [roleTemplates, setRoleTemplates] = useState<RoleTemplateRecord[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [editingUserId, setEditingUserId] = useState<number | null>(null);
  const [form, setForm] = useState<any>(defaultUserForm());

  const canManage = Boolean(currentUser?.viewUsers);
  const canCreate = Boolean(currentUser?.createUsers);
  const canEdit = Boolean(currentUser?.editUsers);
  const canDelete = Boolean(currentUser?.deleteUsers);

  const loadUsers = async () => {
    if (!canManage) return;
    setLoadingUsers(true);
    try {
      const res = await fetch("/api/users", { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to load users");
      const data = await res.json();
      setUsers(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Load users error:", error);
      alert("صار خطأ بتحميل المستخدمين");
    } finally {
      setLoadingUsers(false);
    }
  };

  const loadRoleTemplates = async () => {
    if (!canManage) return;
    try {
      const res = await fetch(ROLES_API_URL, { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      setRoleTemplates(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Load role templates error:", error);
    }
  };

  useEffect(() => {
    loadUsers();
    loadRoleTemplates();
  }, [canManage]);

  const applyTemplateToForm = (templateId: string) => {
    const template = roleTemplates.find((item) => String(item.id) === templateId);
    if (!template) return;
    setForm((prev: any) => ({ ...prev, ...template.permissions }));
  };

  const applyTemplateToUser = async (userId: number, templateId: string) => {
    if (!templateId) return;
    try {
      const res = await fetch(`${ROLES_API_URL}/${templateId}/apply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      if (!res.ok) throw new Error("Failed to apply template");
      await loadUsers();
      alert("تم تطبيق القالب على المستخدم");
    } catch (error) {
      console.error(error);
      alert("فشل تطبيق القالب");
    }
  };

  const startEdit = (user: AppUser) => {
    setEditingUserId(user.id);
    setForm({ ...defaultUserForm(), ...user, password: "" });
  };

  const resetForm = () => {
    setEditingUserId(null);
    setForm(defaultUserForm());
  };

  const saveUser = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!form.username.trim()) {
      alert("اكتب اسم المستخدم");
      return;
    }

    if (!editingUserId && !form.password.trim()) {
      alert("اكتب كلمة المرور");
      return;
    }

    try {
      const res = await fetch(editingUserId ? `/api/users/${editingUserId}` : "/api/users", {
        method: editingUserId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      if (!res.ok) throw new Error("Failed to save user");

      await loadUsers();
      resetForm();
    } catch (error) {
      console.error("Save user error:", error);
      alert("صار خطأ بحفظ المستخدم");
    }
  };

  const deleteUser = async (id: number) => {
    if (!confirm("متأكد بدك تحذف هذا المستخدم؟")) return;

    try {
      const res = await fetch(`/api/users/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete user");
      await loadUsers();
    } catch (error) {
      console.error("Delete user error:", error);
      alert("صار خطأ بحذف المستخدم");
    }
  };

  if (!canManage) {
    return (
      <div className="mt-8 rounded-3xl border border-rose-200 bg-rose-50 p-8 text-center font-bold text-rose-700">
        لا يوجد لديك صلاحية لعرض إدارة المستخدمين
      </div>
    );
  }

  const inputClass = "h-12 w-full rounded-2xl border border-[#E5E7EB] bg-white px-4 text-[14px] outline-none focus:border-[#3B82F6]";

  return (
    <section className="mt-8 space-y-6">
      <div className="rounded-[28px] border border-[#EAECEF] bg-white p-6 shadow-sm">
        <h3 className="text-2xl font-bold text-[#1F2937]">إدارة المستخدمين والصلاحيات</h3>
        <p className="mt-2 text-sm text-[#707A84]">
          المستخدم الرئيسي ayarasem@elite يستطيع إضافة مستخدمين والتحكم بكل الصلاحيات.
        </p>
      </div>

      {(canCreate || (editingUserId && canEdit)) && (
        <form onSubmit={saveUser} className="rounded-[28px] border border-[#EAECEF] bg-white p-6 shadow-sm">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div>
              <label className="mb-2 block text-sm font-bold">اسم المستخدم</label>
              <input
                value={form.username}
                onChange={(e) => setForm((prev: any) => ({ ...prev, username: e.target.value }))}
                className={inputClass}
                dir="ltr"
                placeholder="user@elite"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-bold">كلمة المرور</label>
              <input
                type="password"
                value={form.password}
                onChange={(e) => setForm((prev: any) => ({ ...prev, password: e.target.value }))}
                className={inputClass}
                dir="ltr"
                placeholder={editingUserId ? "اتركها فارغة إذا لا تريد تغييرها" : "Password"}
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-bold">حالة المستخدم</label>
              <select
                value={form.isActive ? "active" : "inactive"}
                onChange={(e) => setForm((prev: any) => ({ ...prev, isActive: e.target.value === "active" }))}
                className={inputClass}
              >
                <option value="active">فعال</option>
                <option value="inactive">غير فعال</option>
              </select>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-bold">تطبيق قالب صلاحيات على النموذج</label>
              <select
                defaultValue=""
                onChange={(e) => applyTemplateToForm(e.target.value)}
                className={inputClass}
              >
                <option value="">اختر قالب...</option>
                {roleTemplates.map((template) => (
                  <option key={template.id} value={template.id}>
                    {template.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-1 gap-3 md:grid-cols-3">
            {PERMISSION_FIELDS.map((permission) => (
              <label key={permission} className="flex cursor-pointer items-center gap-3 rounded-2xl border border-[#E5E7EB] bg-[#FAFAFA] p-3 text-sm font-semibold">
                <input
                  type="checkbox"
                  checked={Boolean(form[permission])}
                  onChange={(e) => setForm((prev: any) => ({ ...prev, [permission]: e.target.checked }))}
                />
                {permissionLabels[permission]}
              </label>
            ))}
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <button type="submit" className="rounded-2xl bg-[#3B82F6] px-8 py-3 font-bold text-white">
              {editingUserId ? "حفظ التعديل" : "إضافة المستخدم"}
            </button>
            {editingUserId && (
              <button type="button" onClick={resetForm} className="rounded-2xl border border-[#E5E7EB] bg-white px-8 py-3 font-bold text-[#374151]">
                إلغاء التعديل
              </button>
            )}
          </div>
        </form>
      )}

      <div className="rounded-[28px] border border-[#EAECEF] bg-white shadow-sm">
        <div className="border-b border-[#EEF1F4] px-6 py-5">
          <h3 className="text-xl font-bold">المستخدمون</h3>
          <p className="mt-1 text-sm text-[#707A84]">
            {loadingUsers ? "جاري التحميل..." : `عدد المستخدمين: ${users.length}`}
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-right text-sm">
            <thead>
              <tr className="border-b text-[#8B95A1]">
                <th className="px-6 py-4">المستخدم</th>
                <th className="px-6 py-4">الدور</th>
                <th className="px-6 py-4">الحالة</th>
                <th className="px-6 py-4">الصلاحيات</th>
                <th className="px-6 py-4">إجراءات</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id} className="border-b last:border-none">
                  <td className="px-6 py-4 font-bold" dir="ltr">{user.username}</td>
                  <td className="px-6 py-4">{user.role === "master" ? "Master" : "User"}</td>
                  <td className="px-6 py-4">
                    <span className={`rounded-full px-3 py-1 text-xs font-bold ${user.isActive ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>
                      {user.isActive ? "فعال" : "غير فعال"}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-xs text-[#707A84]">
                    {PERMISSION_FIELDS.filter((field) => Boolean(user[field])).length} صلاحية مفعلة
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-wrap gap-2">
                      {canEdit && user.role !== "master" && (
                        <select
                          defaultValue=""
                          onChange={(e) => {
                            applyTemplateToUser(user.id, e.target.value);
                            e.currentTarget.value = "";
                          }}
                          className="rounded-xl border border-[#E5E7EB] px-2 py-1 text-xs"
                        >
                          <option value="">قالب...</option>
                          {roleTemplates.map((template) => (
                            <option key={template.id} value={template.id}>
                              {template.name}
                            </option>
                          ))}
                        </select>
                      )}
                      {canEdit && (
                        <button onClick={() => startEdit(user)} className="rounded-xl border px-3 py-2 text-xs font-bold text-blue-600 hover:bg-blue-50">
                          تعديل
                        </button>
                      )}
                      {canDelete && user.role !== "master" && (
                        <button onClick={() => deleteUser(user.id)} className="rounded-xl border px-3 py-2 text-xs font-bold text-rose-600 hover:bg-rose-50">
                          حذف
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

function ActivityLogDashboard({ currentUser }: { currentUser: AppUser | null }) {
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);

  const canView = Boolean(currentUser?.viewActivityLog);

  const loadLogs = async () => {
    if (!canView) return;
    setLoadingLogs(true);
    try {
      const res = await fetch("/api/activity", { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to load logs");
      const data = await res.json();
      setLogs(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Load logs error:", error);
      alert("صار خطأ بتحميل سجل النشاطات");
    } finally {
      setLoadingLogs(false);
    }
  };

  useEffect(() => {
    loadLogs();
  }, [canView]);

  if (!canView) {
    return (
      <div className="mt-8 rounded-3xl border border-rose-200 bg-rose-50 p-8 text-center font-bold text-rose-700">
        لا يوجد لديك صلاحية لعرض سجل النشاطات
      </div>
    );
  }

  return (
    <>
      <section className="mt-8 rounded-[28px] border border-[#EAECEF] bg-white shadow-sm">
        <div className="border-b border-[#EEF1F4] px-6 py-5">
          <h3 className="text-2xl font-bold">سجل النشاطات</h3>
          <p className="mt-1 text-sm text-[#707A84]">
            {loadingLogs ? "جاري التحميل..." : `آخر ${logs.length} عملية`}
          </p>
        </div>

        <div className="divide-y divide-[#EEF1F4]">
          {logs.length === 0 ? (
            <div className="p-10 text-center text-[#707A84]">لا يوجد نشاطات بعد</div>
          ) : (
            logs.map((log) => (
              <div key={log.id} className="grid grid-cols-1 gap-3 p-5 md:grid-cols-[180px_140px_1fr_180px]">
                <div className="font-bold text-[#1F2937]" dir="ltr">{log.username}</div>
                <div className="rounded-full bg-[#EFF4FF] px-3 py-1 text-center text-xs font-bold text-[#3B82F6]">
                  {log.module}
                </div>
                <div>
                  <p className="font-bold text-[#1F2937]">{log.action}</p>
                  <p className="mt-1 text-sm text-[#707A84]">{log.details || "-"}</p>
                </div>
                <div className="text-sm text-[#707A84]" dir="ltr">
                  {formatDateForInput(log.createdAt)}
                </div>
              </div>
            ))
          )}
        </div>
      </section>
    </>
  );
}

/**
 * Locale-independent date field. Native <input type="date"> renders in the
 * browser's locale (dd/mm/yyyy on some machines, mm/dd/yyyy on others), which
 * we can't control. This always shows dd/mm/yyyy while emitting an ISO
 * (yyyy-mm-dd) value, and keeps a calendar picker via a hidden native input.
 */
function dmyFromValue(v: string): string {
  if (!v) return "";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(v);
  if (m) return `${m[3]}/${m[2]}/${m[1]}`;
  const d = new Date(v);
  if (!Number.isNaN(d.getTime())) {
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    return `${dd}/${mm}/${d.getFullYear()}`;
  }
  return "";
}

function isoFromDmy(text: string): string {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(text.trim());
  if (!m) return "";
  const day = Number(m[1]);
  const month = Number(m[2]);
  const year = Number(m[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return "";
  const d = new Date(year, month - 1, day);
  if (d.getFullYear() !== year || d.getMonth() !== month - 1 || d.getDate() !== day) return "";
  return `${m[3]}-${m[2]}-${m[1]}`;
}

function DateInputDMY({
  value,
  onChange,
  className,
  required,
  name,
  id,
}: {
  value: string;
  onChange: (iso: string) => void;
  className?: string;
  required?: boolean;
  name?: string;
  id?: string;
}) {
  const [text, setText] = useState(() => dmyFromValue(value));
  const nativeRef = useRef<HTMLInputElement>(null);

  // Sync when value changes externally (edit load / reset) without clobbering typing.
  useEffect(() => {
    if (value !== isoFromDmy(text)) setText(dmyFromValue(value));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  function handleText(raw: string) {
    const digits = raw.replace(/\D/g, "").slice(0, 8);
    let out = digits;
    if (digits.length > 4) out = `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
    else if (digits.length > 2) out = `${digits.slice(0, 2)}/${digits.slice(2)}`;
    setText(out);
    onChange(isoFromDmy(out));
  }

  function openPicker() {
    const el = nativeRef.current as (HTMLInputElement & { showPicker?: () => void }) | null;
    if (!el) return;
    if (typeof el.showPicker === "function") {
      try { el.showPicker(); return; } catch { /* fall back to focus/click */ }
    }
    el.focus();
    el.click();
  }

  const nativeValue = /^\d{4}-\d{2}-\d{2}/.test(value) ? value.slice(0, 10) : isoFromDmy(text);

  return (
    <div className="relative">
      <input
        id={id}
        name={name}
        type="text"
        inputMode="numeric"
        dir="ltr"
        placeholder="dd/mm/yyyy"
        value={text}
        onChange={(e) => handleText(e.target.value)}
        required={required}
        className={`${className ?? ""} !pr-11 text-left`}
      />
      <button
        type="button"
        onClick={openPicker}
        aria-label="اختيار التاريخ"
        className="absolute inset-y-0 right-0 flex items-center px-3 text-[#6B7280] transition hover:text-[#3B82F6]"
      >
        <CalendarDays className="h-5 w-5" />
      </button>
      <input
        ref={nativeRef}
        type="date"
        tabIndex={-1}
        aria-hidden="true"
        value={nativeValue}
        onChange={(e) => onChange(e.target.value)}
        className="pointer-events-none absolute bottom-0 right-3 h-0 w-0 opacity-0"
      />
    </div>
  );
}

function SubscriberForm({
  initialSubscriber,
  onSave,
  onCancel,
}: {
  initialSubscriber?: Subscriber | null;
  onSave: (
    subscriber: Omit<Subscriber, "id" | "customerId" | "carId"> & { customerId?: number },
    editId?: number
  ) => void | Promise<void>;
  onCancel?: () => void;
}) {
  const parsedInsurance = initialSubscriber
    ? parseInsuranceText(initialSubscriber.insuranceType)
    : null;

  const [saving, setSaving] = useState(false);
  const [uploadingField, setUploadingField] = useState<string | null>(null);

  const [formData, setFormData] = useState<FormState>({
    subscriberName: initialSubscriber?.subscriberName || "",
    carName: initialSubscriber?.carName || "",
    carNumber: initialSubscriber?.carNumber || "",
    carYear: initialSubscriber?.carYear || "",
    customerNumber: initialSubscriber?.customerNumber || "",
    insuranceType: parsedInsurance || emptyForm.insuranceType,
    insuranceCompany: initialSubscriber?.insuranceCompany || "",
    startDate: initialSubscriber?.startDate || "",
    endDate: initialSubscriber?.endDate || "",
    insuranceStatus: initialSubscriber?.insuranceStatus || "فعال",
    paidStatus: initialSubscriber?.paidStatus || "لاحقًا",

    hofaaPrice: initialSubscriber?.hofaaPrice || 0,
    thirdPartyPrice: initialSubscriber?.thirdPartyPrice || 0,
    fullPrice: initialSubscriber?.fullPrice || 0,
    paidAmount: initialSubscriber?.paidAmount || 0,
    cashAmount: initialSubscriber?.cashAmount || 0,
    visaAmount: initialSubscriber?.visaAmount || 0,
    checksAmount: initialSubscriber?.checksAmount || 0,
    checks:
      initialSubscriber?.checks && initialSubscriber.checks.length > 0
        ? initialSubscriber.checks
        : emptyForm.checks,

    history: initialSubscriber?.history || "",
    policyImage: initialSubscriber?.policyImage || "",
    documents: initialSubscriber?.documents || emptyDocuments,
    email: initialSubscriber?.email || "",
    address: initialSubscriber?.address || "",
    city: initialSubscriber?.city || "",
    country: initialSubscriber?.country || "",
    birthday: initialSubscriber?.birthday || "",
    gender: initialSubscriber?.gender || "",
    occupation: initialSubscriber?.occupation || "",
    customerStatus: initialSubscriber?.customerStatus || "فعال",
    source: initialSubscriber?.source || "",
    notes: initialSubscriber?.notes || "",
    tags: initialSubscriber?.tags || "",
    profileImage: initialSubscriber?.profileImage || "",
  });

  const inputClass =
    "h-12 w-full rounded-2xl border border-[#E5E7EB] bg-white px-4 text-[15px] text-[#1F2937] outline-none focus:border-[#3B82F6]";
  const labelClass = "mb-2 block text-[14px] font-medium text-[#374151]";

  const hofaaPrice = formData.insuranceType.hofaa ? numberValue(formData.hofaaPrice) : 0;
  const thirdPartyPrice =
    formData.insuranceType.type === "third" ? numberValue(formData.thirdPartyPrice) : 0;
  const fullPrice =
    formData.insuranceType.type === "full" ? numberValue(formData.fullPrice) : 0;

  const totalAmount = hofaaPrice + thirdPartyPrice + fullPrice;
  const checksAmount = formData.checks.reduce((sum, check) => sum + numberValue(check.amount), 0);
  const paidAmount = numberValue(formData.cashAmount) + numberValue(formData.visaAmount) + checksAmount;
  const remainingAmount = Math.max(totalAmount - paidAmount, 0);
  const paymentStatus = calcPaymentStatus(totalAmount, paidAmount);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;

    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const uploadFile = async (file: File) => {
    const formDataToUpload = new FormData();
    formDataToUpload.append("file", file);

    const res = await fetch("/api/upload", {
      method: "POST",
      body: formDataToUpload,
    });

    const responseText = await res.text();

    if (!res.ok) {
      console.error("UPLOAD API ERROR:", responseText);
      throw new Error(responseText || "Failed to upload file");
    }

    let data: any = {};

    try {
      data = JSON.parse(responseText);
    } catch (error) {
      console.error("UPLOAD JSON PARSE ERROR:", responseText, error);
      throw new Error("Upload response is not valid JSON");
    }

    if (!data.fileUrl) {
      console.error("UPLOAD MISSING FILE URL:", data);
      throw new Error("Upload response missing fileUrl");
    }

    return String(data.fileUrl || "");
  };

  const handleDocumentUpload = async (
    key: DocumentKey,
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setUploadingField(key);
      const fileUrl = await uploadFile(file);

      setFormData((prev) => ({
        ...prev,
        documents: {
          ...prev.documents,
          [key]: fileUrl,
        },
      }));
    } catch (error) {
      console.error("Document upload error:", error);
      alert("صار خطأ برفع المستند");
    } finally {
      setUploadingField(null);
      e.target.value = "";
    }
  };

  const handlePolicyUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setUploadingField("policyImage");
      const fileUrl = await uploadFile(file);

      setFormData((prev) => ({
        ...prev,
        policyImage: fileUrl,
      }));
    } catch (error) {
      console.error("Policy upload error:", error);
      alert("صار خطأ برفع وثيقة التأمين");
    } finally {
      setUploadingField(null);
      e.target.value = "";
    }
  };

  const handleRemoveDocument = (key: DocumentKey) => {
    setFormData((prev) => ({
      ...prev,
      documents: {
        ...prev.documents,
        [key]: "",
      },
    }));
  };

  const handleHofaaChange = () => {
    setFormData((prev) => ({
      ...prev,
      insuranceType: {
        ...prev.insuranceType,
        hofaa: !prev.insuranceType.hofaa,
      },
    }));
  };

  const handleTypeChange = (value: InsuranceMainType) => {
    setFormData((prev) => ({
      ...prev,
      insuranceType: {
        ...prev.insuranceType,
        type: value,
      },
    }));
  };

  const handleCheckChange = (
    index: number,
    field: keyof CheckItem,
    value: string
  ) => {
    setFormData((prev) => ({
      ...prev,
      checks: prev.checks.map((check, i) =>
        i === index
          ? {
              ...check,
              [field]: field === "amount" ? Number(value || 0) : value,
            }
          : check
      ),
    }));
  };

  const handleAddCheck = () => {
    setFormData((prev) => ({
      ...prev,
      checks: [
        ...prev.checks,
        {
          checkNumber: "",
          bankName: "",
          dueDate: "",
          amount: 0,
        },
      ],
    }));
  };

  const handleRemoveCheck = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      checks:
        prev.checks.length === 1
          ? emptyForm.checks
          : prev.checks.filter((_, i) => i !== index),
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (saving) return;

    try {
      setSaving(true);

      await onSave(
      {
        subscriberName: formData.subscriberName,
        customerId: initialSubscriber?.id === 0 ? initialSubscriber.customerId : undefined,
        carName: formData.carName,
        carNumber: formData.carNumber,
        carYear: formData.carYear,
        customerNumber: formData.customerNumber,
        insuranceType: buildInsuranceText(
          formData.insuranceType.type,
          formData.insuranceType.hofaa
        ),
        insuranceCompany: formData.insuranceCompany,
        startDate: formData.startDate,
        endDate: formData.endDate,
        insuranceStatus: formData.insuranceStatus,
        paidStatus: ([
          numberValue(formData.cashAmount) > 0 ? "كاش" : "",
          numberValue(formData.visaAmount) > 0 ? "فيزا" : "",
          checksAmount > 0 ? "شيكات" : "",
        ].filter(Boolean).join(" + ") || "لاحقًا") as PaidStatus,

        hofaaEnabled: formData.insuranceType.hofaa,
        hofaaPrice,
        thirdPartyEnabled: formData.insuranceType.type === "third",
        thirdPartyPrice,
        fullEnabled: formData.insuranceType.type === "full",
        fullPrice,
        totalAmount,
        paidAmount,
        cashAmount: numberValue(formData.cashAmount),
        visaAmount: numberValue(formData.visaAmount),
        checksAmount,
        remainingAmount,
        paymentStatus,
        checks: checksAmount > 0 ? formData.checks : [],

        history: formData.history || "لا يوجد سجل بعد",
        policyImage:
          formData.policyImage.trim() ||
          "https://placehold.co/800x520/png?text=Policy",
        documents: formData.documents,

        email: formData.email,
        address: formData.address,
        city: formData.city,
        country: formData.country,
        birthday: formData.birthday,
        gender: formData.gender,
        occupation: formData.occupation,
        customerStatus: formData.customerStatus,
        source: formData.source,
        notes: formData.notes,
        tags: formData.tags,
        profileImage: formData.profileImage,
      },
      initialSubscriber?.id
    );
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="mt-8 rounded-[28px] border border-[#EAECEF] bg-white p-6 shadow-sm">
      <h3 className="text-[22px] font-semibold">
        {initialSubscriber ? "تعديل بيانات المشترك" : "إضافة مشترك جديد"}
      </h3>

      <p className="mt-1 text-[14px] text-[#707A84]">
        عبّي البيانات التالية ثم اضغط حفظ
      </p>

      <form onSubmit={handleSubmit} className="mt-6 grid grid-cols-1 gap-5 md:grid-cols-2">
        <div>
          <label className={labelClass}>اسم المشترك</label>
          <input
            name="subscriberName"
            value={formData.subscriberName}
            onChange={handleChange}
            className={inputClass}
            required
          />
        </div>

        <div>
          <label className={labelClass}>اسم السيارة</label>
          <input
            name="carName"
            value={formData.carName}
            onChange={handleChange}
            className={inputClass}
            required
          />
        </div>

        <div>
          <label className={labelClass}>رقم السيارة</label>
          <input
            name="carNumber"
            value={formData.carNumber}
            onChange={handleChange}
            className={inputClass}
            required
          />
        </div>

        <div>
          <label className={labelClass}>سنة / موديل السيارة</label>
          <input
            name="carYear"
            value={formData.carYear}
            onChange={handleChange}
            className={inputClass}
            placeholder="مثلاً 2024"
            dir="ltr"
          />
        </div>

        <div>
          <label className={labelClass}>رقم الهاتف</label>
          <input
            name="customerNumber"
            value={formData.customerNumber}
            onChange={handleChange}
            className={inputClass}
            dir="ltr"
          />
        </div>

        <div className="md:col-span-2">
          <h4 className="mb-3 text-[16px] font-semibold text-[#1F2937]">بيانات العميل الإضافية</h4>
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            <div>
              <label className={labelClass}>البريد الإلكتروني</label>
              <input name="email" value={formData.email} onChange={handleChange} className={inputClass} dir="ltr" />
            </div>
            <div>
              <label className={labelClass}>المدينة</label>
              <input name="city" value={formData.city} onChange={handleChange} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>الدولة</label>
              <input name="country" value={formData.country} onChange={handleChange} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>تاريخ الميلاد</label>
              <DateInputDMY value={formData.birthday} onChange={(v) => setFormData((prev) => ({ ...prev, birthday: v }))} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>الجنس</label>
              <select name="gender" value={formData.gender} onChange={handleChange} className={inputClass}>
                <option value="">غير محدد</option>
                <option value="ذكر">ذكر</option>
                <option value="أنثى">أنثى</option>
              </select>
            </div>
            <div>
              <label className={labelClass}>المهنة</label>
              <input name="occupation" value={formData.occupation} onChange={handleChange} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>حالة العميل</label>
              <select name="customerStatus" value={formData.customerStatus} onChange={handleChange} className={inputClass}>
                <option value="فعال">فعال</option>
                <option value="محتمل">محتمل</option>
                <option value="غير فعال">غير فعال</option>
                <option value="مفقود">مفقود</option>
              </select>
            </div>
            <div>
              <label className={labelClass}>مصدر العميل</label>
              <input name="source" value={formData.source} onChange={handleChange} className={inputClass} placeholder="مثلاً: إحالة، فيسبوك" />
            </div>
            <div>
              <label className={labelClass}>الوسوم</label>
              <input name="tags" value={formData.tags} onChange={handleChange} className={inputClass} placeholder="VIP, تجديد" />
            </div>
            <div className="md:col-span-2">
              <label className={labelClass}>العنوان</label>
              <input name="address" value={formData.address} onChange={handleChange} className={inputClass} />
            </div>
            <div className="md:col-span-2">
              <label className={labelClass}>ملاحظات</label>
              <textarea name="notes" value={formData.notes} onChange={handleChange} rows={3} className={`${inputClass} h-auto py-3`} />
            </div>
            <div className="md:col-span-2 rounded-2xl border border-[#E5E7EB] bg-white p-4">
              <label className={labelClass}>صورة العميل</label>
              <input
                type="file"
                accept="image/*"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  try {
                    setUploadingField("profileImage");
                    const fileUrl = await uploadFile(file);
                    setFormData((prev) => ({ ...prev, profileImage: fileUrl }));
                  } catch {
                    alert("صار خطأ برفع الصورة");
                  } finally {
                    setUploadingField(null);
                    e.target.value = "";
                  }
                }}
                className="block w-full cursor-pointer rounded-xl border border-[#E5E7EB] bg-white text-sm file:ml-4 file:border-0 file:bg-[#3B82F6] file:px-4 file:py-3 file:text-white"
              />
              {formData.profileImage ? (
                <a href={formData.profileImage} target="_blank" rel="noreferrer" className="mt-3 inline-block text-[13px] font-semibold text-[#3B82F6]">
                  عرض الصورة
                </a>
              ) : null}
            </div>
          </div>
        </div>

        <div>
          <label className={labelClass}>شركة التأمين</label>
          <input
            name="insuranceCompany"
            value={formData.insuranceCompany}
            onChange={handleChange}
            className={inputClass}
            required
          />
        </div>

        <div>
          <label className={labelClass}>حالة التأمين</label>
          <select
            name="insuranceStatus"
            value={formData.insuranceStatus}
            onChange={handleChange}
            className={inputClass}
          >
            <option value="فعال">فعال</option>
            <option value="جديد">جديد</option>
            <option value="غير فعال">غير فعال</option>
            <option value="منتهي">منتهي</option>
          </select>
        </div>

        <div>
          <label className={labelClass}>طريقة الدفع</label>
          <div className="flex h-12 items-center rounded-2xl border border-[#E5E7EB] bg-[#FAFAFA] px-4 text-[14px] font-bold text-[#3B82F6]">
            يتم تحديدها تلقائيًا من مبالغ الكاش / الفيزا / الشيكات
          </div>
        </div>

        <div>
          <label className={labelClass}>تاريخ البداية</label>
          <DateInputDMY
            value={formData.startDate}
            onChange={(v) => setFormData((prev) => ({ ...prev, startDate: v }))}
            className={inputClass}
          />
        </div>

        <div>
          <label className={labelClass}>تاريخ النهاية</label>
          <DateInputDMY
            value={formData.endDate}
            onChange={(v) => setFormData((prev) => ({ ...prev, endDate: v }))}
            className={inputClass}
            required
          />
        </div>

        <div className="md:col-span-2">
          <label className={labelClass}>نوع التأمين والأسعار</label>

          <div className="rounded-3xl border border-[#E5E7EB] bg-[#FAFAFA] p-5">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div className="rounded-2xl border border-[#E5E7EB] bg-white p-4">
                <label className="flex cursor-pointer items-center gap-3 font-semibold text-[#374151]">
                  <input
                    type="checkbox"
                    checked={formData.insuranceType.hofaa}
                    onChange={handleHofaaChange}
                  />
                  <span>تأمين حوفا</span>
                </label>

                {formData.insuranceType.hofaa && (
                  <div className="mt-4">
                    <label className={labelClass}>سعر الحوفا</label>
                    <input
                      type="number"
                      value={formData.hofaaPrice}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          hofaaPrice: Number(e.target.value || 0),
                        }))
                      }
                      className={inputClass}
                      min="0"
                    />
                  </div>
                )}
              </div>

              <div className="rounded-2xl border border-[#E5E7EB] bg-white p-4">
                <label className="flex cursor-pointer items-center gap-3 font-semibold text-[#374151]">
                  <input
                    type="radio"
                    name="insuranceMain"
                    checked={formData.insuranceType.type === "third"}
                    onChange={() => handleTypeChange("third")}
                  />
                  <span>طرف ثالث</span>
                </label>

                {formData.insuranceType.type === "third" && (
                  <div className="mt-4">
                    <label className={labelClass}>سعر الطرف الثالث</label>
                    <input
                      type="number"
                      value={formData.thirdPartyPrice}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          thirdPartyPrice: Number(e.target.value || 0),
                        }))
                      }
                      className={inputClass}
                      min="0"
                    />
                  </div>
                )}
              </div>

              <div className="rounded-2xl border border-[#E5E7EB] bg-white p-4">
                <label className="flex cursor-pointer items-center gap-3 font-semibold text-[#374151]">
                  <input
                    type="radio"
                    name="insuranceMain"
                    checked={formData.insuranceType.type === "full"}
                    onChange={() => handleTypeChange("full")}
                  />
                  <span>شامل</span>
                </label>

                {formData.insuranceType.type === "full" && (
                  <div className="mt-4">
                    <label className={labelClass}>سعر الشامل</label>
                    <input
                      type="number"
                      value={formData.fullPrice}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          fullPrice: Number(e.target.value || 0),
                        }))
                      }
                      className={inputClass}
                      min="0"
                    />
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="md:col-span-2 rounded-3xl border border-[#E5E7EB] bg-[#FAFAFA] p-5">
          <h4 className="mb-5 text-[18px] font-bold text-[#1F2937]">
            تفاصيل الدفع المتعدد
          </h4>

          <div className="grid grid-cols-1 gap-5 md:grid-cols-4">
            <div className="rounded-2xl bg-white p-4">
              <p className="text-sm text-[#707A84]">المجموع</p>
              <p className="mt-2 text-2xl font-bold text-[#1F2937]">{totalAmount}</p>
            </div>

            <div>
              <label className={labelClass}>دفع كاش</label>
              <input
                type="number"
                value={formData.cashAmount}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    cashAmount: Number(e.target.value || 0),
                  }))
                }
                className={inputClass}
                min="0"
              />
            </div>

            <div>
              <label className={labelClass}>دفع فيزا</label>
              <input
                type="number"
                value={formData.visaAmount}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    visaAmount: Number(e.target.value || 0),
                  }))
                }
                className={inputClass}
                min="0"
              />
            </div>

            <div className="rounded-2xl bg-white p-4">
              <p className="text-sm text-[#707A84]">مجموع الشيكات</p>
              <p className="mt-2 text-2xl font-bold text-amber-600">{checksAmount}</p>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-1 gap-5 md:grid-cols-3">
            <div className="rounded-2xl bg-white p-4">
              <p className="text-sm text-[#707A84]">المدفوع الكلي</p>
              <p className="mt-2 text-2xl font-bold text-emerald-700">{paidAmount}</p>
            </div>

            <div className="rounded-2xl bg-white p-4">
              <p className="text-sm text-[#707A84]">المتبقي</p>
              <p className="mt-2 text-2xl font-bold text-rose-600">{remainingAmount}</p>
            </div>

            <div className="rounded-2xl bg-white p-4">
              <p className="text-sm text-[#707A84]">حالة الدفع</p>
              <p className="mt-2 text-lg font-bold text-[#3B82F6]">{paymentStatus}</p>
            </div>
          </div>

          <div className="mt-6 rounded-2xl border border-[#E5E7EB] bg-white p-5">
            <div className="mb-4 flex items-center justify-between">
              <h5 className="text-lg font-bold text-[#1F2937]">تفاصيل الشيكات إن وجدت</h5>

              <button
                type="button"
                onClick={handleAddCheck}
                className="rounded-xl bg-[#3B82F6] px-4 py-2 text-sm font-bold text-white"
              >
                إضافة شيك
              </button>
            </div>

            <div className="space-y-4">
              {formData.checks.map((check, index) => (
                <div
                  key={index}
                  className="grid grid-cols-1 gap-4 rounded-2xl border border-[#E5E7EB] bg-[#FAFAFA] p-4 md:grid-cols-5"
                >
                  <div>
                    <label className={labelClass}>رقم الشيك</label>
                    <input
                      value={check.checkNumber}
                      onChange={(e) => handleCheckChange(index, "checkNumber", e.target.value)}
                      className={inputClass}
                      dir="ltr"
                    />
                  </div>

                  <div>
                    <label className={labelClass}>اسم البنك</label>
                    <input
                      value={check.bankName}
                      onChange={(e) => handleCheckChange(index, "bankName", e.target.value)}
                      className={inputClass}
                    />
                  </div>

                  <div>
                    <label className={labelClass}>تاريخ الاستحقاق</label>
                    <DateInputDMY
                      value={check.dueDate}
                      onChange={(v) => handleCheckChange(index, "dueDate", v)}
                      className={inputClass}
                    />
                  </div>

                  <div>
                    <label className={labelClass}>قيمة الشيك</label>
                    <input
                      type="number"
                      value={check.amount}
                      onChange={(e) => handleCheckChange(index, "amount", e.target.value)}
                      className={inputClass}
                      min="0"
                    />
                  </div>

                  <div className="flex items-end">
                    <button
                      type="button"
                      onClick={() => handleRemoveCheck(index)}
                      className="h-12 w-full rounded-2xl border border-rose-200 bg-white text-sm font-bold text-rose-600 hover:bg-rose-50"
                    >
                      حذف
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="md:col-span-2">
          <label className={labelClass}>رفع المستندات</label>

          <div className="grid grid-cols-1 gap-4 rounded-2xl border border-[#E5E7EB] bg-[#FAFAFA] p-4 md:grid-cols-2">
            <div className="rounded-2xl border border-[#E5E7EB] bg-white p-4">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-[14px] font-semibold text-[#374151]">
                  صورة وثيقة التأمين
                </span>

                {formData.policyImage && (
                  <button
                    type="button"
                    onClick={() =>
                      setFormData((prev) => ({
                        ...prev,
                        policyImage: "",
                      }))
                    }
                    className="text-[12px] font-semibold text-rose-600"
                  >
                    حذف
                  </button>
                )}
              </div>

              <input
                type="file"
                accept="image/*,.pdf,.doc,.docx"
                onChange={handlePolicyUpload}
                className="block w-full cursor-pointer rounded-xl border border-[#E5E7EB] bg-white text-sm text-[#374151] file:ml-4 file:border-0 file:bg-[#3B82F6] file:px-4 file:py-3 file:text-white"
              />

              {uploadingField === "policyImage" && (
                <p className="mt-3 flex items-center gap-2 text-[13px] font-semibold text-[#3B82F6]">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  جاري الرفع...
                </p>
              )}

              {formData.policyImage && (
                <a
                  href={formData.policyImage}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-3 inline-block text-[13px] font-semibold text-[#3B82F6]"
                >
                  عرض المستند
                </a>
              )}
            </div>

            {(Object.keys(documentLabels) as DocumentKey[]).map((key) => (
              <div key={key} className="rounded-2xl border border-[#E5E7EB] bg-white p-4">
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-[14px] font-semibold text-[#374151]">
                    {documentLabels[key]}
                  </span>

                  {formData.documents[key] && (
                    <button
                      type="button"
                      onClick={() => handleRemoveDocument(key)}
                      className="text-[12px] font-semibold text-rose-600"
                    >
                      حذف
                    </button>
                  )}
                </div>

                <input
                  type="file"
                  accept="image/*,.pdf,.doc,.docx"
                  onChange={(e) => handleDocumentUpload(key, e)}
                  className="block w-full cursor-pointer rounded-xl border border-[#E5E7EB] bg-white text-sm text-[#374151] file:ml-4 file:border-0 file:bg-[#3B82F6] file:px-4 file:py-3 file:text-white"
                />

                {uploadingField === key && (
                  <p className="mt-3 flex items-center gap-2 text-[13px] font-semibold text-[#3B82F6]">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    جاري الرفع...
                  </p>
                )}

                {formData.documents[key] && (
                  <a
                    href={formData.documents[key]}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-3 inline-block text-[13px] font-semibold text-[#3B82F6]"
                  >
                    عرض المستند
                  </a>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="md:col-span-2">
          <label className={labelClass}>سجل المشترك</label>
          <textarea
            name="history"
            value={formData.history}
            onChange={handleChange}
            className="min-h-[110px] w-full rounded-2xl border border-[#E5E7EB] bg-white px-4 py-3 text-[15px] text-[#1F2937] outline-none focus:border-[#3B82F6]"
            placeholder="مثلاً: دفع شهر 4، تم التواصل معه، ملاحظة..."
          />
        </div>

        <div className="flex items-end gap-3 md:col-span-2">
          <button
            type="submit"
            disabled={saving || uploadingField !== null}
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#3B82F6] px-8 py-3 font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                جاري الحفظ...
              </>
            ) : uploadingField ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                جاري رفع المستند...
              </>
            ) : (
              "حفظ"
            )}
          </button>

          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="rounded-2xl border border-[#E5E7EB] bg-white px-8 py-3 font-semibold text-[#374151] transition hover:bg-gray-50"
            >
              إلغاء
            </button>
          )}
        </div>
      </form>
    </section>
  );
}

export function HomePage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [activeMenu, setActiveMenu] = useState<MenuKey>(() =>
    parseMenuFromSearchParams(searchParams)
  );
  const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
  const [accidentCases, setAccidentCases] = useState<AccidentCase[]>([]);
  const [search, setSearch] = useState("");
  const [documentsPreview, setDocumentsPreview] = useState<Subscriber | null>(null);
  const [historyPreview, setHistoryPreview] = useState<Subscriber | null>(null);
  const [editingSubscriber, setEditingSubscriber] = useState<Subscriber | null>(null);
  const [selectedAccident, setSelectedAccident] = useState<AccidentCase | null>(null);
  const [addAccidentOpen, setAddAccidentOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [customersPage, setCustomersPage] = useState(1);
  const [accidentsPage, setAccidentsPage] = useState(1);
  const [customersPagination, setCustomersPagination] = useState<PaginationMeta | null>(null);
  const [accidentsPagination, setAccidentsPagination] = useState<PaginationMeta | null>(null);
  const [dashboardStats, setDashboardStats] = useState<DashboardStats | null>(null);
  const [menuInsights, setMenuInsights] = useState<MenuInsightsData | null>(null);
  const [sheetError, setSheetError] = useState("");
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [globalSearchOpen, setGlobalSearchOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState<AppUser | null>(null);
  const [branding, setBranding] = useState<TenantBranding>(() =>
    resolveBranding({ companyName: "Gosol CRM", isDemo: false })
  );
  const notificationCount = useNotificationCount();
  const isDemoTenant =
    branding.isDemo || Number(currentUser?.companyId) === DEMO_COMPANY_ID;
  const vocabulary = useMemo(() => getCrmVocabulary(isDemoTenant), [isDemoTenant]);

  const navigateToMenu = useCallback(
    (menu: MenuKey) => {
      setActiveMenu(menu);
      router.replace(buildSectionUrl(pathname, menu, searchParams), { scroll: false });
    },
    [router, pathname, searchParams]
  );

  useEffect(() => {
    const menuFromUrl = parseMenuFromSearchParams(searchParams);
    setActiveMenu((current) => (current === menuFromUrl ? current : menuFromUrl));
  }, [searchParams]);

  const loadCurrentUser = async () => {
    try {
      const [userRes, brandingRes] = await Promise.all([
        fetch("/api/me", { cache: "no-store" }),
        fetch("/api/branding", { cache: "no-store" }),
      ]);
      if (!userRes.ok) {
        window.location.href = "/login";
        return;
      }
      const data = await userRes.json();
      if (brandingRes.ok) {
        const brandingData = await brandingRes.json();
        if (brandingData.companyType === "dental") {
          window.location.replace("/dental");
          return;
        }
        setBranding(brandingData);
      }
      setCurrentUser(data);
    } catch (error) {
      console.error("Load current user error:", error);
      window.location.href = "/login";
    }
  };


  const loadDatabaseData = async (
    nextCustomersPage = customersPage,
    nextAccidentsPage = accidentsPage
  ) => {
    try {
      setLoading(true);
      setSheetError("");

      const customerFilter = mapMenuToCustomerFilter(activeMenu);
      const searchQuery = encodeURIComponent(search.trim());
      const customersUrl = `${CUSTOMERS_API_URL}?page=${nextCustomersPage}&limit=${DEFAULT_PAGE_LIMIT}&filter=${customerFilter}&q=${searchQuery}`;
      const accidentsUrl = `${ACCIDENTS_API_URL}?page=${nextAccidentsPage}&limit=${DEFAULT_PAGE_LIMIT}&q=${searchQuery}`;
      const shouldLoadInsights = INSIGHT_MENUS.includes(activeMenu);
      const insightsUrl = `${CUSTOMERS_INSIGHTS_API_URL}?filter=${customerFilter}&mode=${activeMenu}&q=${searchQuery}`;

      const [customersRes, insightsRes] = await Promise.all([
        fetch(customersUrl, { cache: "no-store" }),
        shouldLoadInsights ? fetch(insightsUrl, { cache: "no-store" }) : Promise.resolve(null),
      ]);

      if (!customersRes.ok) throw new Error("Failed to load customers");

      const customersPayload = await customersRes.json();
      const customerItems = Array.isArray(customersPayload?.items) ? customersPayload.items : [];

      let accidentItems: any[] = [];
      let accidentsPayload: any = null;

      if (canViewAccidents) {
        const accidentsRes = await fetch(accidentsUrl, { cache: "no-store" });
        if (!accidentsRes.ok) throw new Error("Failed to load accidents");
        accidentsPayload = await accidentsRes.json();
        accidentItems = Array.isArray(accidentsPayload?.items) ? accidentsPayload.items : [];
      }

      setSubscribers(mapDbCustomersToSubscribers(customerItems));
      setAccidentCases(accidentItems.map(mapDbAccidentToCase));
      setCustomersPagination(customersPayload?.pagination || null);
      setAccidentsPagination(accidentsPayload?.pagination || null);
      setDashboardStats(customersPayload?.stats || null);
      if (shouldLoadInsights && insightsRes?.ok) {
        setMenuInsights(await insightsRes.json());
      } else {
        setMenuInsights(null);
      }
      setCustomersPage(nextCustomersPage);
      setAccidentsPage(nextAccidentsPage);
    } catch (error) {
      console.error("Database load error:", error);
      setSheetError("صار خطأ بتحميل بيانات قاعدة البيانات");
    } finally {
      setLoading(false);
    }
  };

  const refreshDashboardStats = async () => {
    try {
      const res = await fetch("/api/customers/stats", { cache: "no-store" });
      if (!res.ok) return;
      setDashboardStats(await res.json());

      if (INSIGHT_MENUS.includes(activeMenu)) {
        const customerFilter = mapMenuToCustomerFilter(activeMenu);
        const searchQuery = encodeURIComponent(search.trim());
        const insightsUrl = `${CUSTOMERS_INSIGHTS_API_URL}?filter=${customerFilter}&mode=${activeMenu}&q=${searchQuery}`;
        const insightsRes = await fetch(insightsUrl, { cache: "no-store" });
        if (insightsRes.ok) {
          setMenuInsights(await insightsRes.json());
        }
      }
    } catch (error) {
      console.error("Refresh stats error:", error);
    }
  };

  const mergeCustomerGraphIntoSubscribers = (graph: any) => {
    const customerId = Number(graph?.id);
    if (!Number.isFinite(customerId)) return;

    const mapped = mapDbCustomersToSubscribers([graph]);
    setSubscribers((prev) => [
      ...prev.filter((item) => Number(item.customerId) !== customerId),
      ...mapped,
    ]);
  };

  useEffect(() => {
    loadCurrentUser();
  }, []);

  useEffect(() => {
    setCustomersPage(1);
    setAccidentsPage(1);
  }, [activeMenu, search]);

  useEffect(() => {
    if (!currentUser) return;
    loadDatabaseData(1, 1);
  }, [activeMenu, search, currentUser]);

  const activeSubscribers = subscribers.filter(
    (s) => s.insuranceStatus === "فعال" || s.insuranceStatus === "جديد"
  );

  const inactiveSubscribers = subscribers.filter(
    (s) => s.insuranceStatus === "غير فعال" || s.insuranceStatus === "منتهي"
  );

  const hasRenewalForSubscriber = (subscriber: Subscriber) => {
    const subscriberEndDate = parseEndDate(subscriber.endDate);
    if (!subscriberEndDate) return false;

    return subscribers.some((item) => {
      if (Number(item.customerId) !== Number(subscriber.customerId)) return false;
      if (Number(item.id) === Number(subscriber.id)) return false;
      if (item.insuranceStatus !== "فعال" && item.insuranceStatus !== "جديد") return false;

      const itemEndDate = parseEndDate(item.endDate);
      if (!itemEndDate) return false;

      return itemEndDate > subscriberEndDate;
    });
  };

  const renewalInsuranceRows = subscribers.filter(
    (subscriber) =>
      subscriber.insuranceStatus === "فعال" &&
      isExpiringThisMonth(subscriber.endDate)
  );

  const pendingRenewalsThisMonth = renewalInsuranceRows.filter(
    (subscriber) => !hasRenewalForSubscriber(subscriber)
  );

  const renewalsThisMonth = renewalInsuranceRows;

  const renewalsThisMonthCount = pendingRenewalsThisMonth.length;

  const customerNodes = useMemo(() => buildCustomerNodes(subscribers), [subscribers]);

  const canViewSubscribers = Boolean(currentUser?.viewSubscribers);
  const canCreateSubscribers = Boolean(currentUser?.createSubscribers);
  const canEditSubscribers = Boolean(currentUser?.editSubscribers);
  const canDeleteSubscribers = Boolean(currentUser?.deleteSubscribers);
  const [dupOpen, setDupOpen] = useState(false);
  const canViewAccidents = Boolean(currentUser?.viewAccidents);
  const canCreateAccidents = Boolean(currentUser?.createAccidents);
  const canEditAccidents = Boolean(currentUser?.editAccidents);
  const canDeleteAccidents = Boolean(currentUser?.deleteAccidents);
  const canViewAccounting = Boolean(currentUser?.viewAccounting);
  const canEditPayments = Boolean(currentUser?.editPayments);
  const canViewUsers = Boolean(currentUser?.viewUsers);
  const canEditUsers = Boolean(currentUser?.editUsers);
  const canViewActivityLog = Boolean(currentUser?.viewActivityLog);
  const isMaster = currentUser?.role === "master";

  const filteredSubscribers = (data: Subscriber[]) => {
    const normalizedTerm = normalizeSearchText(search);
    const compactTerm = compactSearchText(search);

    if (!normalizedTerm && !compactTerm) return data;

    const terms = normalizedTerm.split(/\s+/).filter(Boolean);

    return data.filter((subscriber) => {
      const searchableValues = [
        subscriber.subscriberName,
        subscriber.carName,
        subscriber.carNumber,
        subscriber.carYear,
        subscriber.customerNumber,
        subscriber.insuranceType,
        subscriber.insuranceCompany,
        subscriber.insuranceStatus,
        subscriber.paidStatus,
        subscriber.paymentStatus,
        subscriber.history,
        subscriber.startDate,
        subscriber.endDate,
        subscriber.hofaaPrice,
        subscriber.thirdPartyPrice,
        subscriber.fullPrice,
        subscriber.totalAmount,
        subscriber.paidAmount,
        subscriber.cashAmount,
        subscriber.visaAmount,
        subscriber.checksAmount,
        subscriber.remainingAmount,
        subscriber.policyImage,
        subscriber.documents?.drivingLicense,
        subscriber.documents?.carLicense,
        subscriber.documents?.companionId,
        subscriber.documents?.carImage1,
        subscriber.documents?.carImage2,
        subscriber.documents?.carImage3,
        subscriber.documents?.carImage4,
        subscriber.documents?.carImage5,
        subscriber.documents?.insurancePolicy1,
        subscriber.documents?.insurancePolicy2,
        subscriber.documents?.otherDocument,
        subscriber.documents?.otherDocument2,
        subscriber.documents?.otherDocument3,
        ...(subscriber.checks || []).flatMap((check) => [
          check.checkNumber,
          check.bankName,
          check.dueDate,
          check.amount,
        ]),
      ];

      const searchableText = normalizeSearchText(searchableValues.join(" "));
      const compactSearchableText = compactSearchText(searchableValues.join(" "));

      return (
        terms.every((term) => searchableText.includes(term)) ||
        (!!compactTerm && compactSearchableText.includes(compactTerm))
      );
    });
  };

  const handleSaveSubscriber = async (
    subscriber: Omit<Subscriber, "id" | "customerId" | "carId"> & { customerId?: number },
    editId?: number
  ) => {
    try {
      setLoading(true);

      if (editId) {
        const existingSubscriber = subscribers.find((item) => item.id === editId);

        if (!existingSubscriber) {
          throw new Error("Subscriber not found");
        }

        const res = await fetch(
          `${CUSTOMERS_API_URL}/${existingSubscriber.customerId}`,
          {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              insuranceId: existingSubscriber.id,
              carId: existingSubscriber.carId,
              name: subscriber.subscriberName,
              phone: subscriber.customerNumber,
              ...buildCustomerProfileBody(subscriber),
              carName: subscriber.carName,
              carNumber: subscriber.carNumber,
              carYear: subscriber.carYear,
              insuranceType: subscriber.insuranceType,
              insuranceCompany: subscriber.insuranceCompany,
              startDate: subscriber.startDate || todayString(),
              endDate: subscriber.endDate || todayString(),
              status: subscriber.insuranceStatus,
              paymentMethod: subscriber.paidStatus,

              hofaaEnabled: subscriber.hofaaEnabled,
              hofaaPrice: subscriber.hofaaPrice,
              thirdPartyEnabled: subscriber.thirdPartyEnabled,
              thirdPartyPrice: subscriber.thirdPartyPrice,
              fullEnabled: subscriber.fullEnabled,
              fullPrice: subscriber.fullPrice,
              totalAmount: subscriber.totalAmount,
              paidAmount: subscriber.paidAmount,
              cashAmount: subscriber.cashAmount,
              visaAmount: subscriber.visaAmount,
              checksAmount: subscriber.checksAmount,
              remainingAmount: subscriber.remainingAmount,
              paymentStatus: subscriber.paymentStatus,
              policyImage: subscriber.policyImage,
              documents: subscriber.documents,
              checks: subscriber.checks,
            }),
          }
        );

        if (!res.ok) {
          const data = await res.json().catch(() => ({} as { error?: string }));
          if (res.status === 409) {
            alert(data?.error || "رقم السيارة مسجّل مسبقًا لدى عميل آخر.");
            return;
          }
          throw new Error("Failed to update subscriber");
        }
        const graph = await res.json();
        mergeCustomerGraphIntoSubscribers(graph);
        await refreshDashboardStats();
        setEditingSubscriber(null);
        navigateToMenu("active-subscribers");
        return;
      }

      const res = await fetch(CUSTOMERS_API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          customerId: subscriber.customerId,
          name: subscriber.subscriberName,
          phone: subscriber.customerNumber,
          ...buildCustomerProfileBody(subscriber),
          carName: subscriber.carName,
          carNumber: subscriber.carNumber,
          carYear: subscriber.carYear,
          insuranceType: subscriber.insuranceType,
          insuranceCompany: subscriber.insuranceCompany,
          startDate: subscriber.startDate || todayString(),
          endDate: subscriber.endDate || todayString(),
          status: subscriber.insuranceStatus,
          paymentMethod: subscriber.paidStatus,

          hofaaEnabled: subscriber.hofaaEnabled,
          hofaaPrice: subscriber.hofaaPrice,
          thirdPartyEnabled: subscriber.thirdPartyEnabled,
          thirdPartyPrice: subscriber.thirdPartyPrice,
          fullEnabled: subscriber.fullEnabled,
          fullPrice: subscriber.fullPrice,
          totalAmount: subscriber.totalAmount,
          paidAmount: subscriber.paidAmount,
          cashAmount: subscriber.cashAmount,
          visaAmount: subscriber.visaAmount,
          checksAmount: subscriber.checksAmount,
          remainingAmount: subscriber.remainingAmount,
          paymentStatus: subscriber.paymentStatus,
          policyImage: subscriber.policyImage,
          documents: subscriber.documents,
          checks: subscriber.checks,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({} as { error?: string }));
        if (res.status === 409) {
          alert(data?.error || "رقم السيارة مسجّل مسبقًا لدى عميل آخر.");
          return;
        }
        throw new Error("Failed to create subscriber");
      }
      const graph = await res.json();
      mergeCustomerGraphIntoSubscribers(graph);
      setCustomersPagination((prev) =>
        prev ? { ...prev, total: prev.total + 1 } : prev
      );
      await refreshDashboardStats();
      navigateToMenu("active-subscribers");
    } catch (error) {
      console.error("Save subscriber error:", error);
      alert("صار خطأ بحفظ المشترك في قاعدة البيانات");
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (subscriber: Subscriber) => {
    setEditingSubscriber(subscriber);
    navigateToMenu("add-new-subscriber");
    setNotificationsOpen(false);
  };

  const handleDelete = async (id: number) => {
    const ok = confirm("هل أنت متأكد أنك تريد حذف هذا المشترك؟");
    if (!ok) return;

    try {
      setLoading(true);

      const deletedSubscriber = subscribers.find((subscriber) => subscriber.id === id);
      const res = await fetch(`${CUSTOMERS_API_URL}/${id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        throw new Error("Failed to delete subscriber");
      }

      setSubscribers((prev) => prev.filter((item) => item.id !== id));
      setCustomersPagination((prev) =>
        prev ? { ...prev, total: Math.max(0, prev.total - 1) } : prev
      );
      await refreshDashboardStats();
    } catch (error) {
      console.error("Delete subscriber error:", error);
      alert("صار خطأ أثناء حذف المشترك من قاعدة البيانات");
    } finally {
      setLoading(false);
    }
  };


  const handleRenewSubscriber = (subscriber: Subscriber) => {
    if (!canCreateSubscribers) {
      alert("لا يوجد لديك صلاحية إضافة مشترك");
      return;
    }

    setEditingSubscriber({
      ...subscriber,
      id: 0,
      carId: 0,
      subscriberName: subscriber.subscriberName,
      customerNumber: subscriber.customerNumber,
      carName: "",
      carNumber: "",
      carYear: "",
      insuranceType: "غير محدد",
      insuranceCompany: "",
      startDate: "",
      endDate: "",
      insuranceStatus: "فعال",
      paidStatus: "لاحقًا",
      hofaaEnabled: false,
      hofaaPrice: 0,
      thirdPartyEnabled: false,
      thirdPartyPrice: 0,
      fullEnabled: false,
      fullPrice: 0,
      totalAmount: 0,
      paidAmount: 0,
      cashAmount: 0,
      visaAmount: 0,
      checksAmount: 0,
      remainingAmount: 0,
      paymentStatus: "غير مدفوع",
      checks: emptyForm.checks,
      history: "",
      policyImage: "",
      documents: emptyDocuments,
    });

    setNotificationsOpen(false);
    navigateToMenu("add-new-subscriber");
  };

  const handleTerminateSubscriber = async (subscriber: Subscriber) => {
    if (!canEditSubscribers) {
      alert("لا يوجد لديك صلاحية إنهاء الاشتراك");
      return;
    }

    const ok = confirm(`هل تريد إنهاء اشتراك ${subscriber.subscriberName}؟`);
    if (!ok) return;

    try {
      setLoading(true);

      const res = await fetch(`${CUSTOMERS_API_URL}/${subscriber.customerId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "terminate",
          insuranceId: subscriber.id,
        }),
      });

      if (!res.ok) {
        throw new Error("Failed to terminate subscriber");
      }

      const graph = await res.json();
      mergeCustomerGraphIntoSubscribers(graph);
      await refreshDashboardStats();
      navigateToMenu("renewals-this-month");
    } catch (error) {
      console.error("Terminate subscriber error:", error);
      alert("صار خطأ أثناء إنهاء الاشتراك");
    } finally {
      setLoading(false);
    }
  };

  const handleAddAccident = async (accident: Omit<AccidentCase, "id" | "updates">) => {
    try {
      const res = await fetch(ACCIDENTS_API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          customerId: accident.customerId,
          carId: accident.carId,
          caseNumber: accident.caseNumber,
          details: accident.details,
          status: accident.status,
        }),
      });

      if (!res.ok) throw new Error("Failed to create accident");

      const created = await res.json();
      const formatted = mapDbAccidentToCase(created);
      setAccidentCases((prev) => [formatted, ...prev]);
    } catch (error) {
      console.error("Add accident error:", error);
      alert("صار خطأ بحفظ حادث جديد");
    }
  };

  const handleSaveAccidentDetails = async (updatedAccident: AccidentCase) => {
    try {
      const currentAccident = accidentCases.find(
        (accident) => accident.id === updatedAccident.id
      );

      const oldUpdateIds = new Set(
        (currentAccident?.updates || []).map((update) => update.id)
      );

      const res = await fetch(`${ACCIDENTS_API_URL}/${updatedAccident.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          details: updatedAccident.details,
          status: updatedAccident.status,
        }),
      });

      if (!res.ok) throw new Error("Failed to update accident");

      const newUpdates = updatedAccident.updates.filter(
        (update) => !oldUpdateIds.has(update.id)
      );

      for (const update of newUpdates) {
        const updateRes = await fetch(
          `${ACCIDENTS_API_URL}/${updatedAccident.id}/updates`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ text: update.text }),
          }
        );

        if (!updateRes.ok) throw new Error("Failed to create accident update");
      }

      const detailRes = await fetch(`${ACCIDENTS_API_URL}/${updatedAccident.id}`, {
        cache: "no-store",
      });
      if (!detailRes.ok) throw new Error("Failed to reload accident");

      const freshAccident = mapDbAccidentToCase(await detailRes.json());
      setAccidentCases((prev) =>
        prev.map((accident) => (accident.id === freshAccident.id ? freshAccident : accident))
      );
      setSelectedAccident(null);
    } catch (error) {
      console.error("Save accident details error:", error);
      alert("صار خطأ بحفظ تحديثات الحادث");
    }
  };

  const handleDeleteAccident = async (id: number) => {
    if (!canDeleteAccidents) {
      alert("لا يوجد لديك صلاحية حذف الحوادث");
      return;
    }

    const ok = confirm("هل أنت متأكد أنك تريد حذف هذا الحادث؟");
    if (!ok) return;

    try {
      setLoading(true);

      const res = await fetch(`${ACCIDENTS_API_URL}/${id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        throw new Error("Failed to delete accident");
      }

      setSelectedAccident(null);
      setAccidentCases((prev) => prev.filter((accident) => accident.id !== id));
      setAccidentsPagination((prev) =>
        prev ? { ...prev, total: Math.max(0, prev.total - 1) } : prev
      );
      await refreshDashboardStats();
    } catch (error) {
      console.error("Delete accident error:", error);
      alert("صار خطأ أثناء حذف الحادث");
    } finally {
      setLoading(false);
    }
  };

  const sidebarNavigate = useCallback(
    (value: MenuKey) => {
      setEditingSubscriber(null);
      navigateToMenu(value);
    },
    [navigateToMenu]
  );

  const pageTitle = getPageTitle(activeMenu, isDemoTenant, Boolean(editingSubscriber));

  const content = useMemo(() => {
    if (!currentUser) {
      return <div className="mt-8 rounded-3xl bg-white p-10 text-center text-[#707A84]">جاري تحميل صلاحيات المستخدم...</div>;
    }

    if (activeMenu === "dashboard") {
      return (
        <ExecutiveDashboard
          username={currentUser.username}
          canCreateSubscribers={canCreateSubscribers}
          canViewAccounting={canViewAccounting}
          onNavigate={navigateToMenu}
          isDemo={isDemoTenant}
        />
      );
    }

    if (activeMenu === "active-subscribers") {
      return (
        <>
          {canDeleteSubscribers && (
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setDupOpen(true)}
                className="inline-flex items-center gap-2 rounded-2xl border border-[#E5E7EB] bg-white px-4 py-2.5 text-[13px] font-bold text-[#B45309] shadow-sm transition hover:bg-[#FFFBEB]"
              >
                <Copy className="h-4 w-4" /> فحص المشتركين المكرّرين
              </button>
            </div>
          )}
          <SubscribersTable
            data={filteredSubscribers(activeSubscribers)}
            title={vocabulary.activePolicies}
            labels={vocabulary}
            loading={loading}
            pagination={customersPagination}
            onPageChange={(page) => loadDatabaseData(page, accidentsPage)}
            onViewDocuments={setDocumentsPreview}
            onOpenHistory={setHistoryPreview}
            onEdit={canEditSubscribers ? handleEdit : () => alert("لا يوجد لديك صلاحية التعديل")}
            onDelete={canDeleteSubscribers ? handleDelete : () => alert("لا يوجد لديك صلاحية الحذف")}
          />
        </>
      );
    }

    if (activeMenu === "active-customers") {
      return (
        <ActiveCustomersDashboard
          subscribers={filteredSubscribers(activeSubscribers)}
          labels={vocabulary}
          loading={loading}
          onOpenHistory={setHistoryPreview}
        />
      );
    }

    if (activeMenu === "inactive-subscribers") {
      return (
        <SubscribersTable
          data={filteredSubscribers(inactiveSubscribers)}
          title={vocabulary.inactiveCustomers}
          labels={vocabulary}
          loading={loading}
          pagination={customersPagination}
          onPageChange={(page) => loadDatabaseData(page, accidentsPage)}
          onViewDocuments={setDocumentsPreview}
          onOpenHistory={setHistoryPreview}
          onEdit={canEditSubscribers ? handleEdit : () => alert("لا يوجد لديك صلاحية التعديل")}
          onDelete={canDeleteSubscribers ? handleDelete : () => alert("لا يوجد لديك صلاحية الحذف")}
        />
      );
    }

    if (activeMenu === "subscriber-history") {
      return (
        <SubscriberHistoryDashboard
          subscribers={filteredSubscribers(subscribers)}
          loading={loading}
          onOpenHistory={setHistoryPreview}
        />
      );
    }

    if (activeMenu === "renewals-this-month") {
      return (
        <RenewalsTable
          data={filteredSubscribers(renewalsThisMonth)}
          loading={loading}
          onRenew={handleRenewSubscriber}
          onTerminate={handleTerminateSubscriber}
          onOpenHistory={setHistoryPreview}
          onViewDocuments={setDocumentsPreview}
          isRenewed={hasRenewalForSubscriber}
        />
      );
    }

    if (activeMenu === "add-new-subscriber") {
      if (!canCreateSubscribers && !editingSubscriber) {
        return <div className="mt-8 rounded-3xl border border-rose-200 bg-rose-50 p-8 text-center font-bold text-rose-700">لا يوجد لديك صلاحية إضافة مشترك</div>;
      }
      if (editingSubscriber && !canEditSubscribers) {
        return <div className="mt-8 rounded-3xl border border-rose-200 bg-rose-50 p-8 text-center font-bold text-rose-700">لا يوجد لديك صلاحية تعديل مشترك</div>;
      }
      return (
        <SubscriberForm
          initialSubscriber={editingSubscriber}
          onSave={handleSaveSubscriber}
          onCancel={
            editingSubscriber
              ? () => {
                  setEditingSubscriber(null);
                  navigateToMenu("active-subscribers");
                }
              : undefined
          }
        />
      );
    }

    if (activeMenu === "import") {
      if (!canCreateSubscribers) {
        return <div className="mt-8 rounded-3xl border border-rose-200 bg-rose-50 p-8 text-center font-bold text-rose-700">لا يوجد لديك صلاحية الاستيراد</div>;
      }
      return <ImportDashboard canImport={canCreateSubscribers} />;
    }

    if (activeMenu === "accounting") {
      if (!canViewAccounting) {
        return <div className="mt-8 rounded-3xl border border-rose-200 bg-rose-50 p-8 text-center font-bold text-rose-700">لا يوجد لديك صلاحية عرض الحسابات</div>;
      }
      return (
        <AccountingDashboard
          subscribers={filteredSubscribers(subscribers)}
          loading={loading}
          onEdit={canEditPayments ? handleEdit : () => alert("لا يوجد لديك صلاحية تعديل المدفوعات")}
          canExport={canViewAccounting}
        />
      );
    }

    if (activeMenu === "tasks") {
      if (!canViewSubscribers) {
        return <div className="mt-8 rounded-3xl border border-rose-200 bg-rose-50 p-8 text-center font-bold text-rose-700">لا يوجد لديك صلاحية عرض المهام</div>;
      }
      return (
        <TasksDashboard
          subscribers={filteredSubscribers(subscribers)}
          canEdit={canEditSubscribers}
        />
      );
    }

    if (activeMenu === "calendar") {
      if (!canViewSubscribers) {
        return <div className="mt-8 rounded-3xl border border-rose-200 bg-rose-50 p-8 text-center font-bold text-rose-700">لا يوجد لديك صلاحية عرض التقويم</div>;
      }
      return <CalendarDashboard />;
    }

    if (activeMenu === "deals") {
      if (!canViewSubscribers) {
        return <div className="mt-8 rounded-3xl border border-rose-200 bg-rose-50 p-8 text-center font-bold text-rose-700">لا يوجد لديك صلاحية عرض الصفقات</div>;
      }
      return (
        <DealsPipeline
          subscribers={filteredSubscribers(subscribers)}
          canEdit={canEditSubscribers}
        />
      );
    }

    if (activeMenu === "quotes") {
      if (!canViewSubscribers) {
        return <div className="mt-8 rounded-3xl border border-rose-200 bg-rose-50 p-8 text-center font-bold text-rose-700">لا يوجد لديك صلاحية عرض العروض</div>;
      }
      return (
        <QuotesDashboard
          subscribers={filteredSubscribers(subscribers)}
          canEdit={canEditSubscribers}
        />
      );
    }

    if (activeMenu === "invoices") {
      if (!canViewAccounting) {
        return <div className="mt-8 rounded-3xl border border-rose-200 bg-rose-50 p-8 text-center font-bold text-rose-700">لا يوجد لديك صلاحية عرض الفواتير</div>;
      }
      return (
        <InvoicesDashboard
          subscribers={filteredSubscribers(subscribers)}
          canEdit={canEditPayments}
        />
      );
    }

    if (activeMenu === "reports") {
      if (!canViewAccounting) {
        return <div className="mt-8 rounded-3xl border border-rose-200 bg-rose-50 p-8 text-center font-bold text-rose-700">لا يوجد لديك صلاحية عرض التقارير</div>;
      }
      return <ReportsDashboard />;
    }

    if (activeMenu === "user-management") {
      return <UsersManagementDashboard currentUser={currentUser} />;
    }

    if (activeMenu === "role-templates") {
      if (!canViewUsers) {
        return <div className="mt-8 rounded-3xl border border-rose-200 bg-rose-50 p-8 text-center font-bold text-rose-700">لا يوجد لديك صلاحية عرض قوالب الأدوار</div>;
      }
      return <RoleTemplatesDashboard canEdit={canEditUsers} />;
    }

    if (activeMenu === "settings") {
      if (!canEditUsers) {
        return <div className="mt-8 rounded-3xl border border-rose-200 bg-rose-50 p-8 text-center font-bold text-rose-700">لا يوجد لديك صلاحية تعديل الإعدادات</div>;
      }
      return <SettingsDashboard canEdit={canEditUsers} />;
    }

    if (activeMenu === "automation") {
      if (!canEditUsers) {
        return <div className="mt-8 rounded-3xl border border-rose-200 bg-rose-50 p-8 text-center font-bold text-rose-700">لا يوجد لديك صلاحية إدارة الأتمتة</div>;
      }
      return <AutomationDashboard canEdit={canEditUsers} />;
    }

    if (activeMenu === "integrations") {
      if (!canEditUsers) {
        return <div className="mt-8 rounded-3xl border border-rose-200 bg-rose-50 p-8 text-center font-bold text-rose-700">لا يوجد لديك صلاحية إدارة التكاملات</div>;
      }
      return <IntegrationsDashboard canEdit={canEditUsers} />;
    }

    if (activeMenu === "products") {
      if (!canViewSubscribers) {
        return <div className="mt-8 rounded-3xl border border-rose-200 bg-rose-50 p-8 text-center font-bold text-rose-700">لا يوجد لديك صلاحية عرض المنتجات</div>;
      }
      return <ProductsDashboard canEdit={canEditSubscribers} />;
    }

    if (activeMenu === "contracts") {
      if (!canViewSubscribers) {
        return <div className="mt-8 rounded-3xl border border-rose-200 bg-rose-50 p-8 text-center font-bold text-rose-700">لا يوجد لديك صلاحية عرض العقود</div>;
      }
      return (
        <ContractsDashboard
          subscribers={filteredSubscribers(subscribers)}
          canEdit={canEditSubscribers}
        />
      );
    }

    if (activeMenu === "archived-customers") {
      if (!canEditSubscribers) {
        return <div className="mt-8 rounded-3xl border border-rose-200 bg-rose-50 p-8 text-center font-bold text-rose-700">لا يوجد لديك صلاحية عرض الأرشيف</div>;
      }
      return (
        <ArchivedCustomersDashboard
          canEdit={canEditSubscribers}
          canDelete={canDeleteSubscribers}
          onRestored={() => loadDatabaseData(customersPage, accidentsPage)}
        />
      );
    }

    if (activeMenu === "files") {
      if (!canViewSubscribers) {
        return <div className="mt-8 rounded-3xl border border-rose-200 bg-rose-50 p-8 text-center font-bold text-rose-700">لا يوجد لديك صلاحية عرض الملفات</div>;
      }
      return (
        <FilesDashboard
          subscribers={filteredSubscribers(subscribers)}
          canEdit={canEditSubscribers}
        />
      );
    }

    if (activeMenu === "inbox") {
      if (!canViewSubscribers) {
        return <div className="mt-8 rounded-3xl border border-rose-200 bg-rose-50 p-8 text-center font-bold text-rose-700">لا يوجد لديك صلاحية عرض صندوق التواصل</div>;
      }
      return <InboxDashboard canSend={canEditSubscribers} />;
    }

    if (activeMenu === "activity-log") {
      return (
        <>
          <ActivityLogDashboard currentUser={currentUser} />
          <FieldAuditDashboard />
        </>
      );
    }

    return (
      <>
        <div className="mt-8 flex justify-end">
          {canCreateAccidents && <button
            type="button"
            onClick={() => setAddAccidentOpen(true)}
            className="flex items-center gap-2 rounded-2xl bg-[#3B82F6] px-6 py-3 font-bold text-white shadow-sm transition hover:opacity-90"
          >
            <Plus className="h-5 w-5" />
            إضافة حالة جديدة
          </button>}
        </div>

        <AccidentTable
          data={accidentCases}
          labels={vocabulary}
          loading={loading}
          pagination={accidentsPagination}
          onPageChange={(page) => loadDatabaseData(customersPage, page)}
          onOpenCase={(accident) => canEditAccidents ? setSelectedAccident(accident) : alert("لا يوجد لديك صلاحية تعديل الحوادث")}
        />
      </>
    );
  }, [
    activeMenu,
    subscribers,
    search,
    editingSubscriber,
    loading,
    renewalsThisMonth,
    accidentCases,
    handleRenewSubscriber,
    handleTerminateSubscriber,
    currentUser,
    canEditSubscribers,
    canDeleteSubscribers,
    canCreateSubscribers,
    canViewAccounting,
    canEditPayments,
    canCreateAccidents,
    canEditAccidents,
    navigateToMenu,
  ]);

  return (
    <div dir="rtl" className="min-h-screen bg-[#F7F8FA] text-[#1F2937]">
      <div className="flex min-h-screen">
        <CrmSidebar
          activeMenu={activeMenu}
          onNavigate={sidebarNavigate}
          open={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          branding={{ ...branding, isDemo: isDemoTenant }}
          canCreateSubscribers={canCreateSubscribers}
          canViewSubscribers={canViewSubscribers}
          canEditSubscribers={canEditSubscribers}
          canViewAccidents={canViewAccidents}
          canViewAccounting={canViewAccounting}
          canViewUsers={canViewUsers}
          canEditUsers={canEditUsers}
          canViewActivityLog={canViewActivityLog}
          renewalsThisMonthCount={renewalsThisMonthCount}
          isMaster={isMaster}
        />

        <main className="min-w-0 flex-1">
          <div className="sticky top-0 z-40 border-b border-[#EAECEF] bg-white px-4 py-4 shadow-sm sm:px-6 sm:py-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2 sm:gap-3">
                <button
                  type="button"
                  onClick={() => setSidebarOpen(true)}
                  aria-label="القائمة"
                  className="rounded-xl p-2 text-[#475569] hover:bg-gray-100 lg:hidden"
                >
                  <Menu className="h-5 w-5" />
                </button>
                <ProfileDropdown user={currentUser} />

                <div className="relative">
                  <button
                    className={`relative rounded-xl p-2 text-[#707A84] hover:bg-gray-100 ${
                      notificationsOpen ? "bg-gray-100" : ""
                    }`}
                    title="التنبيهات"
                    onClick={() => setNotificationsOpen((prev) => !prev)}
                  >
                    <Bell />

                    {notificationCount > 0 && (
                      <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-500 px-1 text-[11px] font-bold text-white">
                        {notificationCount}
                      </span>
                    )}
                  </button>

                  <CrmNotificationsPanel
                    open={notificationsOpen}
                    onClose={() => setNotificationsOpen(false)}
                    onNavigate={(section) => {
                      navigateToMenu(section);
                      setNotificationsOpen(false);
                    }}
                  />
                </div>
              </div>

              <div className="relative order-last w-full sm:order-none sm:w-[340px]">
                <Search className="absolute right-3 top-3 h-4 w-4 text-gray-400" />
                <input
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setGlobalSearchOpen(true);
                  }}
                  onFocus={() => setGlobalSearchOpen(true)}
                  onKeyDown={(e) => {
                    if (e.key === "Escape") setGlobalSearchOpen(false);
                  }}
                  className="h-10 w-full rounded-xl border border-[#E5E7EB] pr-10 text-[#1F2937] outline-none focus:border-[#3B82F6]"
                  placeholder={vocabulary.searchPlaceholder}
                />
                <GlobalSearchPanel
                  query={search}
                  open={globalSearchOpen}
                  onClose={() => setGlobalSearchOpen(false)}
                  onNavigate={(section, queryValue) => {
                    setSearch(queryValue);
                    navigateToMenu(section);
                    setGlobalSearchOpen(false);
                  }}
                />
              </div>
            </div>
          </div>

          <div className="p-4 sm:p-6 lg:p-8">
            {activeMenu !== "dashboard" && (
              <div className="flex flex-wrap items-start justify-between gap-5">
                <div className="text-right">
                  <h1 className="text-3xl font-bold tracking-tight text-[#1F2937]">{pageTitle}</h1>
                  <p className="mt-3 max-w-4xl text-[15px] leading-7 text-[#707A84]">
                    {getPageDescriptionForTenant(activeMenu, isDemoTenant)}
                  </p>
                </div>

                <div
                  dir="ltr"
                  className="shrink-0 rounded-2xl border border-[#EAECEF] bg-white px-5 py-3 text-sm font-medium text-[#4B5563] shadow-sm"
                >
                  <CalendarDays className="me-2 inline h-4 w-4 text-[#3B82F6]" />
                  {formatHeaderDate()}
                </div>
              </div>
            )}

            {sheetError && (
              <div className="mt-6 rounded-2xl border border-rose-200 bg-rose-50 px-5 py-3 text-rose-700">
                {sheetError}
              </div>
            )}

            {INSIGHT_MENUS.includes(activeMenu) && (
              <div className="mt-8 grid grid-cols-1 gap-5 md:grid-cols-5">
                <StatCard label={vocabulary.kpiActiveAccounts} value={dashboardStats?.activePolicies ?? activeSubscribers.length} helper={vocabulary.kpiActiveAccountsHelper} />
                <StatCard label={vocabulary.activeCustomers} value={dashboardStats?.activeCustomers ?? customerNodes.filter((customer) => customer.cars.some((car) => car.insuranceStatus === "فعال")).length}                 helper={isDemoTenant ? "عملاء بخدمة فعّالة" : "عملاء لديهم تأمين"} />
                <StatCard label="عملاء بالسجل" value={dashboardStats?.totalCustomers ?? customerNodes.length} helper="إجمالي السجل" />
                <StatCard
                  label={isDemoTenant ? "بلاغات مفتوحة" : "حوادث مفتوحة"}
                  value={dashboardStats?.openAccidents ?? accidentCases.filter((a) => a.status === "مفتوح").length}
                  helper={isDemoTenant ? "تذاكر دعم" : "قيد المتابعة"}
                />
                <StatCard
                  label={isDemoTenant ? "متابعات الشهر" : "تجديدات هذا الشهر"}
                  value={dashboardStats?.renewalsThisMonth ?? renewalsThisMonthCount}
                  helper={isDemoTenant ? "عملاء للمتابعة" : "مواعيد التجديد"}
                />
              </div>
            )}

            {INSIGHT_MENUS.includes(activeMenu) && (
              <DashboardInsights
                mode={activeMenu}
                isDemo={isDemoTenant}
                allSubscribers={filteredSubscribers(subscribers)}
                insightsData={menuInsights}
                totalRecords={menuInsights?.totalRecords ?? customersPagination?.total ?? null}
                subscribers={
                  activeMenu === "active-subscribers"
                    ? filteredSubscribers(activeSubscribers)
                    : activeMenu === "active-customers"
                    ? filteredSubscribers(activeSubscribers)
                    : activeMenu === "inactive-subscribers"
                    ? filteredSubscribers(inactiveSubscribers)
                    : activeMenu === "renewals-this-month"
                    ? filteredSubscribers(renewalsThisMonth)
                    : filteredSubscribers(subscribers)
                }
                title={
                  activeMenu === "active-subscribers"
                    ? `إحصائيات ${vocabulary.activePolicies}`
                    : activeMenu === "active-customers"
                    ? `إحصائيات ${vocabulary.activeCustomers}`
                    : activeMenu === "inactive-subscribers"
                    ? `إحصائيات ${vocabulary.inactiveCustomers}`
                    : activeMenu === "subscriber-history"
                    ? `إحصائيات ${vocabulary.fullHistory}`
                    : activeMenu === "renewals-this-month"
                    ? `إحصائيات ${vocabulary.renewalsThisMonth}`
                    : "إحصائيات الحسابات"
                }
              />
            )}

            {content}
          </div>
        </main>
      </div>

      {documentsPreview && (
        <DocumentsModal
          subscriber={documentsPreview}
          onClose={() => setDocumentsPreview(null)}
        />
      )}

      {dupOpen && (
        <DuplicatesModal
          onClose={() => setDupOpen(false)}
          onCleaned={() => loadDatabaseData()}
        />
      )}

      {historyPreview && (
        <CustomerHistoryModal
          subscriber={historyPreview}
          subscribers={subscribers}
          onClose={() => setHistoryPreview(null)}
          onViewDocuments={(subscriber) => {
            setDocumentsPreview(subscriber);
          }}
          canEdit={canEditSubscribers}
        />
      )}

      {addAccidentOpen && (
        <AddAccidentModal
          customers={customerNodes}
          onClose={() => setAddAccidentOpen(false)}
          onSave={handleAddAccident}
        />
      )}

      {selectedAccident && (
        <AccidentDetailsModal
          accident={selectedAccident}
          onClose={() => setSelectedAccident(null)}
          onSave={handleSaveAccidentDetails}
          canDelete={canDeleteAccidents}
          onDelete={handleDeleteAccident}
        />
      )}
    </div>
  );
}

"use client";

import {
  AlertTriangle,
  ArrowUpRight,
  ClipboardList,
  FileText,
  Inbox,
  Loader2,
  Plus,
  Shield,
  Target,
  TrendingUp,
  Users,
  Wallet,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { KpiCard } from "@/components/crm/kpi-card";
import { REPORTS_SUMMARY_API_URL } from "@/lib/crm/constants";
import { getCrmVocabulary } from "@/lib/crm/vocabulary";
import { dealStageLabels } from "@/lib/crm/deals";
import type { MenuKey } from "@/lib/menu-navigation";
import { chartColors } from "@/lib/crm/design-tokens";
import { formatMoney } from "@/lib/crm/utils";

type ReportsSummary = {
  customers: { totalCustomers: number; activeCustomers: number };
  insurance: { activePolicies: number; expiredPolicies: number; totalRevenue: number; totalRemaining: number };
  deals: { openDeals: number; wonDeals: number; pipelineValue: number };
  invoices: { totalInvoices: number; unpaidInvoices: number; invoiceRevenue: number; overdueInvoices: number };
  tasks: { pendingTasks: number; doneTasks: number };
  revenueByMonth: { month: string; revenue: number }[];
  dealsByStage: { stage: string; count: number; value: number }[];
};

export function ExecutiveDashboard({
  username,
  onNavigate,
  canCreateSubscribers,
  canViewAccounting = false,
  isDemo = false,
}: {
  username?: string;
  onNavigate: (key: MenuKey) => void;
  canCreateSubscribers: boolean;
  canViewAccounting?: boolean;
  isDemo?: boolean;
}) {
  const vocabulary = getCrmVocabulary(isDemo);
  const [data, setData] = useState<ReportsSummary | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(REPORTS_SUMMARY_API_URL, { cache: "no-store" });
      if (res.ok) setData(await res.json());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const dealChart =
    data?.dealsByStage.map((item) => ({
      name: dealStageLabels[item.stage as keyof typeof dealStageLabels] || item.stage,
      value: item.count,
    })) || [];

  const alerts = [
    canViewAccounting && data && data.invoices.overdueInvoices > 0
      ? { text: `${data.invoices.overdueInvoices} فاتورة متأخرة`, action: "invoices" as MenuKey, tone: "rose" }
      : null,
    canViewAccounting && data && data.insurance.totalRemaining > 0
      ? { text: `${formatMoney(data.insurance.totalRemaining)} متبقي للتحصيل`, action: "accounting" as MenuKey, tone: "amber" }
      : null,
    data && data.tasks.pendingTasks > 0
      ? { text: `${data.tasks.pendingTasks} مهمة تحتاج متابعة`, action: "tasks" as MenuKey, tone: "blue" }
      : null,
  ].filter(Boolean) as { text: string; action: MenuKey; tone: string }[];

  const quickActions = [
    { label: vocabulary.quickActionAccounts, key: "active-subscribers" as MenuKey, icon: Shield },
    { label: "صفقة جديدة", key: "deals" as MenuKey, icon: Target },
    { label: "المهام", key: "tasks" as MenuKey, icon: AlertTriangle },
    { label: "صندوق الوارد", key: "inbox" as MenuKey, icon: Inbox },
    ...(canViewAccounting
      ? [
          { label: "الفواتير", key: "invoices" as MenuKey, icon: FileText },
          { label: "التقارير", key: "reports" as MenuKey, icon: TrendingUp },
        ]
      : []),
  ];

  return (
    <section className="space-y-6">
      <div className="rounded-[28px] border border-[#EAECEF] bg-gradient-to-l from-[#EFF4FF] via-white to-white p-6 shadow-sm md:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-[#3B82F6]">لوحة التحكم التنفيذية</p>
            <h2 className="mt-1 text-2xl font-bold text-[#1F2937] md:text-3xl">
              مرحباً{username ? `، ${username}` : ""}
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-7 text-[#707A84]">
              {vocabulary.dashboardSubtitle}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {canCreateSubscribers && (
              <button
                type="button"
                onClick={() => onNavigate("add-new-subscriber")}
                className="inline-flex items-center gap-2 rounded-2xl bg-[#3B82F6] px-4 py-2.5 text-sm font-bold text-white shadow-sm"
              >
                <Plus className="h-4 w-4" />
                {vocabulary.addCustomer}
              </button>
            )}
            {canViewAccounting && (
              <button
                type="button"
                onClick={() => onNavigate("reports")}
                className="inline-flex items-center gap-2 rounded-2xl border border-[#E5E7EB] bg-white px-4 py-2.5 text-sm font-bold text-[#334155]"
              >
                التقارير
                <ArrowUpRight className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      </div>

      {alerts.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {alerts.map((alert) => (
            <button
              key={alert.text}
              type="button"
              onClick={() => onNavigate(alert.action)}
              className={`rounded-full px-4 py-2 text-xs font-bold ${
                alert.tone === "rose"
                  ? "bg-rose-50 text-rose-700"
                  : alert.tone === "amber"
                  ? "bg-amber-50 text-amber-700"
                  : "bg-blue-50 text-blue-700"
              }`}
            >
              {alert.text}
            </button>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label={vocabulary.kpiActiveAccounts}
          value={data?.insurance.activePolicies ?? 0}
          helper={vocabulary.kpiActiveAccountsHelper}
          icon={Shield}
          accent="blue"
          loading={loading}
          onClick={() => onNavigate("active-subscribers")}
        />
        <KpiCard
          label="عملاء نشطون"
          value={data?.customers.activeCustomers ?? 0}
          helper={`من ${data?.customers.totalCustomers ?? 0} إجمالي`}
          icon={Users}
          accent="teal"
          loading={loading}
          onClick={() => onNavigate("active-customers")}
        />
        <KpiCard
          label="مهام اليوم"
          value={data?.tasks.pendingTasks ?? 0}
          helper={`${data?.tasks.doneTasks ?? 0} مكتملة`}
          icon={ClipboardList}
          accent="blue"
          loading={loading}
          onClick={() => onNavigate("tasks")}
        />
        <KpiCard
          label="صندوق التواصل"
          value="واتساب · بريد"
          helper="رسائل العملاء"
          icon={Inbox}
          accent="violet"
          onClick={() => onNavigate("inbox")}
        />

        {canViewAccounting && (
          <>
            <KpiCard
              label={vocabulary.kpiRevenue}
              value={data ? formatMoney(data.insurance.totalRevenue) : "—"}
              helper="محصّل"
              icon={Wallet}
              accent="teal"
              loading={loading}
              onClick={() => onNavigate("accounting")}
            />
            <KpiCard
              label="قيمة الصفقات"
              value={data ? formatMoney(data.deals.pipelineValue) : "—"}
              helper={`${data?.deals.openDeals ?? 0} صفقة مفتوحة`}
              icon={Target}
              accent="violet"
              loading={loading}
              onClick={() => onNavigate("deals")}
            />
            <KpiCard
              label={vocabulary.kpiCollectionRemaining}
              value={data ? formatMoney(data.insurance.totalRemaining) : "—"}
              helper="جباية"
              icon={TrendingUp}
              accent="amber"
              loading={loading}
              onClick={() => onNavigate("accounting")}
            />
            <KpiCard
              label="فواتير معلقة"
              value={data?.invoices.unpaidInvoices ?? 0}
              helper={`${data?.invoices.overdueInvoices ?? 0} متأخرة`}
              icon={FileText}
              accent="rose"
              loading={loading}
              onClick={() => onNavigate("invoices")}
            />
          </>
        )}
      </div>

      <div className={`grid grid-cols-1 gap-5 ${canViewAccounting ? "lg:grid-cols-3" : "lg:grid-cols-1"}`}>
        {canViewAccounting && (
          <div className="rounded-[28px] border border-[#EAECEF] bg-white p-6 shadow-sm lg:col-span-2">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-bold text-[#1F2937]">{vocabulary.revenueChartTitle}</h3>
            </div>
            {loading ? (
              <div className="flex h-[280px] items-center justify-center text-[#94A3B8]">
                <Loader2 className="h-5 w-5 animate-spin" />
              </div>
            ) : (
              <div className="h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data?.revenueByMonth || []}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                    <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip formatter={(v) => formatMoney(Number(v))} />
                    <Bar dataKey="revenue" fill="#3B82F6" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        )}

        <div className="rounded-[28px] border border-[#EAECEF] bg-white p-6 shadow-sm">
          <h3 className="mb-4 text-lg font-bold text-[#1F2937]">مسار الصفقات</h3>
          {loading ? (
            <div className="flex h-[280px] items-center justify-center">
              <Loader2 className="h-5 w-5 animate-spin text-[#94A3B8]" />
            </div>
          ) : dealChart.length ? (
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={dealChart} dataKey="value" nameKey="name" innerRadius={55} outerRadius={90}>
                    {dealChart.map((_, i) => (
                      <Cell key={i} fill={chartColors[i % chartColors.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="flex h-[280px] items-center justify-center text-sm text-[#94A3B8]">
              لا توجد صفقات بعد
            </div>
          )}
        </div>
      </div>

      <div className="rounded-[28px] border border-[#EAECEF] bg-white p-6 shadow-sm">
        <h3 className="mb-4 text-lg font-bold text-[#1F2937]">إجراءات سريعة</h3>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-6">
          {quickActions.map((action) => (
            <button
              key={action.key}
              type="button"
              onClick={() => onNavigate(action.key)}
              className="flex flex-col items-center gap-2 rounded-2xl border border-[#F1F5F9] bg-[#FAFBFC] px-3 py-4 text-sm font-bold text-[#334155] transition hover:border-[#3B82F6]/20 hover:bg-[#EFF4FF]"
            >
              <action.icon className="h-5 w-5 text-[#3B82F6]" />
              {action.label}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}

"use client";

import { Loader2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { REPORTS_EXPORT_API_URL, REPORTS_SUMMARY_API_URL } from "@/lib/crm/constants";
import { dealStageLabels } from "@/lib/crm/deals";
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

export function ReportsDashboard() {
  const [data, setData] = useState<ReportsSummary | null>(null);
  const [loading, setLoading] = useState(true);

  const loadReports = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(REPORTS_SUMMARY_API_URL, { cache: "no-store" });
      const json = await res.json();
      if (res.ok) setData(json);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadReports();
  }, [loadReports]);

  if (loading) {
    return (
      <div className="mt-8 flex items-center justify-center rounded-[28px] border border-[#EAECEF] bg-white py-20 text-[#707A84]">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span className="me-2">جاري تحميل التقارير...</span>
      </div>
    );
  }

  if (!data) {
    return <div className="mt-8 rounded-[28px] border border-rose-200 bg-rose-50 p-8 text-center text-rose-700">تعذر تحميل التقارير</div>;
  }

  const dealChart = data.dealsByStage.map((item) => ({
    name: dealStageLabels[item.stage as keyof typeof dealStageLabels] || item.stage,
    count: item.count,
  }));

  return (
    <section className="mt-8 space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-[28px] border border-[#EAECEF] bg-white px-6 py-5 shadow-sm">
        <div>
          <h3 className="text-[22px] font-bold text-[#1F2937]">التقارير والتحليلات</h3>
          <p className="mt-1 text-sm text-[#707A84]">ملخص الأداء والإيرادات والصفقات</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {[
            { type: "sales", label: "تصدير المبيعات" },
            { type: "customers", label: "تصدير العملاء" },
            { type: "deals", label: "تصدير الصفقات" },
          ].map((item) => (
            <a
              key={item.type}
              href={`${REPORTS_EXPORT_API_URL}?type=${item.type}`}
              className="rounded-xl border border-[#E5E7EB] px-4 py-2 text-sm font-bold text-[#0F8B94]"
            >
              {item.label}
            </a>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "إيرادات التأمين", value: formatMoney(data.insurance.totalRevenue) },
          { label: "المتبقي", value: formatMoney(data.insurance.totalRemaining) },
          { label: "صفقات مفتوحة", value: String(data.deals.openDeals) },
          { label: "قيمة الأنبوب", value: formatMoney(data.deals.pipelineValue) },
          { label: "فواتير غير مدفوعة", value: String(data.invoices.unpaidInvoices) },
          { label: "مهام قيد التنفيذ", value: String(data.tasks.pendingTasks) },
          { label: "عملاء نشطون", value: String(data.customers.activeCustomers) },
          { label: "إيرادات الفواتير", value: formatMoney(data.invoices.invoiceRevenue) },
        ].map((card) => (
          <div key={card.label} className="rounded-[24px] border border-[#EAECEF] bg-white p-5 shadow-sm">
            <p className="text-sm text-[#707A84]">{card.label}</p>
            <p className="mt-2 text-2xl font-bold text-[#1F2937]">{card.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <div className="rounded-[28px] border border-[#EAECEF] bg-white p-6 shadow-sm">
          <h4 className="mb-4 text-lg font-bold text-[#1F2937]">الإيرادات الشهرية (6 أشهر)</h4>
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.revenueByMonth}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip formatter={(value) => formatMoney(Number(value))} />
                <Bar dataKey="revenue" fill="#0F8B94" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-[28px] border border-[#EAECEF] bg-white p-6 shadow-sm">
          <h4 className="mb-4 text-lg font-bold text-[#1F2937]">الصفقات حسب المرحلة</h4>
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dealChart}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="count" fill="#14B8A6" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </section>
  );
}

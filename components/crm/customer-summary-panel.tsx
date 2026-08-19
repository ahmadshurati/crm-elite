"use client";

import { Loader2, Sparkles } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import type { CustomerSummary } from "@/lib/crm/customer-summary";

export function CustomerSummaryPanel({ customerId }: { customerId: number }) {
  const [summary, setSummary] = useState<CustomerSummary | null>(null);
  const [loading, setLoading] = useState(true);

  const loadSummary = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/customers/${customerId}/summary`, { cache: "no-store" });
      const data = await res.json();
      if (res.ok) setSummary(data);
    } finally {
      setLoading(false);
    }
  }, [customerId]);

  useEffect(() => {
    loadSummary();
  }, [loadSummary]);

  return (
    <div className="mt-5 rounded-3xl border border-[#E5E7EB] bg-white p-6">
      <div className="flex items-center gap-2">
        <Sparkles className="h-5 w-5 text-[#3B82F6]" />
        <h4 className="text-xl font-bold text-[#1F2937]">ملخص ذكي للعميل</h4>
      </div>

      {loading ? (
        <div className="mt-4 flex items-center text-sm text-[#707A84]">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="me-2">جاري تحليل بيانات العميل...</span>
        </div>
      ) : !summary ? (
        <p className="mt-4 text-sm text-[#707A84]">تعذر إنشاء الملخص</p>
      ) : (
        <div className="mt-4 grid grid-cols-1 gap-5 lg:grid-cols-2">
          <div>
            <p className="mb-2 text-sm font-bold text-[#4B5563]">أبرز النقاط</p>
            <ul className="space-y-2 text-sm text-[#374151]">
              {summary.highlights.map((item) => (
                <li key={item} className="rounded-xl bg-[#FAFAFA] px-3 py-2">{item}</li>
              ))}
            </ul>
          </div>
          <div>
            <p className="mb-2 text-sm font-bold text-[#4B5563]">توصيات المتابعة</p>
            <ul className="space-y-2 text-sm text-[#3B82F6]">
              {summary.recommendations.map((item) => (
                <li key={item} className="rounded-xl bg-[#EFF4FF] px-3 py-2">{item}</li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}

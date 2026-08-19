"use client";

import { FileText, Loader2, Plus, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { QUOTES_API_URL } from "@/lib/crm/constants";
import type { LineItem } from "@/lib/crm/line-items";
import { QUOTE_STATUSES, quoteStatusLabels, type QuoteRecord } from "@/lib/crm/quotes";
import type { Subscriber } from "@/lib/crm/types";
import { formatMoney, todayString } from "@/lib/crm/utils";

const emptyLineItem = (): LineItem => ({
  description: "",
  quantity: 1,
  unitPrice: 0,
  total: 0,
});

const emptyForm = {
  title: "",
  customerId: "",
  status: "draft",
  taxRate: 0,
  discount: 0,
  validUntil: todayString(),
  notes: "",
  lineItems: [emptyLineItem()],
};

export function QuotesDashboard({
  subscribers,
  canEdit,
}: {
  subscribers: Subscriber[];
  canEdit: boolean;
}) {
  const [quotes, setQuotes] = useState<QuoteRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const customerOptions = useMemo(() => {
    const map = new Map<number, string>();
    subscribers.forEach((item) => {
      if (item.customerId) map.set(Number(item.customerId), item.subscriberName || `عميل #${item.customerId}`);
    });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [subscribers]);

  const loadQuotes = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(QUOTES_API_URL, { cache: "no-store" });
      const data = await res.json();
      if (res.ok) setQuotes(Array.isArray(data) ? data : []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadQuotes();
  }, [loadQuotes]);

  function updateLineItem(index: number, patch: Partial<LineItem>) {
    setForm((prev) => {
      const lineItems = prev.lineItems.map((item, i) => {
        if (i !== index) return item;
        const next = { ...item, ...patch };
        next.total = Number(next.quantity || 0) * Number(next.unitPrice || 0);
        return next;
      });
      return { ...prev, lineItems };
    });
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim() || !form.customerId) return;
    setSaving(true);
    try {
      const res = await fetch(QUOTES_API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        alert((await res.json()).error || "فشل إنشاء العرض");
        return;
      }
      setForm(emptyForm);
      setFormOpen(false);
      await loadQuotes();
    } finally {
      setSaving(false);
    }
  }

  async function updateStatus(quote: QuoteRecord, status: string) {
    if (!canEdit) return;
    await fetch(`${QUOTES_API_URL}/${quote.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    await loadQuotes();
  }

  async function deleteQuote(quote: QuoteRecord) {
    if (!canEdit || !confirm(`حذف ${quote.quoteNumber}؟`)) return;
    await fetch(`${QUOTES_API_URL}/${quote.id}`, { method: "DELETE" });
    await loadQuotes();
  }

  return (
    <section className="mt-8 space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-[28px] border border-[#EAECEF] bg-white px-6 py-5 shadow-sm">
        <div>
          <h3 className="text-[22px] font-bold text-[#1F2937]">عروض الأسعار</h3>
          <p className="mt-1 text-sm text-[#707A84]">إنشاء وإدارة عروض الأسعار للعملاء</p>
        </div>
        {canEdit && (
          <button type="button" onClick={() => setFormOpen((v) => !v)} className="flex items-center gap-2 rounded-2xl bg-[#2563EB] px-5 py-3 text-sm font-bold text-white">
            <Plus className="h-4 w-4" />{formOpen ? "إخفاء" : "عرض جديد"}
          </button>
        )}
      </div>

      {formOpen && canEdit && (
        <form onSubmit={handleCreate} className="space-y-4 rounded-[28px] border border-[#EAECEF] bg-white p-6">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <label className="block text-sm md:col-span-2">
              <span className="mb-1 block font-semibold">عنوان العرض</span>
              <input value={form.title} onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))} className="w-full rounded-xl border border-[#E5E7EB] px-3 py-2" />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block font-semibold">العميل</span>
              <select value={form.customerId} onChange={(e) => setForm((p) => ({ ...p, customerId: e.target.value }))} className="w-full rounded-xl border border-[#E5E7EB] px-3 py-2" required>
                <option value="">اختر العميل</option>
                {customerOptions.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
            </label>
            <label className="block text-sm">
              <span className="mb-1 block font-semibold">صالح حتى</span>
              <input type="date" value={form.validUntil} onChange={(e) => setForm((p) => ({ ...p, validUntil: e.target.value }))} className="w-full rounded-xl border border-[#E5E7EB] px-3 py-2" />
            </label>
          </div>
          {form.lineItems.map((item, index) => (
            <div key={index} className="grid grid-cols-1 gap-3 rounded-2xl bg-[#FAFAFA] p-4 md:grid-cols-4">
              <input placeholder="الوصف" value={item.description} onChange={(e) => updateLineItem(index, { description: e.target.value })} className="rounded-xl border border-[#E5E7EB] px-3 py-2 md:col-span-2" />
              <input type="number" placeholder="الكمية" value={item.quantity} onChange={(e) => updateLineItem(index, { quantity: Number(e.target.value) })} className="rounded-xl border border-[#E5E7EB] px-3 py-2" />
              <input type="number" placeholder="السعر" value={item.unitPrice} onChange={(e) => updateLineItem(index, { unitPrice: Number(e.target.value) })} className="rounded-xl border border-[#E5E7EB] px-3 py-2" />
            </div>
          ))}
          <button type="submit" disabled={saving} className="rounded-xl bg-[#2563EB] px-5 py-2 text-sm font-bold text-white">{saving ? "جاري الحفظ..." : "حفظ العرض"}</button>
        </form>
      )}

      <div className="rounded-[28px] border border-[#EAECEF] bg-white shadow-sm">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-[#707A84]"><Loader2 className="h-5 w-5 animate-spin" /></div>
        ) : quotes.length === 0 ? (
          <p className="py-16 text-center text-[#707A84]">لا توجد عروض</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-[980px] w-full text-right text-sm">
              <thead>
                <tr className="border-b border-[#EEF1F4] text-[#8B95A1]">
                  <th className="px-4 py-3">الرقم</th><th className="px-4 py-3">العنوان</th><th className="px-4 py-3">العميل</th><th className="px-4 py-3">الإجمالي</th><th className="px-4 py-3">الحالة</th><th className="px-4 py-3">إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {quotes.map((quote) => (
                  <tr key={quote.id} className="border-b border-[#F1F5F9]">
                    <td className="px-4 py-4 font-semibold">{quote.quoteNumber}</td>
                    <td className="px-4 py-4">{quote.title}</td>
                    <td className="px-4 py-4">{quote.customerName}</td>
                    <td className="px-4 py-4">{formatMoney(quote.total)}</td>
                    <td className="px-4 py-4">{quoteStatusLabels[quote.status as keyof typeof quoteStatusLabels] || quote.status}</td>
                    <td className="px-4 py-4">
                      <div className="flex flex-wrap gap-2">
                        <a href={`${QUOTES_API_URL}/${quote.id}?format=print`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-lg bg-[#EFF4FF] px-3 py-1 text-xs font-bold text-[#2563EB]"><FileText className="h-3.5 w-3.5" />PDF</a>
                        {canEdit && QUOTE_STATUSES.filter((s) => s !== quote.status).slice(0, 2).map((status) => (
                          <button key={status} type="button" onClick={() => updateStatus(quote, status)} className="rounded-lg bg-[#F3F4F6] px-2 py-1 text-[10px] font-bold">{quoteStatusLabels[status]}</button>
                        ))}
                        {canEdit && <button type="button" onClick={() => deleteQuote(quote)} className="rounded-lg bg-rose-50 p-1.5 text-rose-600"><Trash2 className="h-4 w-4" /></button>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}

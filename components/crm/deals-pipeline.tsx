"use client";

import { Loader2, Plus, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { DEALS_API_URL } from "@/lib/crm/constants";
import {
  DEAL_STAGES,
  dealStageLabels,
  type DealRecord,
} from "@/lib/crm/deals";
import type { Subscriber } from "@/lib/crm/types";
import { formatMoney, todayString } from "@/lib/crm/utils";

const stageColors: Record<string, string> = {
  "new-lead": "border-slate-200 bg-slate-50",
  contacted: "border-blue-200 bg-blue-50",
  proposal: "border-violet-200 bg-violet-50",
  negotiation: "border-amber-200 bg-amber-50",
  won: "border-emerald-200 bg-emerald-50",
  lost: "border-rose-200 bg-rose-50",
};

const emptyForm = {
  title: "",
  customerId: "",
  stage: "new-lead",
  value: 0,
  probability: 20,
  expectedClose: todayString(),
  notes: "",
};

export function DealsPipeline({
  subscribers,
  canEdit,
}: {
  subscribers: Subscriber[];
  canEdit: boolean;
}) {
  const [deals, setDeals] = useState<DealRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const customerOptions = useMemo(() => {
    const map = new Map<number, string>();
    subscribers.forEach((item) => {
      if (item.customerId) {
        map.set(Number(item.customerId), item.subscriberName || `عميل #${item.customerId}`);
      }
    });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [subscribers]);

  const loadDeals = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(DEALS_API_URL, { cache: "no-store" });
      const data = await res.json();
      if (res.ok) {
        setDeals(Array.isArray(data) ? data : []);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDeals();
  }, [loadDeals]);

  const dealsByStage = useMemo(() => {
    const map = Object.fromEntries(DEAL_STAGES.map((stage) => [stage, [] as DealRecord[]])) as Record<
      string,
      DealRecord[]
    >;
    deals.forEach((deal) => {
      const stage = DEAL_STAGES.includes(deal.stage as (typeof DEAL_STAGES)[number])
        ? deal.stage
        : "new-lead";
      map[stage].push(deal);
    });
    return map;
  }, [deals]);

  const pipelineValue = useMemo(
    () => deals.reduce((sum, deal) => sum + Number(deal.value || 0), 0),
    [deals]
  );

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim() || !form.customerId) {
      alert("العنوان والعميل مطلوبان");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(DEALS_API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      if (!res.ok) {
        const data = await res.json();
        alert(data.error || "فشل إنشاء الصفقة");
        return;
      }

      setForm(emptyForm);
      setFormOpen(false);
      await loadDeals();
    } catch (error) {
      console.error(error);
      alert("فشل إنشاء الصفقة");
    } finally {
      setSaving(false);
    }
  }

  async function moveDeal(deal: DealRecord, stage: string) {
    if (!canEdit) return;

    try {
      const res = await fetch(`${DEALS_API_URL}/${deal.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stage }),
      });

      if (res.ok) {
        await loadDeals();
      }
    } catch (error) {
      console.error(error);
    }
  }

  async function deleteDeal(deal: DealRecord) {
    if (!canEdit || !confirm(`حذف الصفقة: ${deal.title}؟`)) return;

    try {
      const res = await fetch(`${DEALS_API_URL}/${deal.id}`, { method: "DELETE" });
      if (res.ok) {
        await loadDeals();
      }
    } catch (error) {
      console.error(error);
    }
  }

  return (
    <section className="mt-8 space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-[28px] border border-[#EAECEF] bg-white px-6 py-5 shadow-sm">
        <div>
          <h3 className="text-[22px] font-bold text-[#1F2937]">مسار الصفقات</h3>
          <p className="mt-1 text-sm text-[#707A84]">
            إجمالي قيمة الأنبوب: <span className="font-bold text-[#0F8B94]">{formatMoney(pipelineValue)}</span>
          </p>
        </div>
        {canEdit && (
          <button
            type="button"
            onClick={() => setFormOpen((value) => !value)}
            className="flex items-center gap-2 rounded-2xl bg-[#0F8B94] px-5 py-3 text-sm font-bold text-white"
          >
            <Plus className="h-4 w-4" />
            {formOpen ? "إخفاء" : "صفقة جديدة"}
          </button>
        )}
      </div>

      {formOpen && canEdit && (
        <form onSubmit={handleCreate} className="grid grid-cols-1 gap-4 rounded-[28px] border border-[#EAECEF] bg-white p-6 md:grid-cols-2">
          <label className="block text-sm md:col-span-2">
            <span className="mb-1 block font-semibold">عنوان الصفقة</span>
            <input
              value={form.title}
              onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
              className="w-full rounded-xl border border-[#E5E7EB] px-3 py-2"
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-semibold">العميل</span>
            <select
              value={form.customerId}
              onChange={(e) => setForm((prev) => ({ ...prev, customerId: e.target.value }))}
              className="w-full rounded-xl border border-[#E5E7EB] px-3 py-2"
              required
            >
              <option value="">اختر العميل</option>
              {customerOptions.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-semibold">المرحلة</span>
            <select
              value={form.stage}
              onChange={(e) => setForm((prev) => ({ ...prev, stage: e.target.value }))}
              className="w-full rounded-xl border border-[#E5E7EB] px-3 py-2"
            >
              {DEAL_STAGES.map((stage) => (
                <option key={stage} value={stage}>
                  {dealStageLabels[stage]}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-semibold">القيمة</span>
            <input
              type="number"
              value={form.value}
              onChange={(e) => setForm((prev) => ({ ...prev, value: Number(e.target.value) }))}
              className="w-full rounded-xl border border-[#E5E7EB] px-3 py-2"
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-semibold">احتمال الإغلاق %</span>
            <input
              type="number"
              min={0}
              max={100}
              value={form.probability}
              onChange={(e) => setForm((prev) => ({ ...prev, probability: Number(e.target.value) }))}
              className="w-full rounded-xl border border-[#E5E7EB] px-3 py-2"
            />
          </label>
          <label className="block text-sm md:col-span-2">
            <span className="mb-1 block font-semibold">ملاحظات</span>
            <textarea
              value={form.notes}
              onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
              rows={2}
              className="w-full rounded-xl border border-[#E5E7EB] px-3 py-2"
            />
          </label>
          <div className="md:col-span-2">
            <button
              type="submit"
              disabled={saving}
              className="rounded-xl bg-[#0F8B94] px-5 py-2 text-sm font-bold text-white disabled:opacity-60"
            >
              {saving ? "جاري الحفظ..." : "حفظ الصفقة"}
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="flex items-center justify-center rounded-[28px] border border-[#EAECEF] bg-white py-20 text-[#707A84]">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span className="me-2">جاري تحميل الصفقات...</span>
        </div>
      ) : (
        <div className="overflow-x-auto pb-2">
          <div className="flex min-w-[1100px] gap-4">
            {DEAL_STAGES.map((stage) => (
              <div
                key={stage}
                className={`w-[280px] shrink-0 rounded-[24px] border p-4 ${stageColors[stage] || "border-[#EAECEF] bg-white"}`}
              >
                <div className="mb-4 flex items-center justify-between">
                  <h4 className="font-bold text-[#1F2937]">{dealStageLabels[stage]}</h4>
                  <span className="rounded-full bg-white px-2 py-0.5 text-xs font-bold text-[#4B5563]">
                    {dealsByStage[stage]?.length || 0}
                  </span>
                </div>
                <div className="space-y-3">
                  {(dealsByStage[stage] || []).map((deal) => (
                    <div key={deal.id} className="rounded-2xl border border-white/70 bg-white p-3 shadow-sm">
                      <p className="font-bold text-[#1F2937]">{deal.title}</p>
                      <p className="mt-1 text-xs text-[#707A84]">{deal.customerName || "-"}</p>
                      <p className="mt-2 text-sm font-bold text-[#0F8B94]">{formatMoney(deal.value)}</p>
                      <p className="mt-1 text-xs text-[#8B95A1]">احتمال {deal.probability}%</p>
                      {canEdit && (
                        <div className="mt-3 flex flex-wrap gap-1">
                          {DEAL_STAGES.filter((item) => item !== deal.stage).slice(0, 3).map((nextStage) => (
                            <button
                              key={nextStage}
                              type="button"
                              onClick={() => moveDeal(deal, nextStage)}
                              className="rounded-lg bg-[#F3F4F6] px-2 py-1 text-[10px] font-bold text-[#4B5563]"
                            >
                              {dealStageLabels[nextStage]}
                            </button>
                          ))}
                          <button
                            type="button"
                            onClick={() => deleteDeal(deal)}
                            className="rounded-lg bg-rose-50 p-1 text-rose-600"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

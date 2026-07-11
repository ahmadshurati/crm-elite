"use client";

import { Loader2, Plus } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import {
  COMMUNICATION_TYPES,
  communicationTypeLabels,
  type CustomerCommunicationRecord,
} from "@/lib/crm/communications";
import type { TimelineItem } from "@/lib/crm/timeline";
import { todayString } from "@/lib/crm/utils";

const timelineKindLabels: Record<TimelineItem["kind"], string> = {
  communication: "تواصل",
  insurance: "تأمين",
  accident: "حادث",
  document: "مستند",
};

const timelineKindColors: Record<TimelineItem["kind"], string> = {
  communication: "bg-[#E7F6F5] text-[#0F8B94]",
  insurance: "bg-blue-50 text-blue-700",
  accident: "bg-amber-50 text-amber-700",
  document: "bg-violet-50 text-violet-700",
};

function formatTimelineDate(value: string) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("ar", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function CustomerTimelinePanel({
  customerId,
  canEdit,
}: {
  customerId: number;
  canEdit: boolean;
}) {
  const [items, setItems] = useState<TimelineItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState({
    type: "call",
    occurredAt: todayString(),
    summary: "",
    attachmentUrl: "",
  });

  const loadTimeline = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/customers/${customerId}/timeline`, { cache: "no-store" });
      const data = await res.json();
      if (res.ok) {
        setItems(Array.isArray(data.items) ? data.items : []);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, [customerId]);

  useEffect(() => {
    loadTimeline();
  }, [loadTimeline]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.summary.trim()) return;

    setSaving(true);
    try {
      const res = await fetch(`/api/customers/${customerId}/communications`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: form.type,
          occurredAt: form.occurredAt,
          summary: form.summary,
          attachmentUrl: form.attachmentUrl || null,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        alert(data.error || "فشل حفظ التواصل");
        return;
      }

      setForm({ type: "call", occurredAt: todayString(), summary: "", attachmentUrl: "" });
      setFormOpen(false);
      await loadTimeline();
    } catch (error) {
      console.error(error);
      alert("فشل حفظ التواصل");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mt-5 rounded-3xl border border-[#E5E7EB] bg-white p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h4 className="text-xl font-bold text-[#1F2937]">الخط الزمني للعميل</h4>
          <p className="mt-1 text-sm text-[#707A84]">تواصل، تأمينات، حوادث، ومستندات في مكان واحد</p>
        </div>
        {canEdit && (
          <button
            type="button"
            onClick={() => setFormOpen((value) => !value)}
            className="flex items-center gap-2 rounded-xl bg-[#0F8B94] px-4 py-2 text-sm font-bold text-white"
          >
            <Plus className="h-4 w-4" />
            {formOpen ? "إخفاء النموذج" : "إضافة تواصل"}
          </button>
        )}
      </div>

      {formOpen && canEdit && (
        <form onSubmit={handleSubmit} className="mt-5 grid grid-cols-1 gap-4 rounded-2xl bg-[#FAFAFA] p-4 md:grid-cols-2">
          <label className="block text-sm">
            <span className="mb-1 block font-semibold text-[#4B5563]">نوع التواصل</span>
            <select
              value={form.type}
              onChange={(e) => setForm((prev) => ({ ...prev, type: e.target.value }))}
              className="w-full rounded-xl border border-[#E5E7EB] px-3 py-2"
            >
              {COMMUNICATION_TYPES.map((type) => (
                <option key={type} value={type}>
                  {communicationTypeLabels[type]}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-semibold text-[#4B5563]">التاريخ</span>
            <input
              type="date"
              value={form.occurredAt}
              onChange={(e) => setForm((prev) => ({ ...prev, occurredAt: e.target.value }))}
              className="w-full rounded-xl border border-[#E5E7EB] px-3 py-2"
            />
          </label>
          <label className="block text-sm md:col-span-2">
            <span className="mb-1 block font-semibold text-[#4B5563]">الملخص</span>
            <textarea
              value={form.summary}
              onChange={(e) => setForm((prev) => ({ ...prev, summary: e.target.value }))}
              rows={3}
              className="w-full rounded-xl border border-[#E5E7EB] px-3 py-2"
              placeholder="ماذا تم؟ نتيجة المكالمة أو الاجتماع..."
            />
          </label>
          <label className="block text-sm md:col-span-2">
            <span className="mb-1 block font-semibold text-[#4B5563]">رابط مرفق (اختياري)</span>
            <input
              value={form.attachmentUrl}
              onChange={(e) => setForm((prev) => ({ ...prev, attachmentUrl: e.target.value }))}
              className="w-full rounded-xl border border-[#E5E7EB] px-3 py-2"
              dir="ltr"
            />
          </label>
          <div className="md:col-span-2">
            <button
              type="submit"
              disabled={saving}
              className="rounded-xl bg-[#0F8B94] px-5 py-2 text-sm font-bold text-white disabled:opacity-60"
            >
              {saving ? "جاري الحفظ..." : "حفظ التواصل"}
            </button>
          </div>
        </form>
      )}

      <div className="mt-6 space-y-4">
        {loading ? (
          <div className="flex items-center justify-center py-10 text-[#707A84]">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span className="me-2">جاري تحميل الخط الزمني...</span>
          </div>
        ) : items.length === 0 ? (
          <p className="py-8 text-center text-[#707A84]">لا يوجد نشاط مسجل بعد</p>
        ) : (
          items.map((item) => (
            <div key={item.id} className="flex gap-4 rounded-2xl border border-[#F1F5F9] p-4">
              <div className="mt-1 h-3 w-3 shrink-0 rounded-full bg-[#0F8B94]" />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${timelineKindColors[item.kind]}`}>
                    {timelineKindLabels[item.kind]}
                  </span>
                  <span className="font-bold text-[#1F2937]">{item.title}</span>
                  <span className="text-xs text-[#8B95A1]">{formatTimelineDate(item.occurredAt)}</span>
                </div>
                <p className="mt-2 text-sm text-[#4B5563]">{item.summary || "-"}</p>
                {item.username && (
                  <p className="mt-1 text-xs text-[#8B95A1]">بواسطة: {item.username}</p>
                )}
                {item.attachmentUrl && (
                  <a
                    href={item.attachmentUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-2 inline-block text-xs font-bold text-[#0F8B94]"
                  >
                    عرض المرفق
                  </a>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export type { CustomerCommunicationRecord };

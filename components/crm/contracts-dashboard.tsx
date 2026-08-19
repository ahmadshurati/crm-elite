"use client";

import { FileText, Loader2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { CONTRACTS_API_URL } from "@/lib/crm/constants";
import type { Subscriber } from "@/lib/crm/types";

type Contract = {
  id: number;
  customerId: number;
  contractNumber: string;
  title: string;
  status: string;
  startDate: string | null;
  endDate: string | null;
  customerName: string | null;
  documentUrl: string | null;
};

const emptyForm = {
  customerId: "",
  title: "",
  contractNumber: "",
  status: "draft",
  startDate: "",
  endDate: "",
};

export function ContractsDashboard({
  subscribers,
  canEdit,
}: {
  subscribers: Subscriber[];
  canEdit: boolean;
}) {
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const loadContracts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(CONTRACTS_API_URL, { cache: "no-store" });
      if (res.ok) setContracts(await res.json());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadContracts();
  }, [loadContracts]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!canEdit) return;
    setSaving(true);
    try {
      const res = await fetch(CONTRACTS_API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId: Number(form.customerId),
          title: form.title,
          contractNumber: form.contractNumber || undefined,
          status: form.status,
          startDate: form.startDate || undefined,
          endDate: form.endDate || undefined,
        }),
      });
      if (!res.ok) {
        alert((await res.json()).error || "فشل الإضافة");
        return;
      }
      setForm(emptyForm);
      await loadContracts();
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="mt-8 space-y-5">
      <div className="rounded-[28px] border border-[#EAECEF] bg-white px-6 py-5 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="rounded-full bg-[#EFF4FF] p-2 text-[#2563EB]">
            <FileText className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-[22px] font-bold text-[#1F2937]">العقود</h3>
            <p className="text-sm text-[#707A84]">إدارة عقود التأمين والتوقيع والتجديد</p>
          </div>
        </div>
      </div>

      {canEdit && (
        <form onSubmit={handleCreate} className="rounded-[28px] border border-[#EAECEF] bg-white p-6 shadow-sm">
          <div className="grid gap-3 md:grid-cols-2">
            <select
              value={form.customerId}
              onChange={(e) => setForm({ ...form, customerId: e.target.value })}
              className="rounded-xl border border-[#E5E7EB] px-3 py-2"
              required
            >
              <option value="">اختر العميل</option>
              {subscribers.map((s) => (
                <option key={s.customerId} value={s.customerId}>
                  {s.subscriberName}
                </option>
              ))}
            </select>
            <input
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="عنوان العقد"
              className="rounded-xl border border-[#E5E7EB] px-3 py-2"
              required
            />
            <input
              value={form.contractNumber}
              onChange={(e) => setForm({ ...form, contractNumber: e.target.value })}
              placeholder="رقم العقد (اختياري)"
              className="rounded-xl border border-[#E5E7EB] px-3 py-2"
              dir="ltr"
            />
            <select
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value })}
              className="rounded-xl border border-[#E5E7EB] px-3 py-2"
            >
              <option value="draft">مسودة</option>
              <option value="sent">مُرسل</option>
              <option value="signed">موقّع</option>
              <option value="active">فعّال</option>
            </select>
          </div>
          <button
            type="submit"
            disabled={saving}
            className="mt-4 rounded-xl bg-[#2563EB] px-5 py-2 text-sm font-bold text-white disabled:opacity-60"
          >
            {saving ? "جاري الحفظ..." : "إضافة عقد"}
          </button>
        </form>
      )}

      <div className="rounded-[28px] border border-[#EAECEF] bg-white shadow-sm">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-[#707A84]">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : (
          <table className="min-w-full text-right text-sm">
            <thead>
              <tr className="border-b border-[#F1F5F9] text-[#707A84]">
                <th className="px-6 py-3">الرقم</th>
                <th className="px-6 py-3">العنوان</th>
                <th className="px-6 py-3">العميل</th>
                <th className="px-6 py-3">الحالة</th>
                <th className="px-6 py-3">الانتهاء</th>
              </tr>
            </thead>
            <tbody>
              {contracts.map((contract) => (
                <tr key={contract.id} className="border-b border-[#F1F5F9]">
                  <td className="px-6 py-3" dir="ltr">
                    {contract.contractNumber}
                  </td>
                  <td className="px-6 py-3 font-bold">{contract.title}</td>
                  <td className="px-6 py-3">{contract.customerName}</td>
                  <td className="px-6 py-3">{contract.status}</td>
                  <td className="px-6 py-3">{contract.endDate || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}

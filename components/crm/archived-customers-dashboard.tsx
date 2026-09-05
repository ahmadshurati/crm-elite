"use client";

import { Loader2, RotateCcw, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { CUSTOMERS_API_URL } from "@/lib/crm/constants";
import type { Subscriber } from "@/lib/crm/types";
import { mapDbCustomersToSubscribers } from "@/lib/crm/mappers";

export function ArchivedCustomersDashboard({
  canEdit,
  canDelete,
  onRestored,
}: {
  canEdit: boolean;
  canDelete: boolean;
  onRestored: () => void;
}) {
  const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [busyAll, setBusyAll] = useState(false);

  const loadArchived = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${CUSTOMERS_API_URL}?filter=archived&limit=100`, { cache: "no-store" });
      const data = await res.json();
      if (res.ok) {
        setSubscribers(mapDbCustomersToSubscribers(data.items || []));
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadArchived();
  }, [loadArchived]);

  async function restoreCustomer(subscriber: Subscriber) {
    if (!canEdit) return;
    const res = await fetch(`${CUSTOMERS_API_URL}/${subscriber.customerId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "restore" }),
    });
    if (!res.ok) {
      alert((await res.json()).error || "فشل الاستعادة");
      return;
    }
    await loadArchived();
    onRestored();
  }

  async function deleteCustomer(subscriber: Subscriber) {
    if (!canDelete || busyId) return;
    const ok = confirm(
      `حذف نهائي للعميل "${subscriber.subscriberName || "بدون اسم"}"؟\nسيتم حذف العميل وكل سياراته وتأميناته ومستنداته ومدفوعاته نهائيًا، ولا يمكن التراجع.`
    );
    if (!ok) return;
    setBusyId(subscriber.customerId);
    try {
      const res = await fetch(`${CUSTOMERS_API_URL}/${subscriber.customerId}/purge`, {
        method: "DELETE",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(data?.error || "فشل الحذف النهائي");
        return;
      }
      await loadArchived();
      onRestored();
    } finally {
      setBusyId(null);
    }
  }

  async function deleteAll() {
    if (!canDelete || busyAll) return;
    const uniqueCount = new Set(subscribers.map((s) => s.customerId)).size;
    if (uniqueCount === 0) return;
    const ok = confirm(
      `حذف نهائي لكل العملاء المؤرشفين (${uniqueCount})؟\nسيتم حذفهم مع كل سياراتهم وتأميناتهم ومستنداتهم ومدفوعاتهم نهائيًا، ولا يمكن التراجع.`
    );
    if (!ok) return;
    const confirmAgain = confirm("تأكيد أخير: هذا الإجراء نهائي ولا يمكن التراجع عنه. متابعة حذف الكل؟");
    if (!confirmAgain) return;
    setBusyAll(true);
    try {
      const res = await fetch(`${CUSTOMERS_API_URL}/purge-archived`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(data?.error || "فشل حذف الكل");
        return;
      }
      alert(`تم حذف ${data.deleted || 0} عميل مؤرشف نهائيًا.`);
      await loadArchived();
      onRestored();
    } finally {
      setBusyAll(false);
    }
  }

  const showActions = canEdit || canDelete;

  return (
    <section className="mt-8 rounded-[28px] border border-[#EAECEF] bg-white shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#F1F5F9] px-6 py-5">
        <div>
          <h3 className="text-[22px] font-bold text-[#1F2937]">الأرشيف</h3>
          <p className="mt-1 text-sm text-[#707A84]">
            عملاء مؤرشفون — يمكن استعادتهم، أو حذفهم نهائيًا بشكل لا يمكن التراجع عنه
          </p>
        </div>
        {canDelete && subscribers.length > 0 && (
          <button
            type="button"
            onClick={deleteAll}
            disabled={busyAll}
            className="inline-flex items-center gap-1.5 rounded-xl bg-rose-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-rose-700 disabled:opacity-50"
          >
            <Trash2 className="h-4 w-4" />
            {busyAll ? "جارِ حذف الكل…" : "حذف الكل"}
          </button>
        )}
      </div>
      {loading ? (
        <div className="flex items-center justify-center py-16 text-[#707A84]">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : subscribers.length === 0 ? (
        <div className="px-6 py-16 text-center text-[#707A84]">لا يوجد عملاء مؤرشفون</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-right text-sm">
            <thead>
              <tr className="border-b border-[#F1F5F9] text-[#707A84]">
                <th className="px-6 py-3">الاسم</th>
                <th className="px-6 py-3">الهاتف</th>
                <th className="px-6 py-3">السيارة</th>
                {showActions && <th className="px-6 py-3"></th>}
              </tr>
            </thead>
            <tbody>
              {subscribers.map((s) => (
                <tr key={s.id} className="border-b border-[#F1F5F9]">
                  <td className="px-6 py-3 font-bold">{s.subscriberName}</td>
                  <td className="px-6 py-3" dir="ltr">
                    {s.customerNumber || "—"}
                  </td>
                  <td className="px-6 py-3">{s.carNumber}</td>
                  {showActions && (
                    <td className="px-6 py-3">
                      <div className="flex items-center gap-2">
                        {canEdit && (
                          <button
                            type="button"
                            onClick={() => restoreCustomer(s)}
                            className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700 hover:bg-emerald-100"
                          >
                            <RotateCcw className="h-3.5 w-3.5" />
                            استعادة
                          </button>
                        )}
                        {canDelete && (
                          <button
                            type="button"
                            onClick={() => deleteCustomer(s)}
                            disabled={busyId === s.customerId}
                            className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-3 py-1 text-xs font-bold text-rose-700 hover:bg-rose-100 disabled:opacity-50"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            {busyId === s.customerId ? "جارِ الحذف…" : "حذف نهائي"}
                          </button>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

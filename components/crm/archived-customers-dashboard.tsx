"use client";

import { Loader2, RotateCcw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { CUSTOMERS_API_URL } from "@/lib/crm/constants";
import type { Subscriber } from "@/lib/crm/types";
import { mapDbCustomersToSubscribers } from "@/lib/crm/mappers";

export function ArchivedCustomersDashboard({
  canEdit,
  onRestored,
}: {
  canEdit: boolean;
  onRestored: () => void;
}) {
  const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
  const [loading, setLoading] = useState(true);

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

  return (
    <section className="mt-8 rounded-[28px] border border-[#EAECEF] bg-white shadow-sm">
      <div className="border-b border-[#F1F5F9] px-6 py-5">
        <h3 className="text-[22px] font-bold text-[#1F2937]">الأرشيف</h3>
        <p className="mt-1 text-sm text-[#707A84]">عملاء مؤرشفون — يمكن استعادتهم دون حذف البيانات</p>
      </div>
      {loading ? (
        <div className="flex items-center justify-center py-16 text-[#707A84]">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : subscribers.length === 0 ? (
        <div className="px-6 py-16 text-center text-[#707A84]">لا يوجد عملاء مؤرشفون</div>
      ) : (
        <table className="min-w-full text-right text-sm">
          <thead>
            <tr className="border-b border-[#F1F5F9] text-[#707A84]">
              <th className="px-6 py-3">الاسم</th>
              <th className="px-6 py-3">الهاتف</th>
              <th className="px-6 py-3">السيارة</th>
              {canEdit && <th className="px-6 py-3"></th>}
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
                {canEdit && (
                  <td className="px-6 py-3">
                    <button
                      type="button"
                      onClick={() => restoreCustomer(s)}
                      className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700"
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                      استعادة
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

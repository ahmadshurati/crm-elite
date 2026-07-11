"use client";

import { Loader2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { FIELD_AUDIT_API_URL } from "@/lib/crm/constants";
import type { FieldChangeRecord } from "@/lib/field-audit";

export function FieldAuditDashboard() {
  const [rows, setRows] = useState<FieldChangeRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const loadRows = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${FIELD_AUDIT_API_URL}?limit=100`, { cache: "no-store" });
      if (res.ok) setRows(await res.json());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRows();
  }, [loadRows]);

  return (
    <section className="mt-6 rounded-[28px] border border-[#EAECEF] bg-white shadow-sm">
      <div className="border-b border-[#F1F5F9] px-6 py-4">
        <h4 className="font-bold text-[#1F2937]">سجل تغييرات الحقول</h4>
        <p className="mt-1 text-sm text-[#707A84]">قيم قديمة/جديدة لحقول العملاء والصفقات</p>
      </div>
      {loading ? (
        <div className="flex items-center justify-center py-16 text-[#707A84]">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-right text-sm">
            <thead>
              <tr className="text-[#707A84]">
                <th className="px-4 py-3">التاريخ</th>
                <th className="px-4 py-3">المستخدم</th>
                <th className="px-4 py-3">الوحدة</th>
                <th className="px-4 py-3">الحقل</th>
                <th className="px-4 py-3">قديم</th>
                <th className="px-4 py-3">جديد</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-[#707A84]">
                    لا توجد تغييرات مسجّلة بعد
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr key={row.id} className="border-t border-[#F1F5F9]">
                    <td className="px-4 py-3 text-xs text-[#707A84]">
                      {new Date(row.createdAt).toLocaleString("ar")}
                    </td>
                    <td className="px-4 py-3">{row.username}</td>
                    <td className="px-4 py-3">{row.module}</td>
                    <td className="px-4 py-3 font-bold">{row.fieldName}</td>
                    <td className="max-w-[180px] truncate px-4 py-3 text-rose-600">{row.oldValue || "—"}</td>
                    <td className="max-w-[180px] truncate px-4 py-3 text-emerald-700">{row.newValue || "—"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

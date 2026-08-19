"use client";

import { Download, Loader2, Upload } from "lucide-react";
import { useState } from "react";
import { CUSTOMERS_IMPORT_API_URL } from "@/lib/crm/constants";

export function ImportDashboard({ canImport }: { canImport: boolean }) {
  const [csvText, setCsvText] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ imported: number; total: number; errors: string[]; parseErrors?: string[] } | null>(null);

  async function handleImport(e: React.FormEvent) {
    e.preventDefault();
    if (!canImport || !csvText.trim()) return;

    setLoading(true);
    setResult(null);
    try {
      const res = await fetch(CUSTOMERS_IMPORT_API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csv: csvText }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "فشل الاستيراد");
        setResult({ imported: 0, total: 0, errors: data.details || [data.message || "خطأ"], parseErrors: data.details });
        return;
      }
      setResult(data);
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="mt-8 space-y-5">
      <div className="rounded-[28px] border border-[#EAECEF] bg-white px-6 py-5 shadow-sm">
        <h3 className="text-[22px] font-bold text-[#1F2937]">استيراد المشتركين</h3>
        <p className="mt-1 text-sm text-[#707A84]">ارفع ملف CSV لإضافة عملاء وتأمينات دفعة واحدة — بدون حذف البيانات الحالية</p>
        <a
          href={CUSTOMERS_IMPORT_API_URL}
          className="mt-4 inline-flex items-center gap-2 rounded-xl border border-[#E5E7EB] px-4 py-2 text-sm font-bold text-[#2563EB]"
        >
          <Download className="h-4 w-4" />
          تحميل قالب CSV
        </a>
      </div>

      {canImport ? (
        <form onSubmit={handleImport} className="rounded-[28px] border border-[#EAECEF] bg-white p-6 shadow-sm">
          <label className="block text-sm">
            <span className="mb-2 block font-semibold">محتوى CSV</span>
            <textarea
              value={csvText}
              onChange={(e) => setCsvText(e.target.value)}
              rows={12}
              className="w-full rounded-xl border border-[#E5E7EB] px-3 py-2 font-mono text-xs"
              placeholder="الصق محتوى CSV هنا..."
              dir="ltr"
            />
          </label>
          <button
            type="submit"
            disabled={loading}
            className="mt-4 inline-flex items-center gap-2 rounded-xl bg-[#2563EB] px-5 py-2 text-sm font-bold text-white disabled:opacity-60"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            {loading ? "جاري الاستيراد..." : "استيراد"}
          </button>
        </form>
      ) : (
        <div className="rounded-[28px] border border-rose-200 bg-rose-50 p-8 text-center font-bold text-rose-700">
          لا يوجد لديك صلاحية الاستيراد
        </div>
      )}

      {result && (
        <div className="rounded-[28px] border border-[#EAECEF] bg-white p-6 shadow-sm">
          <p className="font-bold text-[#1F2937]">
            تم استيراد {result.imported} من {result.total} سجل
          </p>
          {[...(result.parseErrors || []), ...result.errors].length > 0 && (
            <ul className="mt-3 list-disc space-y-1 pe-5 text-sm text-rose-700">
              {[...(result.parseErrors || []), ...result.errors].map((error) => (
                <li key={error}>{error}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}

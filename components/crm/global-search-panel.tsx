"use client";

import { Loader2, Search } from "lucide-react";
import { useEffect, useState } from "react";
import { SEARCH_API_URL } from "@/lib/crm/constants";
import type { MenuKey } from "@/lib/menu-navigation";

type SearchResult = {
  id: string;
  kind: string;
  title: string;
  subtitle: string;
  section: string;
};

const kindLabels: Record<string, string> = {
  customer: "عميل",
  insurance: "تأمين",
  deal: "صفقة",
  task: "مهمة",
  quote: "عرض سعر",
  invoice: "فاتورة",
  accident: "حادث",
};

export function GlobalSearchPanel({
  query,
  open,
  onClose,
  onNavigate,
}: {
  query: string;
  open: boolean;
  onClose: () => void;
  onNavigate: (section: MenuKey, query: string) => void;
}) {
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || query.trim().length < 2) {
      setResults([]);
      return;
    }

    const timer = window.setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`${SEARCH_API_URL}?q=${encodeURIComponent(query.trim())}`, {
          cache: "no-store",
        });
        const data = await res.json();
        if (res.ok) setResults(Array.isArray(data.results) ? data.results : []);
      } finally {
        setLoading(false);
      }
    }, 250);

    return () => window.clearTimeout(timer);
  }, [open, query]);

  if (!open || query.trim().length < 2) return null;

  return (
    <>
      <button type="button" onClick={onClose} className="fixed inset-0 z-40 cursor-default bg-transparent" aria-label="Close search" />
      <div className="absolute left-0 right-0 top-[calc(100%+8px)] z-50 overflow-hidden rounded-2xl border border-[#EAECEF] bg-white shadow-2xl">
        <div className="border-b border-[#EEF1F4] px-4 py-3 text-sm font-bold text-[#707A84]">
          نتائج البحث الشامل
        </div>
        <div className="max-h-[360px] overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-10 text-[#707A84]">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="me-2">جاري البحث...</span>
            </div>
          ) : results.length === 0 ? (
            <div className="px-4 py-10 text-center text-sm text-[#707A84]">لا توجد نتائج</div>
          ) : (
            results.map((result) => (
              <button
                key={result.id}
                type="button"
                onClick={() => {
                  onNavigate(result.section as MenuKey, query);
                  onClose();
                }}
                className="flex w-full items-start gap-3 border-b border-[#F1F5F9] px-4 py-3 text-right transition last:border-none hover:bg-[#F8FAFC]"
              >
                <Search className="mt-1 h-4 w-4 shrink-0 text-[#0F8B94]" />
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-[#F1FBFA] px-2 py-0.5 text-[10px] font-bold text-[#0F8B94]">
                      {kindLabels[result.kind] || result.kind}
                    </span>
                    <span className="truncate text-sm font-bold text-[#1F2937]">{result.title}</span>
                  </div>
                  {result.subtitle && <p className="mt-1 truncate text-xs text-[#707A84]">{result.subtitle}</p>}
                </div>
              </button>
            ))
          )}
        </div>
      </div>
    </>
  );
}

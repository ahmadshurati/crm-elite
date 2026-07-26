"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  BadgeDollarSign,
  Check,
  Copy,
  Loader2,
  QrCode,
  ScanLine,
  TrendingUp,
  UserCheck,
  Users,
} from "lucide-react";

type Stats = {
  shop: { code: string; name: string; ownerName: string | null; commissionAmount: number } | null;
  code: string;
  scans: number;
  leads: number;
  subscribed: number;
  commissionAmount: number;
  estimatedCommission: number;
  recentLeads: { name: string; createdAt: string; status: string }[];
};

const STATUS_LABELS: Record<string, string> = {
  new: "جديد",
  contacted: "تم التواصل",
  subscribed: "مشترك",
};

export function ClientDashboard() {
  const searchParams = useSearchParams();
  const shopParam = searchParams.get("shop") || "";

  const [code, setCode] = useState(shopParam);
  const [input, setInput] = useState(shopParam);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(Boolean(shopParam));
  const [copied, setCopied] = useState(false);

  const load = useCallback(async (shopCode: string) => {
    if (!shopCode) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/referral/stats?shop=${encodeURIComponent(shopCode)}`, {
        cache: "no-store",
      });
      if (res.ok) setStats(await res.json());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (code) load(code);
  }, [code, load]);

  const referralLink = useMemo(() => {
    if (!code) return "";
    const origin = typeof window !== "undefined" ? window.location.origin : "https://gosol.io";
    return `${origin}/form?ref=${encodeURIComponent(code)}`;
  }, [code]);

  const conversion =
    stats && stats.scans > 0 ? Math.round((stats.leads / stats.scans) * 100) : 0;

  function copyLink() {
    if (!referralLink) return;
    navigator.clipboard?.writeText(referralLink).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    });
  }

  if (!code) {
    return (
      <main dir="rtl" className="flex min-h-screen items-center justify-center bg-[#F5F8FB] p-6">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setCode(input.trim());
          }}
          className="w-full max-w-sm rounded-[28px] border border-[#E7ECF1] bg-white p-8 text-center shadow-xl"
        >
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#E7F6F5]">
            <QrCode className="h-7 w-7 text-[#0F8B94]" />
          </div>
          <h1 className="mt-5 text-xl font-bold text-[#1F2937]">لوحة الشريك</h1>
          <p className="mt-2 text-sm text-[#707A84]">أدخل رمز المحل الخاص بك لعرض إحصائياتك.</p>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="رمز المحل"
            dir="ltr"
            className="mt-5 h-12 w-full rounded-xl border border-[#E5E7EB] bg-[#FAFBFC] px-4 text-center text-sm outline-none focus:border-[#0F8B94]"
          />
          <button
            type="submit"
            className="mt-4 w-full rounded-2xl bg-[#0F8B94] px-5 py-3 text-sm font-bold text-white hover:bg-[#0B6E75]"
          >
            عرض اللوحة
          </button>
        </form>
      </main>
    );
  }

  const shopName = stats?.shop?.name || code;

  return (
    <main dir="rtl" className="min-h-screen bg-[#F5F8FB] text-[#1F2937]">
      <div className="border-b border-[#E7ECF1] bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-5">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#0F8B94] text-base font-black text-white">
              G
            </div>
            <span className="text-lg font-extrabold tracking-tight text-[#0F8B94]">Gosol CRM</span>
          </div>
          <span className="rounded-full bg-[#E7F6F5] px-3 py-1 text-xs font-bold text-[#0F8B94]">
            لوحة الشريك
          </span>
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-5 py-8">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-[#0F8B94]">مرحباً</p>
            <h1 className="mt-1 text-2xl font-bold text-[#1F2937] md:text-3xl">{shopName}</h1>
            {stats?.shop?.ownerName && (
              <p className="mt-1 text-sm text-[#707A84]">{stats.shop.ownerName}</p>
            )}
          </div>
          <button
            onClick={() => load(code)}
            className="rounded-xl border border-[#E5E7EB] bg-white px-4 py-2 text-sm font-bold text-[#334155] hover:bg-[#F8FAFC]"
          >
            تحديث
          </button>
        </div>

        {loading && !stats ? (
          <div className="mt-10 flex items-center justify-center py-20 text-[#94A3B8]">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : (
          <>
            <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard
                icon={ScanLine}
                label="عدد السكانات"
                value={stats?.scans ?? 0}
                helper="زيارات عبر رمز QR"
                accent="teal"
              />
              <StatCard
                icon={Users}
                label="طلبات الاشتراك"
                value={stats?.leads ?? 0}
                helper="عملاء تركوا بياناتهم"
                accent="blue"
              />
              <StatCard
                icon={UserCheck}
                label="مشتركون مؤكّدون"
                value={stats?.subscribed ?? 0}
                helper="اشتركوا فعلياً معنا"
                accent="violet"
              />
              <StatCard
                icon={BadgeDollarSign}
                label="عمولتك المقدّرة"
                value={`₪ ${(stats?.estimatedCommission ?? 0).toLocaleString()}`}
                helper={`₪ ${(stats?.commissionAmount ?? 0).toLocaleString()} لكل مشترك`}
                accent="amber"
              />
            </div>

            <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-[1fr_1.2fr]">
              <div className="rounded-[26px] border border-[#EAECEF] bg-white p-6 shadow-sm">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-[#0F8B94]" />
                  <h3 className="text-lg font-bold text-[#1F2937]">نسبة التحويل</h3>
                </div>
                <p className="mt-4 text-4xl font-black text-[#0F8B94]">{conversion}%</p>
                <p className="mt-1 text-sm text-[#707A84]">
                  من زوّار رمز QR تركوا بياناتهم للتواصل.
                </p>

                <div className="mt-5 rounded-2xl bg-[#F5F8FB] p-4">
                  <p className="text-xs font-bold text-[#707A84]">رابط QR الخاص بك</p>
                  <div className="mt-2 flex items-center gap-2">
                    <code className="flex-1 truncate rounded-lg bg-white px-3 py-2 text-xs text-[#334155] ring-1 ring-[#E5E7EB]" dir="ltr">
                      {referralLink}
                    </code>
                    <button
                      onClick={copyLink}
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#0F8B94] text-white hover:bg-[#0B6E75]"
                      title="نسخ الرابط"
                    >
                      {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
              </div>

              <div className="rounded-[26px] border border-[#EAECEF] bg-white p-6 shadow-sm">
                <h3 className="text-lg font-bold text-[#1F2937]">آخر النشاطات</h3>
                {stats && stats.recentLeads.length > 0 ? (
                  <div className="mt-4 divide-y divide-[#F1F5F9]">
                    {stats.recentLeads.map((lead, i) => (
                      <div key={i} className="flex items-center justify-between py-3">
                        <div>
                          <p className="text-sm font-bold text-[#1F2937]">{lead.name}</p>
                          <p className="text-xs text-[#94A3B8]">
                            {new Date(lead.createdAt).toLocaleDateString("ar")}
                          </p>
                        </div>
                        <span
                          className={`rounded-full px-3 py-1 text-[11px] font-bold ${
                            lead.status === "subscribed"
                              ? "bg-emerald-50 text-emerald-700"
                              : lead.status === "contacted"
                              ? "bg-blue-50 text-blue-700"
                              : "bg-slate-100 text-slate-600"
                          }`}
                        >
                          {STATUS_LABELS[lead.status] || lead.status}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="mt-8 py-10 text-center text-sm text-[#94A3B8]">
                    لا يوجد نشاط بعد. عندما يعمل الزبائن سكان لرمزك ستظهر النتائج هنا.
                  </div>
                )}
              </div>
            </div>
          </>
        )}

        <footer className="mt-10 text-center text-xs text-[#8B95A1]">
          © {new Date().getFullYear()} Gosol CRM
        </footer>
      </div>
    </main>
  );
}

const ACCENTS: Record<string, string> = {
  teal: "bg-[#E7F6F5] text-[#0F8B94]",
  blue: "bg-blue-50 text-blue-600",
  violet: "bg-violet-50 text-violet-600",
  amber: "bg-amber-50 text-amber-600",
};

function StatCard({
  icon: Icon,
  label,
  value,
  helper,
  accent,
}: {
  icon: typeof Users;
  label: string;
  value: number | string;
  helper: string;
  accent: string;
}) {
  return (
    <div className="rounded-[26px] border border-[#EAECEF] bg-white p-5 shadow-sm">
      <div className={`flex h-11 w-11 items-center justify-center rounded-2xl ${ACCENTS[accent] || ACCENTS.teal}`}>
        <Icon className="h-5 w-5" />
      </div>
      <p className="mt-4 text-3xl font-black text-[#1F2937]">{value}</p>
      <p className="mt-1 text-sm font-bold text-[#334155]">{label}</p>
      <p className="mt-0.5 text-xs text-[#94A3B8]">{helper}</p>
    </div>
  );
}

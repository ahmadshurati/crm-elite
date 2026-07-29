"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  BadgeDollarSign,
  Check,
  Copy,
  Download,
  Loader2,
  Lock,
  LogOut,
  QrCode,
  ScanLine,
  UserCheck,
  Users,
} from "lucide-react";

type LeadRow = {
  name: string;
  businessName: string | null;
  phone: string;
  email: string | null;
  status: string;
  createdAt: string;
};

type Stats = {
  shop: { code: string; name: string; ownerName: string | null; commissionAmount: number } | null;
  code: string;
  scans: number;
  leads: number;
  subscribed: number;
  commissionAmount: number;
  estimatedCommission: number;
  range: { from: string | null; to: string | null };
  items: LeadRow[];
};

type ViewKey = "leads" | "subscribed" | "commission";

const STATUS_LABELS: Record<string, string> = {
  new: "جديد",
  contacted: "تمّت المتابعة",
  subscribed: "مشترك",
  rejected: "غير مهتم",
};

const PRESETS = [
  { id: "all", label: "كل الوقت" },
  { id: "month", label: "هذا الشهر" },
  { id: "last-month", label: "الشهر الماضي" },
  { id: "7", label: "آخر 7 أيام" },
  { id: "30", label: "آخر 30 يوماً" },
] as const;

function fmt(d: Date) {
  return d.toISOString().slice(0, 10);
}

function presetRange(id: string): { from: string; to: string } {
  const now = new Date();
  if (id === "month") return { from: fmt(new Date(now.getFullYear(), now.getMonth(), 1)), to: fmt(now) };
  if (id === "last-month")
    return {
      from: fmt(new Date(now.getFullYear(), now.getMonth() - 1, 1)),
      to: fmt(new Date(now.getFullYear(), now.getMonth(), 0)),
    };
  if (id === "7") {
    const f = new Date(now);
    f.setDate(f.getDate() - 6);
    return { from: fmt(f), to: fmt(now) };
  }
  if (id === "30") {
    const f = new Date(now);
    f.setDate(f.getDate() - 29);
    return { from: fmt(f), to: fmt(now) };
  }
  return { from: "", to: "" };
}

export function ClientDashboard() {
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  const [login, setLogin] = useState({ username: "", password: "" });
  const [loginError, setLoginError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [preset, setPreset] = useState<string>("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [view, setView] = useState<ViewKey>("leads");

  const load = useCallback(async (f: string, t: string) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (f) params.set("from", f);
      if (t) params.set("to", t);
      const res = await fetch(`/api/referral/stats?${params.toString()}`, { cache: "no-store" });
      if (res.ok) {
        setStats(await res.json());
        setAuthed(true);
        return;
      }
      // 401 (not logged in) or any other error -> show the login form instead of hanging
      setAuthed(false);
      setStats(null);
    } catch {
      setAuthed(false);
      setStats(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(from, to);
  }, [from, to, load]);

  function applyPreset(id: string) {
    setPreset(id);
    const r = presetRange(id);
    setFrom(r.from);
    setTo(r.to);
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoginError("");
    setSubmitting(true);
    try {
      const res = await fetch("/api/referral/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(login),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setLoginError(String(data.error || "تعذّر تسجيل الدخول"));
        return;
      }
      await load(from, to);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleLogout() {
    await fetch("/api/referral/logout", { method: "POST" }).catch(() => {});
    setAuthed(false);
    setStats(null);
    setLogin({ username: "", password: "" });
  }

  const code = stats?.shop?.code || "";
  const referralLink = useMemo(() => {
    if (!code) return "";
    const origin = typeof window !== "undefined" ? window.location.origin : "https://gosol.io";
    return `${origin}/form?ref=${encodeURIComponent(code)}`;
  }, [code]);

  const tableRows = useMemo(() => {
    if (!stats) return [];
    if (view === "subscribed" || view === "commission") return stats.items.filter((r) => r.status === "subscribed");
    return stats.items;
  }, [stats, view]);

  function copyLink() {
    if (!referralLink) return;
    navigator.clipboard?.writeText(referralLink).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    });
  }

  function exportCsv() {
    const header = ["الاسم", "النشاط", "الهاتف", "البريد", "الحالة", "التاريخ"];
    const lines = tableRows.map((r) =>
      [r.name, r.businessName || "", r.phone, r.email || "", STATUS_LABELS[r.status] || r.status, new Date(r.createdAt).toLocaleDateString("en-CA")]
        .map((c) => `"${String(c).replace(/"/g, '""')}"`)
        .join(",")
    );
    const csv = "\uFEFF" + [header.join(","), ...lines].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `gosol-${code}-${view}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (authed === null) {
    return (
      <main dir="rtl" className="flex min-h-screen items-center justify-center bg-[#F5F8FB] text-[#94A3B8]">
        <Loader2 className="h-6 w-6 animate-spin" />
      </main>
    );
  }

  if (!authed) {
    return (
      <main dir="rtl" className="flex min-h-screen items-center justify-center bg-[#F5F8FB] p-6">
        <form
          onSubmit={handleLogin}
          className="w-full max-w-sm rounded-[28px] border border-[#E7ECF1] bg-white p-8 text-center shadow-xl"
        >
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#E7F6F5]">
            <QrCode className="h-7 w-7 text-[#0F8B94]" />
          </div>
          <h1 className="mt-5 text-xl font-bold text-[#1F2937]">لوحة الشريك</h1>
          <p className="mt-2 text-sm text-[#707A84]">سجّل الدخول لعرض إحصائيات محلك.</p>

          <input
            value={login.username}
            onChange={(e) => setLogin({ ...login, username: e.target.value })}
            placeholder="اسم المستخدم"
            dir="ltr"
            className="mt-5 h-12 w-full rounded-xl border border-[#E5E7EB] bg-[#FAFBFC] px-4 text-sm outline-none focus:border-[#0F8B94]"
            required
          />
          <input
            value={login.password}
            onChange={(e) => setLogin({ ...login, password: e.target.value })}
            placeholder="كلمة المرور"
            type="password"
            dir="ltr"
            className="mt-3 h-12 w-full rounded-xl border border-[#E5E7EB] bg-[#FAFBFC] px-4 text-sm outline-none focus:border-[#0F8B94]"
            required
          />
          {loginError && (
            <p className="mt-3 rounded-xl bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-700">{loginError}</p>
          )}
          <button
            type="submit"
            disabled={submitting}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-[#0F8B94] px-5 py-3 text-sm font-bold text-white hover:bg-[#0B6E75] disabled:opacity-60"
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}
            تسجيل الدخول
          </button>
        </form>
      </main>
    );
  }

  const shopName = stats?.shop?.name || code;

  const KPIS: { key: ViewKey | "scans"; icon: typeof Users; label: string; value: string; helper: string; accent: string; clickable: boolean }[] = [
    { key: "scans", icon: ScanLine, label: "عدد عمليات المسح", value: String(stats?.scans ?? 0), helper: "زيارات عبر رمز QR", accent: "teal", clickable: false },
    { key: "leads", icon: Users, label: "طلبات الاشتراك", value: String(stats?.leads ?? 0), helper: "عملاء تركوا بياناتهم", accent: "blue", clickable: true },
    { key: "subscribed", icon: UserCheck, label: "مشتركون مؤكّدون", value: String(stats?.subscribed ?? 0), helper: "اشتركوا فعلياً معنا", accent: "violet", clickable: true },
    { key: "commission", icon: BadgeDollarSign, label: "عمولتك المقدّرة", value: `₪ ${(stats?.estimatedCommission ?? 0).toLocaleString()}`, helper: `₪ ${(stats?.commissionAmount ?? 0).toLocaleString()} لكل مشترك`, accent: "amber", clickable: true },
  ];

  return (
    <main dir="rtl" className="min-h-screen bg-[#F5F8FB] text-[#1F2937]">
      <div className="border-b border-[#E7ECF1] bg-gradient-to-l from-[#0F8B94] to-[#0B6E75]">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5 text-white">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/20 text-base font-black">G</div>
            <span className="text-lg font-extrabold tracking-tight">Gosol CRM</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-bold ring-1 ring-white/25">لوحة الشريك</span>
            <button
              onClick={handleLogout}
              className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-bold ring-1 ring-white/25 hover:bg-white/25"
            >
              <LogOut className="h-3.5 w-3.5" />
              خروج
            </button>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-5 py-8">
        <div className="gosol-fade-up flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-[#0F8B94]">مرحباً</p>
            <h1 className="mt-1 text-2xl font-bold text-[#1F2937] md:text-3xl">{shopName}</h1>
            {stats?.shop?.ownerName && <p className="mt-1 text-sm text-[#707A84]">{stats.shop.ownerName}</p>}
          </div>
          <button
            onClick={() => load(from, to)}
            className="rounded-xl border border-[#E5E7EB] bg-white px-4 py-2 text-sm font-bold text-[#334155] hover:bg-[#F8FAFC]"
          >
            تحديث
          </button>
        </div>

        <div className="gosol-fade-up mt-6 rounded-[22px] border border-[#EAECEF] bg-white p-4 shadow-sm" style={{ animationDelay: "0.05s" }}>
          <div className="flex flex-wrap items-center gap-2">
            {PRESETS.map((p) => (
              <button
                key={p.id}
                onClick={() => applyPreset(p.id)}
                className={`rounded-full px-4 py-1.5 text-sm font-bold transition ${
                  preset === p.id ? "bg-[#0F8B94] text-white" : "bg-[#F1F5F9] text-[#475569] hover:bg-[#E7F6F5]"
                }`}
              >
                {p.label}
              </button>
            ))}
            <div className="mx-1 hidden h-6 w-px bg-[#E5E7EB] sm:block" />
            <div className="flex items-center gap-2">
              <input type="date" value={from} onChange={(e) => { setPreset("custom"); setFrom(e.target.value); }} className="h-9 rounded-lg border border-[#E5E7EB] bg-white px-2 text-sm text-[#334155] outline-none focus:border-[#0F8B94]" />
              <span className="text-xs text-[#94A3B8]">إلى</span>
              <input type="date" value={to} onChange={(e) => { setPreset("custom"); setTo(e.target.value); }} className="h-9 rounded-lg border border-[#E5E7EB] bg-white px-2 text-sm text-[#334155] outline-none focus:border-[#0F8B94]" />
            </div>
          </div>
        </div>

        {loading && !stats ? (
          <div className="mt-10 flex items-center justify-center py-20 text-[#94A3B8]">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : (
          <>
            <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {KPIS.map((k, i) => {
                const active = k.clickable && view === k.key;
                const Comp = k.clickable ? "button" : "div";
                return (
                  <Comp
                    key={k.key}
                    onClick={k.clickable ? () => setView(k.key as ViewKey) : undefined}
                    className={`gosol-fade-up rounded-[24px] border bg-white p-5 text-right shadow-sm transition ${
                      k.clickable ? "cursor-pointer hover:-translate-y-1 hover:shadow-md" : ""
                    } ${active ? "border-[#0F8B94] ring-2 ring-[#0F8B94]/20" : "border-[#EAECEF]"}`}
                    style={{ animationDelay: `${0.08 + i * 0.06}s` }}
                  >
                    <div className={`flex h-11 w-11 items-center justify-center rounded-2xl ${ACCENTS[k.accent] || ACCENTS.teal}`}>
                      <k.icon className="h-5 w-5" />
                    </div>
                    <p className="mt-4 text-3xl font-black text-[#1F2937]">{k.value}</p>
                    <p className="mt-1 text-sm font-bold text-[#334155]">{k.label}</p>
                    <p className="mt-0.5 text-xs text-[#94A3B8]">{k.helper}</p>
                    {k.clickable && <p className="mt-2 text-[11px] font-bold text-[#0F8B94]">اضغط لعرض التفاصيل ←</p>}
                  </Comp>
                );
              })}
            </div>

            <div className="gosol-fade-up mt-5 rounded-[24px] border border-[#EAECEF] bg-white p-6 shadow-sm" style={{ animationDelay: "0.12s" }}>
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#E7F6F5] text-[#0F8B94]">
                    <QrCode className="h-6 w-6" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-[#707A84]">رمز الإحالة الخاص بك</p>
                    <p className="text-2xl font-black tracking-wider text-[#0F8B94]" dir="ltr">{code}</p>
                  </div>
                </div>
                <div className="flex min-w-[260px] flex-1 items-center gap-2">
                  <code className="flex-1 truncate rounded-lg bg-[#F5F8FB] px-3 py-2.5 text-xs text-[#334155] ring-1 ring-[#E5E7EB]" dir="ltr">{referralLink}</code>
                  <button onClick={copyLink} className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-lg bg-[#0F8B94] px-3.5 text-sm font-bold text-white hover:bg-[#0B6E75]">
                    {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    {copied ? "تم النسخ" : "نسخ الرابط"}
                  </button>
                </div>
              </div>
            </div>

            <div className="gosol-fade-up mt-5 rounded-[24px] border border-[#EAECEF] bg-white p-6 shadow-sm" style={{ animationDelay: "0.16s" }}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap gap-1.5">
                  <Tab active={view === "leads"} onClick={() => setView("leads")}>طلبات الاشتراك</Tab>
                  <Tab active={view === "subscribed"} onClick={() => setView("subscribed")}>مشتركون مؤكّدون</Tab>
                  <Tab active={view === "commission"} onClick={() => setView("commission")}>العمولة</Tab>
                </div>
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-[#F1F5F9] px-3 py-1 text-xs font-bold text-[#475569]">{tableRows.length} سجلّ</span>
                  {tableRows.length > 0 && (
                    <button onClick={exportCsv} className="inline-flex items-center gap-1.5 rounded-lg border border-[#E5E7EB] bg-white px-3 py-1.5 text-xs font-bold text-[#334155] hover:bg-[#F8FAFC]">
                      <Download className="h-3.5 w-3.5" />
                      تصدير CSV
                    </button>
                  )}
                </div>
              </div>

              {view === "commission" && (
                <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-[#FFF8EC] px-5 py-4">
                  <span className="text-sm font-bold text-[#92400E]">{stats?.subscribed ?? 0} مشترك مؤكّد × ₪ {(stats?.commissionAmount ?? 0).toLocaleString()} لكل مشترك</span>
                  <span className="text-2xl font-black text-[#B45309]">₪ {(stats?.estimatedCommission ?? 0).toLocaleString()}</span>
                </div>
              )}

              <div className="mt-5 overflow-x-auto">
                {tableRows.length > 0 ? (
                  <table className="w-full min-w-[760px] text-right text-sm">
                    <thead>
                      <tr className="border-b-2 border-[#EEF1F4] text-xs text-[#8B95A1]">
                        <th className="px-3 py-3 font-semibold">#</th>
                        <th className="px-3 py-3 font-semibold">الاسم</th>
                        <th className="px-3 py-3 font-semibold">النشاط / المحل</th>
                        <th className="px-3 py-3 font-semibold">الهاتف</th>
                        <th className="px-3 py-3 font-semibold">البريد الإلكتروني</th>
                        <th className="px-3 py-3 font-semibold">التاريخ</th>
                        <th className="px-3 py-3 font-semibold">الحالة</th>
                      </tr>
                    </thead>
                    <tbody>
                      {tableRows.map((r, i) => (
                        <tr key={i} className="border-b border-[#F5F7FA] transition last:border-none hover:bg-[#FAFCFD]">
                          <td className="px-3 py-4 text-xs font-bold text-[#94A3B8]">{i + 1}</td>
                          <td className="px-3 py-4 font-bold text-[#1F2937]">{r.name}</td>
                          <td className="px-3 py-4 text-[#4B5563]">{r.businessName || "—"}</td>
                          <td className="px-3 py-4 text-[#4B5563]" dir="ltr">{r.phone || "—"}</td>
                          <td className="px-3 py-4 text-[#4B5563]" dir="ltr">{r.email || "—"}</td>
                          <td className="px-3 py-4 text-[#94A3B8]">{new Date(r.createdAt).toLocaleDateString("ar")}</td>
                          <td className="px-3 py-4">
                            <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${r.status === "subscribed" ? "bg-emerald-50 text-emerald-700" : r.status === "contacted" ? "bg-blue-50 text-blue-700" : "bg-slate-100 text-slate-600"}`}>
                              {STATUS_LABELS[r.status] || r.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div className="py-16 text-center text-sm text-[#94A3B8]">
                    {view === "leads" ? "لا توجد طلبات ضمن هذه الفترة." : "لا يوجد مشتركون مؤكّدون ضمن هذه الفترة."}
                  </div>
                )}
              </div>
              <p className="mt-3 text-[11px] leading-5 text-[#9AA3AF]">تُعرض بيانات العملاء مقنّعة جزئياً للحفاظ على الخصوصية.</p>
            </div>
          </>
        )}

        <footer className="mt-10 text-center text-xs text-[#8B95A1]">© {new Date().getFullYear()} Gosol CRM</footer>
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

function Tab({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full px-3.5 py-1.5 text-sm font-bold transition ${active ? "bg-[#0F8B94] text-white" : "bg-[#F1F5F9] text-[#475569] hover:bg-[#E7F6F5]"}`}
    >
      {children}
    </button>
  );
}

"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Activity,
  BadgeDollarSign,
  Bell,
  CalendarDays,
  ClipboardList,
  FlaskConical,
  LayoutGrid,
  Loader2,
  LogOut,
  MessageCircle,
  Package,
  Plus,
  Search,
  Stethoscope,
  UserPlus,
  Users,
  Menu,
  X,
} from "lucide-react";
import { PatientProfile } from "@/components/dental/patient-profile";
import { DentalCalendar } from "@/components/dental/dental-calendar";
import { InventoryDashboard, LabsDashboard, RecallDashboard, ReportsDashboard } from "@/components/dental/clinic-ops";
import { SettingsHub, StaffDashboard } from "@/components/dental/admin";
import { WhatsAppInbox } from "@/components/dental/whatsapp-inbox";
import { DentalErrorBoundary } from "@/components/dental/error-boundary";
import { apiFetch, ConfirmProvider, EmptyState, ErrorState, fmtDate, fmtDateTime, fmtMoney, fmtTime, StateView, ToastProvider, useApi, useMutation } from "@/components/dental/ui";
import { APPOINTMENT_STATUSES, APPOINTMENT_STATUS_MAP, PAYMENT_METHODS, TREATMENT_CATEGORIES } from "@/lib/dental/constants";

type View = "dashboard" | "reception" | "patients" | "treatments" | "finance" | "labs" | "inventory" | "recall" | "whatsapp" | "reports" | "staff" | "settings";

const NAV: { id: View; label: string; icon: typeof Users; ready: boolean }[] = [
  { id: "dashboard", label: "لوحة اليوم", icon: LayoutGrid, ready: true },
  { id: "reception", label: "الاستقبال والمواعيد", icon: CalendarDays, ready: true },
  { id: "patients", label: "المرضى", icon: Users, ready: true },
  { id: "treatments", label: "العلاجات", icon: Stethoscope, ready: true },
  { id: "finance", label: "المالية", icon: BadgeDollarSign, ready: false },
  { id: "labs", label: "المختبرات", icon: FlaskConical, ready: true },
  { id: "inventory", label: "المخزون", icon: Package, ready: true },
  { id: "recall", label: "التذكير والمتابعة", icon: Bell, ready: true },
  { id: "whatsapp", label: "واتساب", icon: MessageCircle, ready: true },
  { id: "reports", label: "التقارير", icon: Activity, ready: true },
  { id: "staff", label: "الأطباء والموظفون", icon: ClipboardList, ready: true },
  { id: "settings", label: "الإعدادات", icon: ClipboardList, ready: true },
];

// Nav visibility gated by permission (server still enforces every action)
const NAV_PERMISSION: Partial<Record<View, string>> = {
  reception: "appointments.manage",
  whatsapp: "messages.view",
  reports: "reports.view",
  staff: "users.manage",
  settings: "audit.view",
};

export function DentalApp() {
  return (
    <ToastProvider>
      <ConfirmProvider>
        <DentalAppInner />
      </ConfirmProvider>
    </ToastProvider>
  );
}

function DentalAppInner() {
  const [ready, setReady] = useState(false);
  const [bootError, setBootError] = useState<string | null>(null);
  const [clinic, setClinic] = useState("");
  const [permissions, setPermissions] = useState<string[]>([]);
  const [view, setView] = useState<View>("dashboard");
  const [patientId, setPatientId] = useState<number | null>(null);
  const [patientTab, setPatientTab] = useState<string | undefined>(undefined);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const boot = useCallback(async () => {
    setBootError(null);
    setReady(false);
    const r = await apiFetch<{ clinicName: string; permissions: string[] }>("/api/dental/me");
    if (r.ok) {
      setClinic(r.data.clinicName || "عيادة");
      setPermissions(r.data.permissions || []);
      setReady(true);
      return;
    }
    if (r.status === 403) { window.location.replace("/"); return; }
    if (r.status === 401) return; // apiFetch already redirected to /login
    setBootError(r.error);
  }, []);

  useEffect(() => { boot(); }, [boot]);

  const visibleNav = NAV.filter((n) => {
    const req = NAV_PERMISSION[n.id];
    return !req || permissions.includes(req);
  });

  async function logout() {
    await apiFetch("/api/logout", { method: "POST" });
    window.location.href = "/login";
  }

  if (bootError) {
    return (
      <main dir="rtl" className="flex min-h-screen items-center justify-center bg-[#F5F8FB] p-6">
        <div className="w-full max-w-md rounded-[24px] border border-[#EAECEF] bg-white shadow-sm">
          <ErrorState message={bootError} onRetry={boot} />
        </div>
      </main>
    );
  }

  if (!ready) {
    return (
      <main dir="rtl" className="flex min-h-screen items-center justify-center bg-[#F5F8FB] text-[#94A3B8]">
        <Loader2 className="h-6 w-6 animate-spin" />
      </main>
    );
  }

  function go(v: View) {
    setPatientId(null);
    setPatientTab(undefined);
    setView(v);
    setSidebarOpen(false);
  }

  function openPatient(id: number, tab?: string) {
    setPatientTab(tab);
    setPatientId(id);
    setSidebarOpen(false);
  }

  return (
    <div dir="rtl" className="flex min-h-screen bg-[#F5F8FB] text-[#1F2937]">
      {sidebarOpen && (
        <div onClick={() => setSidebarOpen(false)} className="fixed inset-0 z-40 bg-black/40 lg:hidden" aria-hidden="true" />
      )}
      <aside className={`fixed inset-y-0 right-0 z-50 flex h-screen w-[248px] max-w-[85vw] shrink-0 flex-col border-l border-[#E5E9EF] bg-white transition-transform duration-200 lg:sticky lg:top-0 lg:z-auto lg:max-w-none lg:translate-x-0 ${sidebarOpen ? "translate-x-0" : "translate-x-full"}`}>
        <div className="relative flex items-center gap-2.5 border-b border-[#EEF1F4] px-5 py-5">
          <button type="button" onClick={() => setSidebarOpen(false)} aria-label="إغلاق القائمة" className="absolute left-3 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-[#64748B] hover:bg-[#F1F5F9] lg:hidden">
            <X className="h-5 w-5" />
          </button>
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#0F8B94] text-white">
            <Stethoscope className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-extrabold text-[#0F8B94]">Gosol Dental</p>
            <p className="text-[11px] text-[#94A3B8]">نظام إدارة العيادة</p>
          </div>
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
          {visibleNav.map((n) => (
            <button
              key={n.id}
              onClick={() => go(n.id)}
              className={`flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-right text-sm transition ${
                view === n.id && !patientId ? "bg-[#F1FBFA] font-bold text-[#0F8B94] ring-1 ring-[#D7ECEB]" : "text-[#475569] hover:bg-[#F8FAFC]"
              }`}
            >
              <n.icon className="h-[18px] w-[18px]" />
              {n.label}
              {!n.ready && <span className="mr-auto rounded-full bg-slate-100 px-1.5 py-0.5 text-[9px] text-slate-400">قريباً</span>}
            </button>
          ))}
        </nav>
        <div className="border-t border-[#EEF1F4] p-3">
          <button onClick={logout} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#F1F5F9] px-4 py-2.5 text-sm font-bold text-[#475569] hover:bg-[#E7F6F5]">
            <LogOut className="h-4 w-4" />
            تسجيل الخروج
          </button>
        </div>
      </aside>

      <main className="min-w-0 flex-1">
        <div className="sticky top-0 z-30 flex flex-wrap items-center justify-between gap-3 border-b border-[#EAECEF] bg-white px-4 py-3 sm:px-6 sm:py-4">
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => setSidebarOpen(true)} aria-label="القائمة" className="rounded-xl p-2 text-[#475569] hover:bg-gray-100 lg:hidden">
              <Menu className="h-5 w-5" />
            </button>
            <h1 className="shrink-0 text-base font-bold text-[#1F2937] sm:text-lg">{clinic}</h1>
          </div>
          <GlobalSearch onOpenPatient={openPatient} />
          <span className="hidden shrink-0 rounded-full bg-[#E7F6F5] px-3 py-1 text-xs font-bold text-[#0F8B94] sm:inline">عيادة أسنان</span>
        </div>

        <div className="p-4 sm:p-6">
          <DentalErrorBoundary key={patientId ? `p-${patientId}` : view}>
          {patientId ? (
            <PatientProfile patientId={patientId} initialTab={patientTab} onBack={() => { setPatientId(null); setPatientTab(undefined); }} />
          ) : view === "dashboard" ? (
            <Dashboard onGo={go} />
          ) : view === "reception" ? (
            <ReceptionHub onOpenPatient={openPatient} />
          ) : view === "patients" ? (
            <Patients onOpen={(id) => openPatient(id)} />
          ) : view === "treatments" ? (
            <TreatmentsCatalog />
          ) : view === "labs" ? (
            <LabsDashboard />
          ) : view === "inventory" ? (
            <InventoryDashboard />
          ) : view === "recall" ? (
            <RecallDashboard onOpenPatient={openPatient} />
          ) : view === "whatsapp" ? (
            <WhatsAppInbox onOpenPatient={openPatient} />
          ) : view === "reports" ? (
            <ReportsDashboard />
          ) : view === "staff" ? (
            <StaffDashboard />
          ) : view === "settings" ? (
            <SettingsHub />
          ) : (
            <ComingSoon label={NAV.find((n) => n.id === view)?.label || ""} />
          )}
          </DentalErrorBoundary>
        </div>
      </main>
    </div>
  );
}

type SearchResults = {
  patients: { id: number; fullName: string; patientNumber: string; phone: string | null }[];
  invoices: { id: number; number: string; type: string; total: number }[];
  appointments: { id: number; patientId: number; fullName: string; startAt: string }[];
};

function GlobalSearch({ onOpenPatient }: { onOpenPatient: (id: number, tab?: string) => void }) {
  const [q, setQ] = useState("");
  const [res, setRes] = useState<SearchResults | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "error" | "done">("idle");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (q.trim().length < 2) { setRes(null); setStatus("idle"); return; }
    let cancelled = false;
    setStatus("loading");
    setOpen(true);
    const t = setTimeout(async () => {
      const r = await apiFetch<SearchResults>(`/api/dental/search?q=${encodeURIComponent(q)}`);
      if (cancelled) return;
      if (r.ok) { setRes(r.data); setStatus("done"); }
      else { setRes(null); setStatus("error"); }
    }, 300);
    return () => { cancelled = true; clearTimeout(t); };
  }, [q]);

  const total = res ? res.patients.length + res.invoices.length + res.appointments.length : 0;

  return (
    <div className="relative mx-auto w-full max-w-md">
      <Search className="absolute right-3 top-2.5 h-4 w-4 text-[#94A3B8]" />
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onFocus={() => q.trim().length >= 2 && setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 200)}
        aria-label="بحث"
        placeholder="بحث عن مريض، هاتف، رقم فاتورة..."
        className="h-10 w-full rounded-xl border border-[#E5E7EB] bg-[#F8FAFC] pr-10 pl-3 text-sm outline-none focus:border-[#0F8B94]"
      />
      {open && q.trim().length >= 2 && (
        <div className="absolute inset-x-0 top-12 z-40 max-h-96 overflow-y-auto rounded-2xl border border-[#EAECEF] bg-white p-2 shadow-xl">
          {status === "loading" && <p className="p-3 text-center text-sm text-[#94A3B8]">جارِ البحث…</p>}
          {status === "error" && <p className="p-3 text-center text-sm text-rose-600">تعذّر تنفيذ البحث. حاول مجددًا.</p>}
          {status === "done" && total === 0 && <p className="p-3 text-center text-sm text-[#94A3B8]">لا نتائج مطابقة.</p>}
          {status === "done" && res && (
            <>
              {res.patients.length > 0 && <p className="px-2 py-1 text-[11px] font-bold text-[#94A3B8]">المرضى</p>}
              {res.patients.map((p) => (
                <button key={p.id} onMouseDown={() => { onOpenPatient(p.id); setOpen(false); setQ(""); }} className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-right text-sm hover:bg-[#F8FAFC]">
                  <span className="font-bold text-[#1F2937]">{p.fullName}</span>
                  <span className="text-xs text-[#94A3B8]" dir="ltr">{p.phone || p.patientNumber}</span>
                </button>
              ))}
              {res.appointments.length > 0 && <p className="px-2 py-1 text-[11px] font-bold text-[#94A3B8]">المواعيد</p>}
              {res.appointments.map((a) => (
                <button key={a.id} onMouseDown={() => { onOpenPatient(a.patientId); setOpen(false); setQ(""); }} className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-right text-sm hover:bg-[#F8FAFC]">
                  <span className="text-[#475569]">{a.fullName}</span>
                  <span className="text-xs text-[#94A3B8]">{fmtDate(a.startAt)}</span>
                </button>
              ))}
              {res.invoices.length > 0 && <p className="px-2 py-1 text-[11px] font-bold text-[#94A3B8]">الفواتير</p>}
              {res.invoices.map((v) => (
                <div key={v.id} className="flex items-center justify-between rounded-lg px-3 py-2 text-sm">
                  <span className="font-bold text-[#1F2937]" dir="ltr">{v.number}</span>
                  <span className="text-xs text-[#94A3B8]">{fmtMoney(v.total)}</span>
                </div>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function ComingSoon({ label }: { label: string }) {
  return (
    <div className="rounded-[24px] border border-dashed border-[#CBD5E1] bg-white p-16 text-center">
      <p className="text-lg font-bold text-[#334155]">{label}</p>
      <p className="mt-2 text-sm text-[#94A3B8]">هذه الوحدة قيد التطوير ضمن المراحل القادمة من النظام.</p>
    </div>
  );
}

/* ---------------- Treatments Catalog ---------------- */
type Catalog = {
  id: number;
  code: string;
  name: string;
  category: string;
  defaultPrice: number;
  estimatedDurationMin: number;
  requiresTooth: boolean;
  requiresSurface: boolean;
  requiresLab: boolean;
  expectedSessions: number;
  active: boolean;
};

function TreatmentsCatalog() {
  const [form, setForm] = useState({ code: "", name: "", category: "restorative", defaultPrice: "", expectedSessions: "1", requiresTooth: false, requiresSurface: false, requiresLab: false });
  const { pending, run } = useMutation();
  const { data, loading, error, reload } = useApi<{ items: Catalog[] }>("/api/dental/treatments/catalog?all=1");
  const items = data?.items ?? [];

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!form.code.trim() || !form.name.trim() || pending) return;
    const ok = await run("/api/dental/treatments/catalog", "POST", {
      code: form.code, name: form.name, category: form.category,
      defaultPrice: Number(form.defaultPrice) || 0, expectedSessions: Number(form.expectedSessions) || 1,
      requiresTooth: form.requiresTooth, requiresSurface: form.requiresSurface, requiresLab: form.requiresLab,
    }, { success: "تمت إضافة العلاج للكتالوج" });
    if (ok) {
      setForm({ code: "", name: "", category: "restorative", defaultPrice: "", expectedSessions: "1", requiresTooth: false, requiresSurface: false, requiresLab: false });
      reload();
    }
  }

  async function patch(id: number, body: Record<string, unknown>) {
    const ok = await run(`/api/dental/treatments/catalog/${id}`, "PATCH", body, { success: "تم تحديث العلاج" });
    if (ok) reload();
  }

  return (
    <div className="space-y-5">
      <div className="rounded-[24px] border border-[#EAECEF] bg-white p-6 shadow-sm">
        <h3 className="mb-1 text-lg font-bold text-[#1F2937]">كتالوج العلاجات</h3>
        <p className="mb-4 text-sm text-[#94A3B8]">الأسعار الافتراضية وعدد الجلسات المتوقعة لكل علاج. تُستخدم عند بناء خطط العلاج.</p>
        <form onSubmit={add} className="grid grid-cols-1 gap-2 md:grid-cols-[110px_1fr_150px_110px_90px_auto]">
          <input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="الرمز" className={INP} dir="ltr" />
          <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="اسم العلاج" className={INP} />
          <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className={INP}>
            {Object.entries(TREATMENT_CATEGORIES).map(([id, label]) => <option key={id} value={id}>{label}</option>)}
          </select>
          <input value={form.defaultPrice} onChange={(e) => setForm({ ...form, defaultPrice: e.target.value })} placeholder="السعر ₪" className={INP} inputMode="numeric" />
          <input value={form.expectedSessions} onChange={(e) => setForm({ ...form, expectedSessions: e.target.value })} placeholder="جلسات" className={INP} inputMode="numeric" />
          <button disabled={pending || !form.code.trim() || !form.name.trim()} className="inline-flex items-center justify-center gap-1 rounded-xl bg-[#0F8B94] px-4 py-2 text-sm font-bold text-white disabled:opacity-60"><Plus className="h-4 w-4" /> إضافة</button>
        </form>
        <div className="mt-2 flex flex-wrap gap-4 text-xs text-[#64748B]">
          <label className="inline-flex items-center gap-1.5"><input type="checkbox" checked={form.requiresTooth} onChange={(e) => setForm({ ...form, requiresTooth: e.target.checked })} /> يتطلب سِنّاً</label>
          <label className="inline-flex items-center gap-1.5"><input type="checkbox" checked={form.requiresSurface} onChange={(e) => setForm({ ...form, requiresSurface: e.target.checked })} /> يتطلب سطحاً</label>
          <label className="inline-flex items-center gap-1.5"><input type="checkbox" checked={form.requiresLab} onChange={(e) => setForm({ ...form, requiresLab: e.target.checked })} /> يتطلب مختبراً</label>
        </div>
      </div>

      <div className="rounded-[24px] border border-[#EAECEF] bg-white p-4 shadow-sm">
        <StateView loading={loading} error={error} onRetry={reload} isEmpty={items.length === 0} empty={<EmptyState icon={Stethoscope} title="لا توجد علاجات في الكتالوج بعد" hint="أضف أول علاج باستخدام النموذج بالأعلى." />}>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-right text-sm">
              <thead>
                <tr className="border-b border-[#EEF1F4] text-xs text-[#8B95A1]">
                  <th className="px-3 py-2 font-semibold">الرمز</th>
                  <th className="px-3 py-2 font-semibold">العلاج</th>
                  <th className="px-3 py-2 font-semibold">التصنيف</th>
                  <th className="px-3 py-2 font-semibold">السعر ₪</th>
                  <th className="px-3 py-2 font-semibold">جلسات</th>
                  <th className="px-3 py-2 font-semibold">متطلبات</th>
                  <th className="px-3 py-2 font-semibold">مفعّل</th>
                </tr>
              </thead>
              <tbody>
                {items.map((c) => (
                  <tr key={c.id} className={`border-b border-[#F5F7FA] last:border-none ${c.active ? "" : "opacity-50"}`}>
                    <td className="px-3 py-3 font-mono text-xs text-[#64748B]" dir="ltr">{c.code}</td>
                    <td className="px-3 py-3 font-bold text-[#1F2937]">{c.name}</td>
                    <td className="px-3 py-3 text-[#64748B]">{TREATMENT_CATEGORIES[c.category] || c.category}</td>
                    <td className="px-3 py-3">
                      <input
                        defaultValue={c.defaultPrice}
                        onBlur={(e) => { const v = Number(e.target.value) || 0; if (v !== c.defaultPrice) patch(c.id, { defaultPrice: v }); }}
                        className="w-24 rounded-lg border border-[#E5E7EB] px-2 py-1 text-sm font-bold text-[#334155]"
                        inputMode="numeric"
                      />
                    </td>
                    <td className="px-3 py-3">
                      <input
                        defaultValue={c.expectedSessions}
                        onBlur={(e) => { const v = Number(e.target.value) || 1; if (v !== c.expectedSessions) patch(c.id, { expectedSessions: v }); }}
                        className="w-14 rounded-lg border border-[#E5E7EB] px-2 py-1 text-sm text-[#334155]"
                        inputMode="numeric"
                      />
                    </td>
                    <td className="px-3 py-3 text-xs text-[#94A3B8]">
                      {[c.requiresTooth && "سِن", c.requiresSurface && "سطح", c.requiresLab && "مختبر"].filter(Boolean).join("، ") || "—"}
                    </td>
                    <td className="px-3 py-3">
                      <button onClick={() => patch(c.id, { active: !c.active })} className={`rounded-full px-2.5 py-1 text-xs font-bold ${c.active ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-400"}`}>
                        {c.active ? "مفعّل" : "متوقف"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </StateView>
      </div>
    </div>
  );
}

/* ---------------- Dashboard ---------------- */
type DashData = {
  today: { total: number; waiting: number; withDoctor: number; arrived: number; upcoming: number; completed: number; cancelled: number; noShow: number; newPatients: number };
  finance: { todayIncome: number; monthIncome: number; paid: number; remaining: number; byMethod: Record<string, number> };
  ops: { labsDue: number; lowStock: number; recallsDue: number; installmentsDue: number };
  upcoming: { startAt: string; fullName: string; doctorName: string | null; status: string }[];
  recent: { type: string; title: string; actorName: string | null; createdAt: string }[];
  alerts: { type: string; text: string }[];
};

function Dashboard({ onGo }: { onGo: (v: View) => void }) {
  const { data, loading, error, reload } = useApi<DashData>("/api/dental/dashboard");

  if (!data) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-[#1F2937]">ملخص اليوم</h2>
          <p className="mt-1 text-sm text-[#707A84]">نظرة مباشرة على وضع العيادة اليوم.</p>
        </div>
        <div className="rounded-[24px] border border-[#EAECEF] bg-white shadow-sm">
          <StateView loading={loading} error={error} onRetry={reload}>
            <div />
          </StateView>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-[#1F2937]">ملخص اليوم</h2>
        <p className="mt-1 text-sm text-[#707A84]">نظرة مباشرة على وضع العيادة اليوم.</p>
      </div>

      {/* Primary: live flow of the day — what reception/doctor act on right now */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6">
        <button onClick={() => onGo("reception")} className="text-right"><Kpi label="مواعيد اليوم" value={data.today.total} tone="teal" /></button>
        <button onClick={() => onGo("reception")} className="text-right"><Kpi label="بالانتظار" value={data.today.waiting} tone="amber" /></button>
        <button onClick={() => onGo("reception")} className="text-right"><Kpi label="مع الطبيب" value={data.today.withDoctor} tone="violet" /></button>
        <button onClick={() => onGo("reception")} className="text-right"><Kpi label="قادمة اليوم" value={data.today.upcoming} tone="blue" /></button>
        <Kpi label="مكتملة" value={data.today.completed} tone="emerald" />
        <button onClick={() => onGo("patients")} className="text-right"><Kpi label="مرضى جدد" value={data.today.newPatients} tone="teal" /></button>
      </div>

      {/* Secondary: things needing follow-up, muted so they don't compete with the live flow */}
      <div>
        <p className="mb-2 text-xs font-bold text-[#94A3B8]">يحتاج متابعة</p>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">
          <button onClick={() => onGo("recall")} className="text-right"><MiniStat label="تذكيرات مستحقة" value={data.ops.recallsDue} alert={data.ops.recallsDue > 0} /></button>
          <button onClick={() => onGo("labs")} className="text-right"><MiniStat label="مختبر متأخر" value={data.ops.labsDue} alert={data.ops.labsDue > 0} /></button>
          <button onClick={() => onGo("inventory")} className="text-right"><MiniStat label="مخزون منخفض" value={data.ops.lowStock} alert={data.ops.lowStock > 0} /></button>
          <MiniStat label="أقساط مستحقة" value={data.ops.installmentsDue} alert={data.ops.installmentsDue > 0} />
          <Kpi label="ملغاة" value={data.today.cancelled} tone="gray" />
          <Kpi label="لم يحضروا" value={data.today.noShow} tone="rose" />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="rounded-[24px] border border-[#EAECEF] bg-white p-6 shadow-sm lg:col-span-2">
          <h3 className="mb-4 text-lg font-bold text-[#1F2937]">الملخص المالي</h3>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <Money label="دخل اليوم" value={data.finance.todayIncome} />
            <Money label="دخل الشهر" value={data.finance.monthIncome} />
            <Money label="إجمالي المقبوض" value={data.finance.paid} />
            <Money label="متبقٍ على المرضى" value={data.finance.remaining} tone="rose" />
          </div>
          <div className="mt-5 border-t border-[#F1F5F9] pt-4">
            <p className="mb-2 text-xs font-bold text-[#94A3B8]">طرق الدفع</p>
            <div className="flex flex-wrap gap-2">
              {PAYMENT_METHODS.map((m) => (
                <span key={m.id} className="rounded-full bg-[#F1F5F9] px-3 py-1 text-xs font-bold text-[#475569]">
                  {m.label}: {fmtMoney(data.finance.byMethod[m.id] || 0)}
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="rounded-[24px] border border-[#EAECEF] bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <Bell className="h-5 w-5 text-[#0F8B94]" />
            <h3 className="text-lg font-bold text-[#1F2937]">التنبيهات</h3>
          </div>
          <div className="space-y-2">
            {data.alerts.length === 0 && <p className="text-sm text-[#94A3B8]">لا توجد تنبيهات حالياً.</p>}
            {data.alerts.map((a, i) => (
              <div key={i} className="rounded-xl bg-[#F8FAFC] px-3 py-2 text-sm text-[#475569]">{a.text}</div>
            ))}
          </div>
          <button onClick={() => onGo("reception")} className="mt-4 w-full rounded-xl bg-[#0F8B94] px-4 py-2 text-sm font-bold text-white hover:bg-[#0B6E75]">
            فتح الاستقبال
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <div className="rounded-[24px] border border-[#EAECEF] bg-white p-6 shadow-sm">
          <h3 className="mb-4 text-lg font-bold text-[#1F2937]">المواعيد القادمة</h3>
          <div className="space-y-2">
            {data.upcoming.length === 0 && <p className="text-sm text-[#94A3B8]">لا توجد مواعيد قادمة.</p>}
            {data.upcoming.map((u, i) => (
              <div key={i} className="flex items-center justify-between rounded-xl bg-[#F8FAFC] px-3 py-2 text-sm">
                <div><p className="font-bold text-[#1F2937]">{u.fullName}</p><p className="text-xs text-[#94A3B8]">{u.doctorName || ""}</p></div>
                <span className="text-xs font-bold text-[#0F8B94]">{fmtDateTime(u.startAt)}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-[24px] border border-[#EAECEF] bg-white p-6 shadow-sm">
          <h3 className="mb-4 text-lg font-bold text-[#1F2937]">آخر النشاطات</h3>
          <div className="space-y-2">
            {data.recent.length === 0 && <p className="text-sm text-[#94A3B8]">لا يوجد نشاط.</p>}
            {data.recent.map((r, i) => (
              <div key={i} className="flex items-center justify-between rounded-xl bg-[#F8FAFC] px-3 py-2 text-sm">
                <span className="text-[#475569]">{r.title}</span>
                <span className="text-xs text-[#94A3B8]">{fmtDate(r.createdAt)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------------- Patients ---------------- */
type PatientRow = { id: number; patientNumber: string; fullName: string; phone: string | null; gender: string | null; lastVisit: string | null };

function Patients({ onOpen }: { onOpen: (id: number) => void }) {
  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ fullName: "", phone: "", gender: "", nationalId: "", birthDate: "" });
  const { pending, run } = useMutation();

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q), 300);
    return () => clearTimeout(t);
  }, [q]);

  const { data, loading, error, reload } = useApi<{ patients: PatientRow[] }>(`/api/dental/patients?q=${encodeURIComponent(debouncedQ)}`);
  const rows = data?.patients ?? [];

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!form.fullName.trim() || pending) return;
    const created = await run<{ id: number }>("/api/dental/patients", "POST", form, { success: "تم إنشاء ملف المريض" });
    if (created) {
      setShowForm(false);
      setForm({ fullName: "", phone: "", gender: "", nationalId: "", birthDate: "" });
      onOpen(created.id);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-[#1F2937]">المرضى</h2>
          <p className="text-sm text-[#94A3B8]">إدارة ملفات المرضى والبحث عنهم.</p>
        </div>
        <button onClick={() => setShowForm((v) => !v)} className="inline-flex items-center gap-2 rounded-2xl bg-[#0F8B94] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#0B6E75]">
          <UserPlus className="h-4 w-4" />
          مريض جديد
        </button>
      </div>

      {showForm && (
        <form onSubmit={create} className="grid grid-cols-1 gap-3 rounded-[24px] border border-[#EAECEF] bg-white p-6 shadow-sm md:grid-cols-2">
          <input value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} placeholder="الاسم الكامل *" className={INP} required />
          <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="رقم الهاتف" className={INP} dir="ltr" />
          <input value={form.nationalId} onChange={(e) => setForm({ ...form, nationalId: e.target.value })} placeholder="رقم الهوية" className={INP} dir="ltr" />
          <select value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value })} className={INP}>
            <option value="">الجنس</option>
            <option value="ذكر">ذكر</option>
            <option value="أنثى">أنثى</option>
          </select>
          <input type="date" value={form.birthDate} onChange={(e) => setForm({ ...form, birthDate: e.target.value })} className={INP} />
          <button disabled={pending || !form.fullName.trim()} className="rounded-xl bg-[#0F8B94] px-4 py-2 text-sm font-bold text-white disabled:opacity-60 md:col-span-2">{pending ? "جارِ الحفظ…" : "حفظ المريض"}</button>
        </form>
      )}

      <div className="rounded-[24px] border border-[#EAECEF] bg-white shadow-sm">
        <div className="border-b border-[#EEF1F4] p-4">
          <div className="relative max-w-md">
            <Search className="absolute right-3 top-2.5 h-4 w-4 text-[#94A3B8]" />
            <input value={q} onChange={(e) => setQ(e.target.value)} aria-label="بحث المرضى" placeholder="بحث بالاسم أو الهاتف أو رقم المريض..." className={`${INP} pr-10`} />
          </div>
        </div>
        <StateView
          loading={loading}
          error={error}
          onRetry={reload}
          isEmpty={rows.length === 0}
          empty={<EmptyState icon={Users} title={debouncedQ ? "لا نتائج مطابقة للبحث" : "لا يوجد مرضى حتى الآن"} hint={debouncedQ ? "جرّب كلمة بحث أخرى." : "ابدأ بإضافة أول مريض للعيادة."} action={!debouncedQ ? <button onClick={() => setShowForm(true)} className="inline-flex items-center gap-2 rounded-xl bg-[#0F8B94] px-4 py-2 text-sm font-bold text-white hover:bg-[#0B6E75]"><UserPlus className="h-4 w-4" /> إضافة مريض</button> : undefined} />}
        >
          <div className="overflow-x-auto">
            <table className="w-full min-w-[620px] text-right text-sm">
              <thead>
                <tr className="border-b border-[#EEF1F4] text-xs text-[#8B95A1]">
                  <th className="px-4 py-3 font-semibold">رقم المريض</th>
                  <th className="px-4 py-3 font-semibold">الاسم</th>
                  <th className="px-4 py-3 font-semibold">الهاتف</th>
                  <th className="px-4 py-3 font-semibold">آخر زيارة</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} onClick={() => onOpen(r.id)} className="cursor-pointer border-b border-[#F5F7FA] transition last:border-none hover:bg-[#F1FBFA]">
                    <td className="px-4 py-3.5 font-mono text-xs text-[#475569]" dir="ltr">{r.patientNumber}</td>
                    <td className="px-4 py-3.5 font-bold text-[#1F2937]">{r.fullName}</td>
                    <td className="px-4 py-3.5 text-[#4B5563]" dir="ltr">{r.phone || "—"}</td>
                    <td className="px-4 py-3.5 text-[#94A3B8]">{r.lastVisit ? fmtDate(r.lastVisit) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </StateView>
      </div>
    </div>
  );
}

/* ---------------- Reception ---------------- */
type Appt = { id: number; patientId: number; patientName: string; phone: string | null; doctorName: string | null; treatmentType: string | null; startAt: string; durationMin: number; room: string | null; status: string };

function ReceptionHub({ onOpenPatient }: { onOpenPatient: (id: number, tab?: string) => void }) {
  const [mode, setMode] = useState<"calendar" | "list">("calendar");
  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <div className="flex rounded-xl border border-[#E5E7EB] bg-white p-0.5">
          <button onClick={() => setMode("calendar")} className={`rounded-lg px-3 py-1.5 text-sm font-bold ${mode === "calendar" ? "bg-[#0F8B94] text-white" : "text-[#475569]"}`}>التقويم</button>
          <button onClick={() => setMode("list")} className={`rounded-lg px-3 py-1.5 text-sm font-bold ${mode === "list" ? "bg-[#0F8B94] text-white" : "text-[#475569]"}`}>قائمة اليوم</button>
        </div>
      </div>
      {mode === "calendar" ? <DentalCalendar onOpenPatient={onOpenPatient} /> : <Reception onOpenPatient={onOpenPatient} />}
    </div>
  );
}

function Reception({ onOpenPatient }: { onOpenPatient: (id: number, tab?: string) => void }) {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [showForm, setShowForm] = useState(false);
  const [patients, setPatients] = useState<PatientRow[]>([]);
  const [options, setOptions] = useState<{ doctors: string[]; rooms: string[]; treatments: { id: number; name: string; defaultPrice: number }[] }>({ doctors: [], rooms: [], treatments: [] });
  const [form, setForm] = useState({ patientId: "", treatmentType: "", doctorName: "", startAt: "", durationMin: "30", room: "" });
  const { pending, run } = useMutation();

  const { data, loading, error, reload } = useApi<{ appointments: Appt[] }>(`/api/dental/appointments?date=${date}`);
  const appts = data?.appointments ?? [];

  useEffect(() => {
    if (showForm) {
      if (patients.length === 0) apiFetch<{ patients: PatientRow[] }>("/api/dental/patients").then((r) => { if (r.ok) setPatients(r.data.patients || []); });
      apiFetch<typeof options>("/api/dental/clinic-options").then((r) => { if (r.ok) setOptions(r.data); });
    }
  }, [showForm, patients.length]);

  async function sendToDoctor(appointmentId: number) {
    const r = await run<{ patientId: number }>(`/api/dental/appointments/${appointmentId}/start-visit`, "POST", undefined, { success: "تم إدخال المريض للطبيب" });
    if (r) onOpenPatient(r.patientId, "visits");
  }

  async function setStatus(id: number, status: string) {
    const ok = await run(`/api/dental/appointments/${id}`, "PATCH", { status }, { success: "تم تحديث حالة الموعد" });
    if (ok) reload();
  }

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!form.patientId || !form.startAt || pending) return;
    const ok = await run(`/api/dental/appointments`, "POST", { ...form, startAt: new Date(form.startAt).toISOString() }, { success: "تم حجز الموعد" });
    if (ok) {
      setShowForm(false);
      setForm({ patientId: "", treatmentType: "", doctorName: "", startAt: "", durationMin: "30", room: "" });
      reload();
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-2xl font-bold text-[#1F2937]">قائمة اليوم</h2>
        <div className="flex items-center gap-2">
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} aria-label="تاريخ" className="h-10 rounded-xl border border-[#E5E7EB] bg-white px-3 text-sm outline-none focus:border-[#0F8B94]" />
          <button onClick={() => setShowForm((v) => !v)} className="inline-flex items-center gap-2 rounded-2xl bg-[#0F8B94] px-4 py-2 text-sm font-bold text-white hover:bg-[#0B6E75]">
            <Plus className="h-4 w-4" />
            موعد جديد
          </button>
        </div>
      </div>

      {showForm && (
        <form onSubmit={create} className="grid grid-cols-1 gap-3 rounded-[24px] border border-[#EAECEF] bg-white p-6 shadow-sm md:grid-cols-3">
          <select value={form.patientId} onChange={(e) => setForm({ ...form, patientId: e.target.value })} className={INP} required>
            <option value="">اختر المريض</option>
            {patients.map((p) => <option key={p.id} value={p.id}>{p.fullName} — {p.patientNumber}</option>)}
          </select>
          <select value={form.treatmentType} onChange={(e) => setForm({ ...form, treatmentType: e.target.value })} className={INP}>
            <option value="">نوع العلاج</option>
            {options.treatments.map((t) => <option key={t.id} value={t.name}>{t.name}</option>)}
          </select>
          <select value={form.doctorName} onChange={(e) => setForm({ ...form, doctorName: e.target.value })} className={INP}>
            <option value="">الطبيب</option>
            {options.doctors.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
          <input type="datetime-local" value={form.startAt} onChange={(e) => setForm({ ...form, startAt: e.target.value })} className={INP} required />
          <input value={form.durationMin} onChange={(e) => setForm({ ...form, durationMin: e.target.value })} placeholder="المدة (دقيقة)" className={INP} inputMode="numeric" />
          <select value={form.room} onChange={(e) => setForm({ ...form, room: e.target.value })} className={INP}>
            <option value="">الغرفة</option>
            {options.rooms.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
          <button disabled={pending || !form.patientId || !form.startAt} className="rounded-xl bg-[#0F8B94] px-4 py-2 text-sm font-bold text-white disabled:opacity-60 md:col-span-3">{pending ? "جارِ الحفظ…" : "حفظ الموعد"}</button>
        </form>
      )}

      <div className="rounded-[24px] border border-[#EAECEF] bg-white shadow-sm">
        <StateView
          loading={loading}
          error={error}
          onRetry={reload}
          isEmpty={appts.length === 0}
          empty={<EmptyState icon={CalendarDays} title="لا توجد مواعيد في هذا اليوم" hint="أضف موعدًا جديدًا أو اختر تاريخًا آخر." action={<button onClick={() => setShowForm(true)} className="inline-flex items-center gap-2 rounded-xl bg-[#0F8B94] px-4 py-2 text-sm font-bold text-white hover:bg-[#0B6E75]"><Plus className="h-4 w-4" /> موعد جديد</button>} />}
        >
          <div className="divide-y divide-[#F1F5F9]">
            {appts.map((a) => (
              <div key={a.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5">
                <div className="flex items-center gap-4">
                  <span className="w-14 text-sm font-black text-[#0F8B94]">{fmtTime(a.startAt)}</span>
                  <div>
                    <p className="font-bold text-[#1F2937]">{a.patientName}</p>
                    <p className="text-xs text-[#94A3B8]">{[a.treatmentType, a.doctorName, a.room].filter(Boolean).join(" · ") || "—"}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => sendToDoctor(a.id)} disabled={pending} className="inline-flex items-center gap-1 rounded-lg bg-[#F1FBFA] px-2.5 py-1 text-xs font-bold text-[#0F8B94] hover:bg-[#E3F5F4] disabled:opacity-60">
                    <Stethoscope className="h-3.5 w-3.5" /> إدخال للدكتور
                  </button>
                  <button onClick={() => onOpenPatient(a.patientId, "billing")} className="rounded-lg bg-[#F8FAFC] px-2.5 py-1 text-xs font-bold text-[#475569] hover:bg-[#EEF2F6]">دفع</button>
                  <select
                    value={a.status}
                    disabled={pending}
                    onChange={(e) => setStatus(a.id, e.target.value)}
                    className={`rounded-lg border-0 px-2.5 py-1 text-xs font-bold disabled:opacity-60 ${APPOINTMENT_STATUS_MAP[a.status]?.color || "bg-slate-100 text-slate-600"}`}
                  >
                    {APPOINTMENT_STATUSES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
                  </select>
                </div>
              </div>
            ))}
          </div>
        </StateView>
      </div>
    </div>
  );
}

/* ---------------- shared ---------------- */
const TONES: Record<string, string> = {
  teal: "text-[#0F8B94]",
  emerald: "text-emerald-600",
  blue: "text-blue-600",
  rose: "text-rose-600",
  gray: "text-gray-500",
  violet: "text-violet-600",
  amber: "text-amber-600",
};

function Kpi({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="rounded-[20px] border border-[#EAECEF] bg-white p-4 shadow-sm">
      <p className={`text-3xl font-black ${TONES[tone] || TONES.teal}`}>{value}</p>
      <p className="mt-1 text-xs font-bold text-[#64748B]">{label}</p>
    </div>
  );
}

/** Compact secondary metric — visually lighter than a KPI, highlights only when there's something to act on. */
function MiniStat({ label, value, alert }: { label: string; value: number; alert?: boolean }) {
  return (
    <div className={`rounded-2xl border p-3 shadow-sm ${alert ? "border-rose-200 bg-rose-50/60" : "border-[#EAECEF] bg-white"}`}>
      <p className={`text-xl font-black ${alert ? "text-rose-600" : "text-[#334155]"}`}>{value}</p>
      <p className="mt-0.5 text-[11px] font-bold text-[#64748B]">{label}</p>
    </div>
  );
}

function Money({ label, value, tone }: { label: string; value: number; tone?: string }) {
  return (
    <div>
      <p className="text-xs text-[#94A3B8]">{label}</p>
      <p className={`mt-1 text-xl font-black ${tone === "rose" ? "text-rose-600" : "text-[#1F2937]"}`}>{fmtMoney(value)}</p>
    </div>
  );
}

const INP = "h-11 w-full rounded-xl border border-[#E5E7EB] bg-white px-3 text-sm text-[#1F2937] outline-none focus:border-[#0F8B94]";

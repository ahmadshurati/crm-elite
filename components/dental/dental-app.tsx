"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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
  Package,
  Plus,
  Search,
  Stethoscope,
  UserPlus,
  Users,
} from "lucide-react";
import { PatientProfile } from "@/components/dental/patient-profile";
import { APPOINTMENT_STATUSES, APPOINTMENT_STATUS_MAP, PAYMENT_METHODS } from "@/lib/dental/constants";

type View = "dashboard" | "reception" | "patients" | "treatments" | "finance" | "labs" | "inventory" | "recall" | "reports" | "staff" | "settings";

const NAV: { id: View; label: string; icon: typeof Users; ready: boolean }[] = [
  { id: "dashboard", label: "لوحة اليوم", icon: LayoutGrid, ready: true },
  { id: "reception", label: "الاستقبال والمواعيد", icon: CalendarDays, ready: true },
  { id: "patients", label: "المرضى", icon: Users, ready: true },
  { id: "treatments", label: "العلاجات", icon: Stethoscope, ready: false },
  { id: "finance", label: "المالية", icon: BadgeDollarSign, ready: false },
  { id: "labs", label: "المختبرات", icon: FlaskConical, ready: false },
  { id: "inventory", label: "المخزون", icon: Package, ready: false },
  { id: "recall", label: "التذكير والمتابعة", icon: Bell, ready: false },
  { id: "reports", label: "التقارير", icon: Activity, ready: false },
  { id: "staff", label: "الأطباء والموظفون", icon: ClipboardList, ready: false },
  { id: "settings", label: "الإعدادات", icon: ClipboardList, ready: false },
];

export function DentalApp() {
  const [ready, setReady] = useState(false);
  const [clinic, setClinic] = useState("");
  const [view, setView] = useState<View>("dashboard");
  const [patientId, setPatientId] = useState<number | null>(null);

  useEffect(() => {
    fetch("/api/dental/me", { cache: "no-store" })
      .then((res) => {
        if (res.status === 401) {
          window.location.replace("/login");
          return null;
        }
        if (res.status === 403) {
          window.location.replace("/");
          return null;
        }
        return res.json();
      })
      .then((data) => {
        if (data) {
          setClinic(data.clinicName || "عيادة");
          setReady(true);
        }
      })
      .catch(() => window.location.replace("/login"));
  }, []);

  async function logout() {
    await fetch("/api/logout", { method: "POST" }).catch(() => {});
    window.location.href = "/login";
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
    setView(v);
  }

  return (
    <div dir="rtl" className="flex min-h-screen bg-[#F5F8FB] text-[#1F2937]">
      <aside className="sticky top-0 flex h-screen w-[248px] shrink-0 flex-col border-l border-[#E5E9EF] bg-white">
        <div className="flex items-center gap-2.5 border-b border-[#EEF1F4] px-5 py-5">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#0F8B94] text-white">
            <Stethoscope className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-extrabold text-[#0F8B94]">Gosol Dental</p>
            <p className="text-[11px] text-[#94A3B8]">نظام إدارة العيادة</p>
          </div>
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
          {NAV.map((n) => (
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
        <div className="sticky top-0 z-30 flex items-center justify-between border-b border-[#EAECEF] bg-white px-6 py-4">
          <h1 className="text-lg font-bold text-[#1F2937]">{clinic}</h1>
          <span className="rounded-full bg-[#E7F6F5] px-3 py-1 text-xs font-bold text-[#0F8B94]">عيادة أسنان</span>
        </div>

        <div className="p-6">
          {patientId ? (
            <PatientProfile patientId={patientId} onBack={() => setPatientId(null)} />
          ) : view === "dashboard" ? (
            <Dashboard onGo={go} />
          ) : view === "reception" ? (
            <Reception />
          ) : view === "patients" ? (
            <Patients onOpen={(id) => setPatientId(id)} />
          ) : (
            <ComingSoon label={NAV.find((n) => n.id === view)?.label || ""} />
          )}
        </div>
      </main>
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

/* ---------------- Dashboard ---------------- */
type DashData = {
  today: { total: number; arrived: number; upcoming: number; cancelled: number; noShow: number; newPatients: number };
  finance: { todayIncome: number; monthIncome: number; paid: number; remaining: number; byMethod: Record<string, number> };
  alerts: { type: string; text: string }[];
};

function Dashboard({ onGo }: { onGo: (v: View) => void }) {
  const [data, setData] = useState<DashData | null>(null);
  useEffect(() => {
    fetch("/api/dental/dashboard", { cache: "no-store" }).then((r) => {
      if (r.ok) r.json().then(setData);
    });
  }, []);

  if (!data) return <Spinner />;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-[#1F2937]">ملخص اليوم</h2>
        <p className="mt-1 text-sm text-[#707A84]">نظرة مباشرة على وضع العيادة اليوم.</p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6">
        <Kpi label="مواعيد اليوم" value={data.today.total} tone="teal" />
        <Kpi label="وصلوا" value={data.today.arrived} tone="emerald" />
        <Kpi label="قادمة" value={data.today.upcoming} tone="blue" />
        <Kpi label="ملغاة" value={data.today.cancelled} tone="rose" />
        <Kpi label="لم يحضروا" value={data.today.noShow} tone="gray" />
        <Kpi label="مرضى جدد" value={data.today.newPatients} tone="violet" />
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
                  {m.label}: ₪ {(data.finance.byMethod[m.id] || 0).toLocaleString()}
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
    </div>
  );
}

/* ---------------- Patients ---------------- */
type PatientRow = { id: number; patientNumber: string; fullName: string; phone: string | null; gender: string | null; lastVisit: string | null };

function Patients({ onOpen }: { onOpen: (id: number) => void }) {
  const [rows, setRows] = useState<PatientRow[]>([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ fullName: "", phone: "", gender: "", nationalId: "", birthDate: "" });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async (search: string) => {
    setLoading(true);
    const res = await fetch(`/api/dental/patients?q=${encodeURIComponent(search)}`, { cache: "no-store" });
    if (res.ok) setRows((await res.json()).patients || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    const t = setTimeout(() => load(q), 250);
    return () => clearTimeout(t);
  }, [q, load]);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!form.fullName.trim()) return;
    setSaving(true);
    try {
      const res = await fetch("/api/dental/patients", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      const data = await res.json();
      if (res.ok) {
        setShowForm(false);
        setForm({ fullName: "", phone: "", gender: "", nationalId: "", birthDate: "" });
        onOpen(data.id);
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-2xl font-bold text-[#1F2937]">المرضى</h2>
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
          <button disabled={saving} className="rounded-xl bg-[#0F8B94] px-4 py-2 text-sm font-bold text-white md:col-span-2">{saving ? "..." : "حفظ المريض"}</button>
        </form>
      )}

      <div className="rounded-[24px] border border-[#EAECEF] bg-white shadow-sm">
        <div className="border-b border-[#EEF1F4] p-4">
          <div className="relative max-w-md">
            <Search className="absolute right-3 top-2.5 h-4 w-4 text-[#94A3B8]" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="بحث بالاسم أو الهاتف أو رقم المريض..." className={`${INP} pr-10`} />
          </div>
        </div>
        {loading ? (
          <Spinner />
        ) : rows.length === 0 ? (
          <p className="py-16 text-center text-sm text-[#94A3B8]">لا يوجد مرضى.</p>
        ) : (
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
                    <td className="px-4 py-3.5 text-[#94A3B8]">{r.lastVisit ? new Date(r.lastVisit).toLocaleDateString("ar") : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------------- Reception ---------------- */
type Appt = { id: number; patientId: number; patientName: string; phone: string | null; doctorName: string | null; treatmentType: string | null; startAt: string; durationMin: number; room: string | null; status: string };

function Reception() {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [appts, setAppts] = useState<Appt[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [patients, setPatients] = useState<PatientRow[]>([]);
  const [form, setForm] = useState({ patientId: "", treatmentType: "", doctorName: "", startAt: "", durationMin: "30", room: "" });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async (d: string) => {
    setLoading(true);
    const res = await fetch(`/api/dental/appointments?date=${d}`, { cache: "no-store" });
    if (res.ok) setAppts((await res.json()).appointments || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load(date);
  }, [date, load]);

  useEffect(() => {
    if (showForm && patients.length === 0) {
      fetch("/api/dental/patients", { cache: "no-store" }).then((r) => {
        if (r.ok) r.json().then((d) => setPatients(d.patients || []));
      });
    }
  }, [showForm, patients.length]);

  async function setStatus(id: number, status: string) {
    await fetch(`/api/dental/appointments/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) });
    load(date);
  }

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!form.patientId || !form.startAt) return;
    setSaving(true);
    try {
      const res = await fetch("/api/dental/appointments", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      if (res.ok) {
        setShowForm(false);
        setForm({ patientId: "", treatmentType: "", doctorName: "", startAt: "", durationMin: "30", room: "" });
        load(date);
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-2xl font-bold text-[#1F2937]">الاستقبال والمواعيد</h2>
        <div className="flex items-center gap-2">
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-10 rounded-xl border border-[#E5E7EB] bg-white px-3 text-sm outline-none focus:border-[#0F8B94]" />
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
          <input value={form.treatmentType} onChange={(e) => setForm({ ...form, treatmentType: e.target.value })} placeholder="نوع العلاج" className={INP} />
          <input value={form.doctorName} onChange={(e) => setForm({ ...form, doctorName: e.target.value })} placeholder="الطبيب" className={INP} />
          <input type="datetime-local" value={form.startAt} onChange={(e) => setForm({ ...form, startAt: e.target.value })} className={INP} required />
          <input value={form.durationMin} onChange={(e) => setForm({ ...form, durationMin: e.target.value })} placeholder="المدة (دقيقة)" className={INP} inputMode="numeric" />
          <input value={form.room} onChange={(e) => setForm({ ...form, room: e.target.value })} placeholder="الغرفة" className={INP} />
          <button disabled={saving} className="rounded-xl bg-[#0F8B94] px-4 py-2 text-sm font-bold text-white md:col-span-3">{saving ? "..." : "حفظ الموعد"}</button>
        </form>
      )}

      <div className="rounded-[24px] border border-[#EAECEF] bg-white shadow-sm">
        {loading ? (
          <Spinner />
        ) : appts.length === 0 ? (
          <p className="py-16 text-center text-sm text-[#94A3B8]">لا توجد مواعيد في هذا اليوم.</p>
        ) : (
          <div className="divide-y divide-[#F1F5F9]">
            {appts.map((a) => (
              <div key={a.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5">
                <div className="flex items-center gap-4">
                  <span className="w-14 text-sm font-black text-[#0F8B94]">{new Date(a.startAt).toLocaleTimeString("ar", { hour: "2-digit", minute: "2-digit" })}</span>
                  <div>
                    <p className="font-bold text-[#1F2937]">{a.patientName}</p>
                    <p className="text-xs text-[#94A3B8]">{[a.treatmentType, a.doctorName, a.room].filter(Boolean).join(" · ") || "—"}</p>
                  </div>
                </div>
                <select
                  value={a.status}
                  onChange={(e) => setStatus(a.id, e.target.value)}
                  className={`rounded-lg border-0 px-2.5 py-1 text-xs font-bold ${APPOINTMENT_STATUS_MAP[a.status]?.color || "bg-slate-100 text-slate-600"}`}
                >
                  {APPOINTMENT_STATUSES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
                </select>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------------- shared ---------------- */
function Spinner() {
  return (
    <div className="flex items-center justify-center py-16 text-[#94A3B8]">
      <Loader2 className="h-6 w-6 animate-spin" />
    </div>
  );
}

const TONES: Record<string, string> = {
  teal: "text-[#0F8B94]",
  emerald: "text-emerald-600",
  blue: "text-blue-600",
  rose: "text-rose-600",
  gray: "text-gray-500",
  violet: "text-violet-600",
};

function Kpi({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="rounded-[20px] border border-[#EAECEF] bg-white p-4 shadow-sm">
      <p className={`text-3xl font-black ${TONES[tone] || TONES.teal}`}>{value}</p>
      <p className="mt-1 text-xs font-bold text-[#64748B]">{label}</p>
    </div>
  );
}

function Money({ label, value, tone }: { label: string; value: number; tone?: string }) {
  return (
    <div>
      <p className="text-xs text-[#94A3B8]">{label}</p>
      <p className={`mt-1 text-xl font-black ${tone === "rose" ? "text-rose-600" : "text-[#1F2937]"}`}>₪ {value.toLocaleString()}</p>
    </div>
  );
}

const INP = "h-11 w-full rounded-xl border border-[#E5E7EB] bg-white px-3 text-sm text-[#1F2937] outline-none focus:border-[#0F8B94]";

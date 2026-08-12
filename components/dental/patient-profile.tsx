"use client";

import { Fragment, useCallback, useEffect, useState } from "react";
import { AlertTriangle, ArrowRight, CalendarClock, ChevronDown, ClipboardList, Layers, Loader2, Plus, Wallet } from "lucide-react";
import { DentalChart } from "@/components/dental/dental-chart";
import { PAYMENT_METHODS, PLAN_ITEM_STATUSES, PLAN_ITEM_STATUS_MAP } from "@/lib/dental/constants";

const TABS = [
  { id: "overview", label: "نظرة عامة" },
  { id: "medical", label: "التاريخ الطبي" },
  { id: "chart", label: "مخطط الأسنان" },
  { id: "visits", label: "الزيارات" },
  { id: "plan", label: "خطة العلاج" },
  { id: "billing", label: "الحساب المالي" },
  { id: "rx", label: "الوصفات" },
  { id: "timeline", label: "السجل الزمني" },
] as const;

type MedicalFlags = { diabetes: boolean; hypertension: boolean; heartDisease: boolean; bloodThinners: boolean; pregnancy: string };

type Profile = {
  patient: {
    id: number;
    patientNumber: string;
    fullName: string;
    nationalId: string | null;
    birthDate: string | null;
    age: number | null;
    gender: string | null;
    phone: string | null;
    whatsapp: string | null;
    email: string | null;
    address: string | null;
    emergencyContact: string | null;
    notes: string | null;
    medicalHistory: string[];
    allergies: string[];
    medications: string[];
    otherConditions: string[];
    medical: MedicalFlags;
    medicalReviewedAt: string | null;
    medicalReviewedBy: string | null;
    alerts: string[];
  };
  planCounts: Record<string, number>;
  nextAppointment: { id: number; startAt: string; treatmentType: string | null; doctorName: string | null } | null;
  lastVisit: string | null;
  teeth: { toothNumber: number; condition: string }[];
  toothSurfaces: { toothNumber: number; surface: string; condition: string }[];
  visits: { id: number; visitDate: string; doctorName: string | null; chiefComplaint: string | null; diagnosis: string | null; teeth: string | null; procedures: string | null; notes: string | null }[];
  plan: { id: number; title: string; discount: number; insurance: number; status: string } | null;
  planItems: {
    id: number;
    catalogId: number | null;
    toothNumber: number | null;
    treatment: string;
    price: number;
    status: string;
    expectedSessions: number | null;
    sessionsDone: number;
    acceptedAt: string | null;
    completedAt: string | null;
  }[];
  payments: { id: number; amount: number; method: string; notes: string | null; voided: boolean; createdAt: string }[];
  prescriptions: { id: number; items: string[]; notes: string | null; createdAt: string }[];
  appointments: { id: number; startAt: string; treatmentType: string | null; status: string }[];
  timeline: { id: number; type: string; title: string; actorName: string | null; createdAt: string }[];
  finance: { subtotal: number; chargeable: number; discount: number; insurance: number; responsibility: number; due: number; paid: number; balance: number };
};

type CatalogItem = {
  id: number;
  code: string;
  name: string;
  category: string;
  defaultPrice: number;
  requiresTooth: boolean;
  requiresSurface: boolean;
  requiresLab: boolean;
  expectedSessions: number;
};

export function PatientProfile({ patientId, onBack }: { patientId: number; onBack: () => void }) {
  const [data, setData] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<(typeof TABS)[number]["id"]>("overview");

  const load = useCallback(async () => {
    const res = await fetch(`/api/dental/patients/${patientId}`, { cache: "no-store" });
    if (res.ok) setData(await res.json());
    setLoading(false);
  }, [patientId]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading || !data) {
    return (
      <div className="flex items-center justify-center py-24 text-[#94A3B8]">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  const p = data.patient;

  return (
    <div className="space-y-5">
      <button onClick={onBack} className="inline-flex items-center gap-1.5 text-sm font-bold text-[#0F8B94]">
        <ArrowRight className="h-4 w-4" />
        رجوع للمرضى
      </button>

      <div className="rounded-[24px] border border-[#EAECEF] bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-[#1F2937]">{p.fullName}</h2>
            <p className="mt-1 text-sm text-[#707A84]">
              رقم المريض: {p.patientNumber}
              {p.age != null && <span> · العمر {p.age}</span>}
              {p.phone && <span dir="ltr"> · {p.phone}</span>}
            </p>
          </div>
          <div className="flex flex-wrap gap-6 text-center">
            <div>
              <p className="text-xs text-[#94A3B8]">آخر زيارة</p>
              <p className="text-sm font-bold text-[#334155]">{data.lastVisit ? new Date(data.lastVisit).toLocaleDateString("ar") : "—"}</p>
            </div>
            <div>
              <p className="text-xs text-[#94A3B8]">الموعد القادم</p>
              <p className="text-sm font-bold text-[#334155]">{data.nextAppointment ? new Date(data.nextAppointment.startAt).toLocaleDateString("ar") : "—"}</p>
            </div>
            <div>
              <p className="text-xs text-[#94A3B8]">الرصيد المتبقي</p>
              <p className={`text-xl font-black ${data.finance.balance > 0 ? "text-rose-600" : "text-emerald-600"}`}>
                ₪ {data.finance.balance.toLocaleString()}
              </p>
            </div>
          </div>
        </div>

        {p.alerts.length > 0 && (
          <div className="mt-4 flex flex-wrap items-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-2.5">
            <AlertTriangle className="h-4 w-4 shrink-0 text-rose-600" />
            <span className="text-xs font-bold text-rose-700">تنبيه طبي:</span>
            {p.alerts.map((a) => (
              <span key={a} className="rounded-full bg-white px-2.5 py-0.5 text-xs font-bold text-rose-700 ring-1 ring-rose-200">{a}</span>
            ))}
          </div>
        )}

        <div className="mt-5 flex flex-wrap gap-1.5 border-t border-[#F1F5F9] pt-4">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`rounded-full px-3.5 py-1.5 text-sm font-bold transition ${tab === t.id ? "bg-[#0F8B94] text-white" : "bg-[#F1F5F9] text-[#475569] hover:bg-[#E7F6F5]"}`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {tab === "overview" && <Overview data={data} onGo={setTab} />}
      {tab === "medical" && <MedicalHistory patientId={patientId} p={p} onChange={load} />}
      {tab === "chart" && <DentalChart patientId={patientId} teeth={data.teeth} surfaces={data.toothSurfaces} onChange={load} />}
      {tab === "visits" && <Visits patientId={patientId} visits={data.visits} onChange={load} />}
      {tab === "plan" && <TreatmentPlan patientId={patientId} data={data} onChange={load} />}
      {tab === "billing" && <Billing patientId={patientId} data={data} onChange={load} />}
      {tab === "rx" && <Prescriptions patientId={patientId} list={data.prescriptions} onChange={load} />}
      {tab === "timeline" && <Timeline events={data.timeline} />}
    </div>
  );
}

function Timeline({ events }: { events: Profile["timeline"] }) {
  return (
    <Card>
      <h3 className="mb-4 text-lg font-bold text-[#1F2937]">السجل الزمني للمريض</h3>
      {events.length === 0 ? (
        <p className="py-8 text-center text-sm text-[#94A3B8]">لا توجد أحداث بعد. تُسجَّل الأحداث تلقائياً مع كل عملية.</p>
      ) : (
        <div className="relative space-y-4 pr-4">
          {events.map((e) => (
            <div key={e.id} className="relative border-r-2 border-[#E7F6F5] pr-5">
              <span className="absolute right-[-7px] top-1 h-3 w-3 rounded-full bg-[#0F8B94]" />
              <p className="text-sm font-bold text-[#1F2937]">{e.title}</p>
              <p className="mt-0.5 text-xs text-[#94A3B8]">
                {new Date(e.createdAt).toLocaleString("ar")}
                {e.actorName ? ` · ${e.actorName}` : ""}
              </p>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return <div className="rounded-[24px] border border-[#EAECEF] bg-white p-6 shadow-sm">{children}</div>;
}

function Overview({ data, onGo }: { data: Profile; onGo: (t: (typeof TABS)[number]["id"]) => void }) {
  const p = data.patient;
  const info: [string, string | null][] = [
    ["رقم الهوية", p.nationalId],
    ["العمر", p.age != null ? String(p.age) : null],
    ["الجنس", p.gender],
    ["الهاتف", p.phone],
    ["واتساب", p.whatsapp],
    ["البريد", p.email],
    ["العنوان", p.address],
    ["جهة اتصال للطوارئ", p.emergencyContact],
  ];
  const recent = data.timeline.slice(0, 6);

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
      {/* Medical alerts */}
      <Card>
        <div className="mb-3 flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-rose-500" />
          <h3 className="text-lg font-bold text-[#1F2937]">تنبيهات طبية</h3>
        </div>
        {p.alerts.length ? (
          <div className="flex flex-wrap gap-2">
            {p.alerts.map((a) => (
              <span key={a} className="rounded-full bg-rose-50 px-3 py-1 text-sm font-bold text-rose-700">{a}</span>
            ))}
          </div>
        ) : (
          <p className="text-sm text-[#94A3B8]">لا توجد تنبيهات طبية مسجّلة.</p>
        )}
        <button onClick={() => onGo("medical")} className="mt-4 text-xs font-bold text-[#0F8B94]">تحديث التاريخ الطبي ←</button>
      </Card>

      {/* Upcoming appointment */}
      <Card>
        <div className="mb-3 flex items-center gap-2">
          <CalendarClock className="h-5 w-5 text-[#0F8B94]" />
          <h3 className="text-lg font-bold text-[#1F2937]">الموعد القادم</h3>
        </div>
        {data.nextAppointment ? (
          <div>
            <p className="text-lg font-bold text-[#1F2937]">{new Date(data.nextAppointment.startAt).toLocaleString("ar", { dateStyle: "medium", timeStyle: "short" })}</p>
            <p className="mt-1 text-sm text-[#707A84]">{[data.nextAppointment.treatmentType, data.nextAppointment.doctorName].filter(Boolean).join(" · ") || "—"}</p>
          </div>
        ) : (
          <p className="text-sm text-[#94A3B8]">لا يوجد موعد قادم.</p>
        )}
      </Card>

      {/* Active treatment plan */}
      <Card>
        <div className="mb-3 flex items-center gap-2">
          <ClipboardList className="h-5 w-5 text-violet-500" />
          <h3 className="text-lg font-bold text-[#1F2937]">خطة العلاج النشطة</h3>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat n={data.planCounts.proposed || 0} label="مقترح" />
          <Stat n={data.planCounts.approved || 0} label="موافق عليه" />
          <Stat n={data.planCounts.in_progress || 0} label="قيد التنفيذ" />
          <Stat n={data.planCounts.completed || 0} label="مكتمل" />
        </div>
        <button onClick={() => onGo("plan")} className="mt-4 text-xs font-bold text-[#0F8B94]">فتح خطة العلاج ←</button>
      </Card>

      {/* Financial summary */}
      <Card>
        <div className="mb-3 flex items-center gap-2">
          <Wallet className="h-5 w-5 text-amber-500" />
          <h3 className="text-lg font-bold text-[#1F2937]">الملخص المالي</h3>
        </div>
        <div className="space-y-1.5 text-sm">
          <Row k="إجمالي العلاجات" v={`₪ ${data.finance.chargeable.toLocaleString()}`} />
          <Row k="الخصم" v={`₪ ${data.finance.discount.toLocaleString()}`} />
          <Row k="المدفوع" v={`₪ ${data.finance.paid.toLocaleString()}`} />
          <Row k="المتبقي" v={`₪ ${data.finance.balance.toLocaleString()}`} strong />
        </div>
      </Card>

      {/* Personal info */}
      <Card>
        <h3 className="mb-4 text-lg font-bold text-[#1F2937]">المعلومات الشخصية</h3>
        <div className="grid grid-cols-2 gap-3 text-sm">
          {info.map(([k, v]) => (
            <div key={k}>
              <p className="text-xs text-[#94A3B8]">{k}</p>
              <p className="font-semibold text-[#334155]" dir="auto">{v || "—"}</p>
            </div>
          ))}
        </div>
        {p.notes && <p className="mt-4 rounded-xl bg-[#F8FAFC] p-3 text-sm text-[#475569]">{p.notes}</p>}
      </Card>

      {/* Recent activity */}
      <Card>
        <h3 className="mb-4 text-lg font-bold text-[#1F2937]">آخر النشاطات</h3>
        {recent.length ? (
          <div className="space-y-2">
            {recent.map((e) => (
              <div key={e.id} className="flex items-center justify-between text-sm">
                <span className="text-[#334155]">{e.title}</span>
                <span className="text-xs text-[#94A3B8]">{new Date(e.createdAt).toLocaleDateString("ar")}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-[#94A3B8]">لا يوجد نشاط بعد.</p>
        )}
      </Card>
    </div>
  );
}

function Stat({ n, label }: { n: number; label: string }) {
  return (
    <div className="rounded-xl bg-[#F8FAFC] p-3 text-center">
      <p className="text-2xl font-black text-[#1F2937]">{n}</p>
      <p className="text-[11px] font-bold text-[#94A3B8]">{label}</p>
    </div>
  );
}

function MedicalHistory({ patientId, p, onChange }: { patientId: number; p: Profile["patient"]; onChange: () => void }) {
  const [form, setForm] = useState({
    diabetes: p.medical.diabetes,
    hypertension: p.medical.hypertension,
    heartDisease: p.medical.heartDisease,
    bloodThinners: p.medical.bloodThinners,
    pregnancy: p.medical.pregnancy,
    allergies: p.allergies.join("\n"),
    medications: p.medications.join("\n"),
    otherConditions: p.otherConditions.join("\n"),
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const toggles: ["diabetes" | "hypertension" | "heartDisease" | "bloodThinners", string][] = [
    ["diabetes", "السكري"],
    ["hypertension", "ضغط الدم"],
    ["heartDisease", "أمراض القلب"],
    ["bloodThinners", "مميّعات الدم"],
  ];

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaved(false);
    try {
      const payload = {
        diabetes: form.diabetes,
        hypertension: form.hypertension,
        heartDisease: form.heartDisease,
        bloodThinners: form.bloodThinners,
        pregnancy: form.pregnancy,
        allergies: form.allergies.split("\n").map((s) => s.trim()).filter(Boolean),
        medications: form.medications.split("\n").map((s) => s.trim()).filter(Boolean),
        otherConditions: form.otherConditions.split("\n").map((s) => s.trim()).filter(Boolean),
      };
      const res = await fetch(`/api/dental/patients/${patientId}/medical`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      if (res.ok) {
        setSaved(true);
        onChange();
      } else {
        const d = await res.json().catch(() => ({}));
        alert(d.error || "تعذّر الحفظ");
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-lg font-bold text-[#1F2937]">التاريخ الطبي</h3>
        {p.medicalReviewedAt && (
          <span className="text-xs text-[#94A3B8]">آخر مراجعة: {new Date(p.medicalReviewedAt).toLocaleDateString("ar")}{p.medicalReviewedBy ? ` · ${p.medicalReviewedBy}` : ""}</span>
        )}
      </div>
      <form onSubmit={save} className="space-y-5">
        <div>
          <p className="mb-2 text-sm font-bold text-[#334155]">حالات مزمنة</p>
          <div className="flex flex-wrap gap-2">
            {toggles.map(([key, label]) => (
              <button
                type="button"
                key={key}
                onClick={() => setForm({ ...form, [key]: !form[key] })}
                className={`rounded-full px-4 py-2 text-sm font-bold transition ${form[key] ? "bg-rose-500 text-white" : "bg-[#F1F5F9] text-[#475569]"}`}
              >
                {label} {form[key] ? "✓" : ""}
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="mb-2 text-sm font-bold text-[#334155]">الحمل</p>
          <select value={form.pregnancy} onChange={(e) => setForm({ ...form, pregnancy: e.target.value })} className={`${INP} max-w-[220px]`}>
            <option value="na">لا ينطبق</option>
            <option value="yes">نعم</option>
            <option value="no">لا</option>
          </select>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <label className="block">
            <span className="mb-1.5 block text-sm font-bold text-rose-600">الحساسية (سطر لكل نوع)</span>
            <textarea value={form.allergies} onChange={(e) => setForm({ ...form, allergies: e.target.value })} className={`${INP} min-h-[110px]`} placeholder={"بنسلين\nLatex"} />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-bold text-[#334155]">الأدوية الحالية</span>
            <textarea value={form.medications} onChange={(e) => setForm({ ...form, medications: e.target.value })} className={`${INP} min-h-[110px]`} />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-bold text-[#334155]">حالات أخرى</span>
            <textarea value={form.otherConditions} onChange={(e) => setForm({ ...form, otherConditions: e.target.value })} className={`${INP} min-h-[110px]`} />
          </label>
        </div>

        <div className="flex items-center gap-3">
          <button disabled={saving} className="rounded-xl bg-[#0F8B94] px-5 py-2.5 text-sm font-bold text-white disabled:opacity-60">
            {saving ? "جاري الحفظ..." : "حفظ ومراجعة التاريخ الطبي"}
          </button>
          {saved && <span className="text-sm font-bold text-emerald-600">تم الحفظ ✓</span>}
        </div>
      </form>
    </Card>
  );
}

function Visits({ patientId, visits, onChange }: { patientId: number; visits: Profile["visits"]; onChange: () => void }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ doctorName: "", chiefComplaint: "", diagnosis: "", teeth: "", procedures: "", notes: "" });
  const [saving, setSaving] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await fetch(`/api/dental/patients/${patientId}/visits`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      setForm({ doctorName: "", chiefComplaint: "", diagnosis: "", teeth: "", procedures: "", notes: "" });
      setOpen(false);
      onChange();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-lg font-bold text-[#1F2937]">الزيارات ({visits.length})</h3>
        <button onClick={() => setOpen((v) => !v)} className="inline-flex items-center gap-1.5 rounded-xl bg-[#0F8B94] px-3 py-1.5 text-sm font-bold text-white hover:bg-[#0B6E75]">
          <Plus className="h-4 w-4" />
          زيارة جديدة
        </button>
      </div>
      {open && (
        <form onSubmit={save} className="mb-5 grid grid-cols-1 gap-3 rounded-2xl bg-[#F8FAFC] p-4 md:grid-cols-2">
          <input value={form.doctorName} onChange={(e) => setForm({ ...form, doctorName: e.target.value })} placeholder="الطبيب" className={INP} />
          <input value={form.teeth} onChange={(e) => setForm({ ...form, teeth: e.target.value })} placeholder="الأسنان (مثال: 16, 26)" className={INP} />
          <input value={form.chiefComplaint} onChange={(e) => setForm({ ...form, chiefComplaint: e.target.value })} placeholder="الشكوى الرئيسية" className={INP} />
          <input value={form.diagnosis} onChange={(e) => setForm({ ...form, diagnosis: e.target.value })} placeholder="التشخيص" className={INP} />
          <input value={form.procedures} onChange={(e) => setForm({ ...form, procedures: e.target.value })} placeholder="الإجراءات" className={`${INP} md:col-span-2`} />
          <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="ملاحظات" className={`${INP} md:col-span-2`} />
          <button disabled={saving} className="rounded-xl bg-[#0F8B94] px-4 py-2 text-sm font-bold text-white md:col-span-2">{saving ? "..." : "حفظ الزيارة"}</button>
        </form>
      )}
      <div className="space-y-3">
        {visits.length === 0 && <p className="py-6 text-center text-sm text-[#94A3B8]">لا توجد زيارات بعد.</p>}
        {visits.map((v) => (
          <div key={v.id} className="rounded-2xl border border-[#EEF1F4] p-4">
            <div className="flex items-center justify-between">
              <p className="font-bold text-[#1F2937]">{new Date(v.visitDate).toLocaleDateString("ar")}</p>
              {v.doctorName && <span className="text-xs text-[#94A3B8]">{v.doctorName}</span>}
            </div>
            <div className="mt-2 grid grid-cols-1 gap-1 text-sm text-[#475569] md:grid-cols-2">
              {v.chiefComplaint && <p><span className="text-[#94A3B8]">الشكوى: </span>{v.chiefComplaint}</p>}
              {v.diagnosis && <p><span className="text-[#94A3B8]">التشخيص: </span>{v.diagnosis}</p>}
              {v.teeth && <p><span className="text-[#94A3B8]">الأسنان: </span>{v.teeth}</p>}
              {v.procedures && <p><span className="text-[#94A3B8]">الإجراءات: </span>{v.procedures}</p>}
            </div>
            {v.notes && <p className="mt-1 text-sm text-[#64748B]">{v.notes}</p>}
          </div>
        ))}
      </div>
    </Card>
  );
}

const ITEM_STATUS_STYLE: Record<string, string> = {
  proposed: "bg-slate-100 text-slate-600 border-slate-200",
  accepted: "bg-emerald-50 text-emerald-700 border-emerald-200",
  declined: "bg-rose-50 text-rose-700 border-rose-200",
  in_progress: "bg-amber-50 text-amber-700 border-amber-200",
  completed: "bg-teal-50 text-teal-700 border-teal-200",
  cancelled: "bg-gray-100 text-gray-400 border-gray-200",
};

function TreatmentPlan({ patientId, data, onChange }: { patientId: number; data: Profile; onChange: () => void }) {
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [form, setForm] = useState({ catalogId: "", toothNumber: "", treatment: "", price: "" });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [expanded, setExpanded] = useState<number | null>(null);
  const [editFin, setEditFin] = useState(false);
  const [fin, setFin] = useState({ discount: String(data.finance.discount || ""), insurance: String(data.finance.insurance || "") });

  useEffect(() => {
    fetch("/api/dental/treatments/catalog", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { items: [] }))
      .then((d) => setCatalog(d.items || []))
      .catch(() => setCatalog([]));
  }, []);

  const selected = catalog.find((c) => String(c.id) === form.catalogId) || null;

  function pickCatalog(id: string) {
    const cat = catalog.find((c) => String(c.id) === id) || null;
    setForm({ catalogId: id, toothNumber: form.toothNumber, treatment: "", price: cat ? String(cat.defaultPrice) : form.price });
    setErr("");
  }

  async function addItem(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    if (!form.catalogId && !form.treatment.trim()) { setErr("اختر علاجاً من الكتالوج أو أدخل اسماً"); return; }
    if (selected?.requiresTooth && !form.toothNumber.trim()) { setErr(`علاج «${selected.name}» يتطلب تحديد رقم السن`); return; }
    setSaving(true);
    try {
      const body: Record<string, unknown> = { toothNumber: form.toothNumber, price: form.price };
      if (form.catalogId) body.catalogId = Number(form.catalogId);
      else body.treatment = form.treatment;
      const res = await fetch(`/api/dental/patients/${patientId}/plan-items`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (!res.ok) { setErr((await res.json().catch(() => ({}))).error || "تعذّرت الإضافة"); return; }
      setForm({ catalogId: "", toothNumber: "", treatment: "", price: "" });
      onChange();
    } finally {
      setSaving(false);
    }
  }

  async function setStatus(itemId: number, status: string) {
    await fetch(`/api/dental/plan-items/${itemId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) });
    onChange();
  }

  async function saveFinance() {
    await fetch(`/api/dental/patients/${patientId}/plan`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ discount: Number(fin.discount) || 0, insurance: Number(fin.insurance) || 0 }),
    });
    setEditFin(false);
    onChange();
  }

  return (
    <Card>
      <h3 className="mb-4 text-lg font-bold text-[#1F2937]">خطة العلاج</h3>

      <form onSubmit={addItem} className="mb-1 grid grid-cols-1 gap-2 md:grid-cols-[1.3fr_90px_120px_auto]">
        {form.catalogId ? (
          <div className="flex items-center gap-2">
            <span className="flex-1 truncate rounded-xl border border-[#E5E7EB] bg-[#F8FAFC] px-3 py-2 text-sm font-semibold text-[#1F2937]">{selected?.name}</span>
            <button type="button" onClick={() => pickCatalog("")} className="text-xs font-bold text-[#0F8B94]">تغيير</button>
          </div>
        ) : (
          <select value={form.catalogId} onChange={(e) => pickCatalog(e.target.value)} className={INP}>
            <option value="">— اختر علاجاً من الكتالوج —</option>
            {catalog.map((c) => (
              <option key={c.id} value={c.id}>{c.name} · ₪{c.defaultPrice.toLocaleString()}</option>
            ))}
          </select>
        )}
        <input value={form.toothNumber} onChange={(e) => setForm({ ...form, toothNumber: e.target.value })} placeholder={selected?.requiresTooth ? "السن *" : "السن"} className={INP} inputMode="numeric" />
        <input value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} placeholder="السعر ₪" className={INP} inputMode="numeric" />
        <button disabled={saving} className="inline-flex items-center justify-center gap-1 rounded-xl bg-[#0F8B94] px-4 py-2 text-sm font-bold text-white disabled:opacity-60"><Plus className="h-4 w-4" /> إضافة</button>
      </form>
      {!form.catalogId && (
        <input value={form.treatment} onChange={(e) => setForm({ ...form, treatment: e.target.value })} placeholder="أو اكتب اسم علاج مخصص" className={`${INP} mb-1`} />
      )}
      {err && <p className="mb-2 text-xs font-semibold text-rose-600">{err}</p>}

      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[620px] text-right text-sm">
          <thead>
            <tr className="border-b border-[#EEF1F4] text-xs text-[#8B95A1]">
              <th className="px-3 py-2 font-semibold">السن</th>
              <th className="px-3 py-2 font-semibold">العلاج</th>
              <th className="px-3 py-2 font-semibold">الجلسات</th>
              <th className="px-3 py-2 font-semibold">السعر</th>
              <th className="px-3 py-2 font-semibold">الحالة</th>
              <th className="px-3 py-2 font-semibold"></th>
            </tr>
          </thead>
          <tbody>
            {data.planItems.length === 0 && (
              <tr><td colSpan={6} className="py-6 text-center text-[#94A3B8]">لا توجد بنود بعد.</td></tr>
            )}
            {data.planItems.map((i) => (
              <Fragment key={i.id}>
                <tr className="border-b border-[#F5F7FA] last:border-none">
                  <td className="px-3 py-3 font-bold text-[#1F2937]">{i.toothNumber ?? "—"}</td>
                  <td className="px-3 py-3 text-[#4B5563]">{i.treatment}</td>
                  <td className="px-3 py-3 text-xs text-[#64748B]">
                    {i.expectedSessions ? `${i.sessionsDone}/${i.expectedSessions}` : i.sessionsDone || "—"}
                  </td>
                  <td className="px-3 py-3 font-bold text-[#334155]">₪ {i.price.toLocaleString()}</td>
                  <td className="px-3 py-3">
                    <select value={i.status} onChange={(e) => setStatus(i.id, e.target.value)} className={`rounded-lg border px-2 py-1 text-xs font-bold ${ITEM_STATUS_STYLE[i.status] || "border-gray-200 text-gray-600"}`}>
                      {PLAN_ITEM_STATUSES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
                    </select>
                  </td>
                  <td className="px-3 py-3">
                    <button onClick={() => setExpanded(expanded === i.id ? null : i.id)} className="inline-flex items-center gap-1 rounded-lg border border-[#E5E7EB] px-2 py-1 text-xs font-bold text-[#0F8B94]">
                      <Layers className="h-3.5 w-3.5" /> الجلسات
                      <ChevronDown className={`h-3.5 w-3.5 transition ${expanded === i.id ? "rotate-180" : ""}`} />
                    </button>
                  </td>
                </tr>
                {expanded === i.id && (
                  <tr>
                    <td colSpan={6} className="bg-[#F9FBFC] px-3 py-3">
                      <SessionsPanel itemId={i.id} onChange={onChange} />
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4 border-t border-[#F1F5F9] pt-4">
        {editFin ? (
          <div className="flex flex-wrap items-end justify-end gap-3">
            <label className="text-xs font-semibold text-[#64748B]">الخصم ₪<input value={fin.discount} onChange={(e) => setFin({ ...fin, discount: e.target.value })} className={`${INP} mt-1 w-28`} inputMode="numeric" /></label>
            <label className="text-xs font-semibold text-[#64748B]">تغطية التأمين ₪<input value={fin.insurance} onChange={(e) => setFin({ ...fin, insurance: e.target.value })} className={`${INP} mt-1 w-28`} inputMode="numeric" /></label>
            <button onClick={saveFinance} className="rounded-xl bg-[#0F8B94] px-4 py-2 text-sm font-bold text-white">حفظ</button>
            <button onClick={() => setEditFin(false)} className="rounded-xl border border-[#E5E7EB] px-4 py-2 text-sm font-bold text-[#64748B]">إلغاء</button>
          </div>
        ) : (
          <div className="flex flex-wrap items-center justify-end gap-x-6 gap-y-2 text-sm">
            <span className="text-[#707A84]">الإجمالي: <b className="text-[#1F2937]">₪ {data.finance.subtotal.toLocaleString()}</b></span>
            <span className="text-[#707A84]">الخصم: <b className="text-[#1F2937]">₪ {data.finance.discount.toLocaleString()}</b></span>
            <span className="text-[#707A84]">تأمين: <b className="text-[#1F2937]">₪ {data.finance.insurance.toLocaleString()}</b></span>
            <span className="text-[#707A84]">مسؤولية المريض: <b className="text-[#0F8B94]">₪ {data.finance.responsibility.toLocaleString()}</b></span>
            <span className="text-[#707A84]">المتبقي: <b className="text-rose-600">₪ {data.finance.balance.toLocaleString()}</b></span>
            <button onClick={() => { setFin({ discount: String(data.finance.discount || ""), insurance: String(data.finance.insurance || "") }); setEditFin(true); }} className="rounded-lg border border-[#E5E7EB] px-3 py-1 text-xs font-bold text-[#0F8B94]">تعديل الخصم/التأمين</button>
          </div>
        )}
      </div>
    </Card>
  );
}

function SessionsPanel({ itemId, onChange }: { itemId: number; onChange: () => void }) {
  const [sessions, setSessions] = useState<{ id: number; sessionNumber: number; date: string; doctorName: string | null; procedures: string | null; notes: string | null }[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ doctorName: "", procedures: "", notes: "" });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch(`/api/dental/plan-items/${itemId}/sessions`, { cache: "no-store" });
    if (res.ok) setSessions((await res.json()).sessions || []);
    setLoading(false);
  }, [itemId]);

  useEffect(() => { load(); }, [load]);

  async function addSession(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch(`/api/dental/plan-items/${itemId}/sessions`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      if (res.ok) { setForm({ doctorName: "", procedures: "", notes: "" }); await load(); onChange(); }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-3">
      {loading ? (
        <p className="text-xs text-[#94A3B8]">جارِ التحميل…</p>
      ) : sessions.length === 0 ? (
        <p className="text-xs text-[#94A3B8]">لا توجد جلسات مسجّلة لهذا العلاج.</p>
      ) : (
        <ol className="space-y-2">
          {sessions.map((s) => (
            <li key={s.id} className="rounded-xl border border-[#EAECEF] bg-white px-3 py-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-bold text-[#1F2937]">جلسة {s.sessionNumber}</span>
                <span className="text-[#94A3B8]">{new Date(s.date).toLocaleDateString("ar")}</span>
              </div>
              {s.doctorName && <p className="mt-0.5 text-[#64748B]">د. {s.doctorName}</p>}
              {s.procedures && <p className="mt-0.5 text-[#4B5563]">{s.procedures}</p>}
              {s.notes && <p className="mt-0.5 text-[#94A3B8]">{s.notes}</p>}
            </li>
          ))}
        </ol>
      )}
      <form onSubmit={addSession} className="grid grid-cols-1 gap-2 md:grid-cols-[150px_1fr_1fr_auto]">
        <input value={form.doctorName} onChange={(e) => setForm({ ...form, doctorName: e.target.value })} placeholder="الطبيب" className={INP} />
        <input value={form.procedures} onChange={(e) => setForm({ ...form, procedures: e.target.value })} placeholder="ما تم في الجلسة" className={INP} />
        <input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="ملاحظات" className={INP} />
        <button disabled={saving} className="rounded-xl bg-[#0F8B94] px-4 py-2 text-sm font-bold text-white disabled:opacity-60">+ جلسة</button>
      </form>
    </div>
  );
}

function Billing({ patientId, data, onChange }: { patientId: number; data: Profile; onChange: () => void }) {
  const [form, setForm] = useState({ amount: "", method: "cash", notes: "" });
  const [saving, setSaving] = useState(false);

  async function pay(e: React.FormEvent) {
    e.preventDefault();
    if (!Number(form.amount)) return;
    setSaving(true);
    try {
      await fetch(`/api/dental/patients/${patientId}/payments`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      setForm({ amount: "", method: "cash", notes: "" });
      onChange();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
      <Card>
        <h3 className="mb-4 text-lg font-bold text-[#1F2937]">الملخص المالي</h3>
        <div className="space-y-2 text-sm">
          <Row k="إجمالي العلاجات" v={`₪ ${data.finance.subtotal.toLocaleString()}`} />
          <Row k="الخصم" v={`₪ ${data.finance.discount.toLocaleString()}`} />
          <Row k="تغطية التأمين" v={`₪ ${data.finance.insurance.toLocaleString()}`} />
          <Row k="مسؤولية المريض" v={`₪ ${data.finance.responsibility.toLocaleString()}`} />
          <Row k="المدفوع" v={`₪ ${data.finance.paid.toLocaleString()}`} />
          <div className="border-t border-[#F1F5F9] pt-2">
            <Row k="المتبقي" v={`₪ ${data.finance.balance.toLocaleString()}`} strong />
          </div>
        </div>
        <form onSubmit={pay} className="mt-5 grid grid-cols-1 gap-2 rounded-2xl bg-[#F8FAFC] p-4 md:grid-cols-2">
          <input value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} placeholder="المبلغ ₪" className={INP} inputMode="numeric" />
          <select value={form.method} onChange={(e) => setForm({ ...form, method: e.target.value })} className={INP}>
            {PAYMENT_METHODS.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
          </select>
          <input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="ملاحظة" className={`${INP} md:col-span-2`} />
          <button disabled={saving} className="rounded-xl bg-[#0F8B94] px-4 py-2 text-sm font-bold text-white md:col-span-2">تسجيل دفعة</button>
        </form>
      </Card>
      <Card>
        <h3 className="mb-4 text-lg font-bold text-[#1F2937]">سجل الدفعات</h3>
        <div className="space-y-2">
          {data.payments.length === 0 && <p className="py-6 text-center text-sm text-[#94A3B8]">لا توجد دفعات.</p>}
          {data.payments.map((p) => (
            <div key={p.id} className="flex items-center justify-between rounded-xl bg-[#F8FAFC] px-4 py-2.5 text-sm">
              <div>
                <p className={`font-bold ${p.voided ? "text-[#94A3B8] line-through" : "text-[#1F2937]"}`}>₪ {p.amount.toLocaleString()}</p>
                <p className="text-xs text-[#94A3B8]">
                  {PAYMENT_METHODS.find((m) => m.id === p.method)?.label || p.method}
                  {p.notes ? ` · ${p.notes}` : ""}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-[#94A3B8]">{new Date(p.createdAt).toLocaleDateString("ar")}</span>
                {p.voided ? (
                  <span className="rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-bold text-rose-600">ملغاة</span>
                ) : (
                  <button
                    onClick={async () => {
                      const reason = prompt("سبب إلغاء الدفعة (Void):");
                      if (reason === null) return;
                      const res = await fetch(`/api/dental/payments/${p.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reason }) });
                      if (!res.ok) {
                        const d = await res.json().catch(() => ({}));
                        alert(d.error || "تعذّر الإلغاء");
                        return;
                      }
                      onChange();
                    }}
                    className="rounded-lg border border-[#E5E7EB] px-2 py-0.5 text-[10px] font-bold text-rose-600 hover:bg-rose-50"
                  >
                    إلغاء
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

function Row({ k, v, strong }: { k: string; v: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[#707A84]">{k}</span>
      <span className={strong ? "text-lg font-black text-rose-600" : "font-bold text-[#334155]"}>{v}</span>
    </div>
  );
}

function Prescriptions({ patientId, list, onChange }: { patientId: number; list: Profile["prescriptions"]; onChange: () => void }) {
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const items = text.split("\n").map((l) => l.trim()).filter(Boolean);
    if (!items.length) return;
    setSaving(true);
    try {
      await fetch(`/api/dental/patients/${patientId}/prescriptions`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ items }) });
      setText("");
      onChange();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <h3 className="mb-4 text-lg font-bold text-[#1F2937]">الوصفات الطبية</h3>
      <form onSubmit={save} className="mb-5">
        <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder={"كل دواء بسطر مثال:\nAugmentin 875mg — قرص مرتين يومياً 7 أيام"} className={`${INP} min-h-[90px]`} />
        <button disabled={saving} className="mt-2 rounded-xl bg-[#0F8B94] px-4 py-2 text-sm font-bold text-white">إصدار وصفة</button>
      </form>
      <div className="space-y-3">
        {list.length === 0 && <p className="py-6 text-center text-sm text-[#94A3B8]">لا توجد وصفات.</p>}
        {list.map((rx) => (
          <div key={rx.id} className="rounded-2xl border border-[#EEF1F4] p-4">
            <p className="mb-2 text-xs text-[#94A3B8]">{new Date(rx.createdAt).toLocaleDateString("ar")}</p>
            <ul className="list-disc space-y-1 pr-5 text-sm text-[#334155]">
              {rx.items.map((it, i) => <li key={i}>{it}</li>)}
            </ul>
          </div>
        ))}
      </div>
    </Card>
  );
}

const INP = "h-11 w-full rounded-xl border border-[#E5E7EB] bg-white px-3 text-sm text-[#1F2937] outline-none focus:border-[#0F8B94]";

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowRight, Loader2, Plus } from "lucide-react";
import { DentalChart } from "@/components/dental/dental-chart";
import { PAYMENT_METHODS, PLAN_ITEM_STATUSES, PLAN_ITEM_STATUS_MAP } from "@/lib/dental/constants";

const TABS = [
  { id: "overview", label: "نظرة عامة" },
  { id: "chart", label: "مخطط الأسنان" },
  { id: "visits", label: "الزيارات" },
  { id: "plan", label: "خطة العلاج" },
  { id: "billing", label: "الحساب المالي" },
  { id: "rx", label: "الوصفات" },
] as const;

type Profile = {
  patient: {
    id: number;
    patientNumber: string;
    fullName: string;
    nationalId: string | null;
    birthDate: string | null;
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
  };
  teeth: { toothNumber: number; condition: string }[];
  visits: { id: number; visitDate: string; doctorName: string | null; chiefComplaint: string | null; diagnosis: string | null; teeth: string | null; procedures: string | null; notes: string | null }[];
  plan: { id: number; title: string; discount: number; status: string } | null;
  planItems: { id: number; toothNumber: number | null; treatment: string; price: number; status: string }[];
  payments: { id: number; amount: number; method: string; notes: string | null; createdAt: string }[];
  prescriptions: { id: number; items: string[]; notes: string | null; createdAt: string }[];
  appointments: { id: number; startAt: string; treatmentType: string | null; status: string }[];
  finance: { chargeable: number; discount: number; due: number; paid: number; balance: number };
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
              {p.phone && <span dir="ltr"> · {p.phone}</span>}
            </p>
          </div>
          <div className="flex gap-6 text-center">
            <div>
              <p className="text-xs text-[#94A3B8]">الرصيد المتبقي</p>
              <p className={`text-xl font-black ${data.finance.balance > 0 ? "text-rose-600" : "text-emerald-600"}`}>
                ₪ {data.finance.balance.toLocaleString()}
              </p>
            </div>
            <div>
              <p className="text-xs text-[#94A3B8]">المدفوع</p>
              <p className="text-xl font-black text-[#0F8B94]">₪ {data.finance.paid.toLocaleString()}</p>
            </div>
          </div>
        </div>

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

      {tab === "overview" && <Overview p={p} />}
      {tab === "chart" && <DentalChart patientId={patientId} teeth={data.teeth} onChange={load} />}
      {tab === "visits" && <Visits patientId={patientId} visits={data.visits} onChange={load} />}
      {tab === "plan" && <TreatmentPlan patientId={patientId} data={data} onChange={load} />}
      {tab === "billing" && <Billing patientId={patientId} data={data} onChange={load} />}
      {tab === "rx" && <Prescriptions patientId={patientId} list={data.prescriptions} onChange={load} />}
    </div>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return <div className="rounded-[24px] border border-[#EAECEF] bg-white p-6 shadow-sm">{children}</div>;
}

function Overview({ p }: { p: Profile["patient"] }) {
  const info: [string, string | null][] = [
    ["رقم الهوية", p.nationalId],
    ["تاريخ الميلاد", p.birthDate],
    ["الجنس", p.gender],
    ["الهاتف", p.phone],
    ["واتساب", p.whatsapp],
    ["البريد", p.email],
    ["العنوان", p.address],
    ["جهة اتصال للطوارئ", p.emergencyContact],
  ];
  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
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
      <Card>
        <h3 className="mb-4 text-lg font-bold text-[#1F2937]">المعلومات الطبية</h3>
        <MedList title="التاريخ الطبي" items={p.medicalHistory} tone="amber" />
        <MedList title="الحساسية" items={p.allergies} tone="rose" />
        <MedList title="الأدوية الحالية" items={p.medications} tone="blue" />
      </Card>
    </div>
  );
}

function MedList({ title, items, tone }: { title: string; items: string[]; tone: string }) {
  const toneClass = tone === "rose" ? "bg-rose-50 text-rose-700" : tone === "blue" ? "bg-blue-50 text-blue-700" : "bg-amber-50 text-amber-700";
  return (
    <div className="mb-4">
      <p className="mb-2 text-xs font-bold text-[#94A3B8]">{title}</p>
      {items.length ? (
        <div className="flex flex-wrap gap-1.5">
          {items.map((it, i) => (
            <span key={i} className={`rounded-full px-2.5 py-1 text-xs font-bold ${toneClass}`}>{it}</span>
          ))}
        </div>
      ) : (
        <p className="text-xs text-[#CBD5E1]">لا يوجد</p>
      )}
    </div>
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

function TreatmentPlan({ patientId, data, onChange }: { patientId: number; data: Profile; onChange: () => void }) {
  const [form, setForm] = useState({ toothNumber: "", treatment: "", price: "" });
  const [saving, setSaving] = useState(false);
  const total = useMemo(() => data.planItems.reduce((s, i) => s + i.price, 0), [data.planItems]);

  async function addItem(e: React.FormEvent) {
    e.preventDefault();
    if (!form.treatment.trim()) return;
    setSaving(true);
    try {
      await fetch(`/api/dental/patients/${patientId}/plan-items`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      setForm({ toothNumber: "", treatment: "", price: "" });
      onChange();
    } finally {
      setSaving(false);
    }
  }

  async function setStatus(itemId: number, status: string) {
    await fetch(`/api/dental/plan-items/${itemId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) });
    onChange();
  }

  return (
    <Card>
      <h3 className="mb-4 text-lg font-bold text-[#1F2937]">خطة العلاج</h3>
      <form onSubmit={addItem} className="mb-4 grid grid-cols-1 gap-2 md:grid-cols-[90px_1fr_120px_auto]">
        <input value={form.toothNumber} onChange={(e) => setForm({ ...form, toothNumber: e.target.value })} placeholder="السن" className={INP} inputMode="numeric" />
        <input value={form.treatment} onChange={(e) => setForm({ ...form, treatment: e.target.value })} placeholder="العلاج" className={INP} />
        <input value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} placeholder="السعر ₪" className={INP} inputMode="numeric" />
        <button disabled={saving} className="rounded-xl bg-[#0F8B94] px-4 py-2 text-sm font-bold text-white">إضافة</button>
      </form>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] text-right text-sm">
          <thead>
            <tr className="border-b border-[#EEF1F4] text-xs text-[#8B95A1]">
              <th className="px-3 py-2 font-semibold">السن</th>
              <th className="px-3 py-2 font-semibold">العلاج</th>
              <th className="px-3 py-2 font-semibold">السعر</th>
              <th className="px-3 py-2 font-semibold">الحالة</th>
            </tr>
          </thead>
          <tbody>
            {data.planItems.length === 0 && (
              <tr><td colSpan={4} className="py-6 text-center text-[#94A3B8]">لا توجد بنود بعد.</td></tr>
            )}
            {data.planItems.map((i) => (
              <tr key={i.id} className="border-b border-[#F5F7FA] last:border-none">
                <td className="px-3 py-3 font-bold text-[#1F2937]">{i.toothNumber ?? "—"}</td>
                <td className="px-3 py-3 text-[#4B5563]">{i.treatment}</td>
                <td className="px-3 py-3 font-bold text-[#334155]">₪ {i.price.toLocaleString()}</td>
                <td className="px-3 py-3">
                  <select value={i.status} onChange={(e) => setStatus(i.id, e.target.value)} className="rounded-lg border border-[#E5E7EB] bg-white px-2 py-1 text-xs font-bold text-[#334155]">
                    {PLAN_ITEM_STATUSES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-4 flex flex-wrap justify-end gap-6 border-t border-[#F1F5F9] pt-4 text-sm">
        <span className="text-[#707A84]">الإجمالي: <b className="text-[#1F2937]">₪ {total.toLocaleString()}</b></span>
        <span className="text-[#707A84]">الخصم: <b className="text-[#1F2937]">₪ {data.finance.discount.toLocaleString()}</b></span>
        <span className="text-[#707A84]">المطلوب: <b className="text-[#0F8B94]">₪ {data.finance.due.toLocaleString()}</b></span>
        <span className="text-[#707A84]">المتبقي: <b className="text-rose-600">₪ {data.finance.balance.toLocaleString()}</b></span>
      </div>
    </Card>
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
          <Row k="إجمالي العلاجات" v={`₪ ${data.finance.chargeable.toLocaleString()}`} />
          <Row k="الخصم" v={`₪ ${data.finance.discount.toLocaleString()}`} />
          <Row k="المطلوب بعد الخصم" v={`₪ ${data.finance.due.toLocaleString()}`} />
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
                <p className="font-bold text-[#1F2937]">₪ {p.amount.toLocaleString()}</p>
                <p className="text-xs text-[#94A3B8]">{PAYMENT_METHODS.find((m) => m.id === p.method)?.label || p.method}{p.notes ? ` · ${p.notes}` : ""}</p>
              </div>
              <span className="text-xs text-[#94A3B8]">{new Date(p.createdAt).toLocaleDateString("ar")}</span>
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

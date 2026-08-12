"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Plus } from "lucide-react";
import { LAB_STATUSES, LAB_STATUS_MAP, LAB_WORK_TYPES, RECALL_STATUSES, RECALL_STATUS_MAP, RECALL_TYPES } from "@/lib/dental/constants";

const INP = "h-11 w-full rounded-xl border border-[#E5E7EB] bg-white px-3 text-sm text-[#1F2937] outline-none focus:border-[#0F8B94]";
type PatientRow = { id: number; fullName: string; patientNumber: string };

function usePatients() {
  const [patients, setPatients] = useState<PatientRow[]>([]);
  useEffect(() => {
    fetch("/api/dental/patients", { cache: "no-store" }).then((r) => (r.ok ? r.json() : { patients: [] })).then((d) => setPatients(d.patients || [])).catch(() => {});
  }, []);
  return patients;
}

function Shell({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-2xl font-bold text-[#1F2937]">{title}</h2>
        {subtitle && <p className="text-sm text-[#94A3B8]">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

/* ---------------- Labs ---------------- */
type Lab = { id: number; patientName: string; doctorName: string | null; toothNumber: number | null; labName: string; workType: string; shade: string | null; expectedDate: string | null; cost: number; status: string; overdue: boolean };

export function LabsDashboard() {
  const [orders, setOrders] = useState<Lab[]>([]);
  const [loading, setLoading] = useState(true);
  const [show, setShow] = useState(false);
  const patients = usePatients();
  const [form, setForm] = useState({ patientId: "", labName: "", workType: "crown", toothNumber: "", shade: "", doctorName: "", expectedDate: "", cost: "" });
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/dental/labs", { cache: "no-store" });
    if (res.ok) setOrders((await res.json()).orders || []);
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!form.patientId || !form.labName.trim()) return;
    setBusy(true);
    try {
      const res = await fetch("/api/dental/labs", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      if (res.ok) { setForm({ patientId: "", labName: "", workType: "crown", toothNumber: "", shade: "", doctorName: "", expectedDate: "", cost: "" }); setShow(false); load(); }
    } finally { setBusy(false); }
  }

  async function setStatus(id: number, status: string) {
    await fetch(`/api/dental/labs/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) });
    load();
  }

  const overdue = orders.filter((o) => o.overdue).length;

  return (
    <Shell title="طلبات المختبرات" subtitle={overdue ? `${overdue} طلب متأخر` : "متابعة أعمال المختبر"}>
      <div className="flex justify-end">
        <button onClick={() => setShow((v) => !v)} className="inline-flex items-center gap-2 rounded-2xl bg-[#0F8B94] px-4 py-2 text-sm font-bold text-white hover:bg-[#0B6E75]"><Plus className="h-4 w-4" /> طلب جديد</button>
      </div>
      {show && (
        <form onSubmit={create} className="grid grid-cols-1 gap-3 rounded-[24px] border border-[#EAECEF] bg-white p-6 shadow-sm md:grid-cols-3">
          <select value={form.patientId} onChange={(e) => setForm({ ...form, patientId: e.target.value })} className={INP} required>
            <option value="">اختر المريض</option>
            {patients.map((p) => <option key={p.id} value={p.id}>{p.fullName} — {p.patientNumber}</option>)}
          </select>
          <input value={form.labName} onChange={(e) => setForm({ ...form, labName: e.target.value })} placeholder="اسم المختبر" className={INP} />
          <select value={form.workType} onChange={(e) => setForm({ ...form, workType: e.target.value })} className={INP}>
            {Object.entries(LAB_WORK_TYPES).map(([id, label]) => <option key={id} value={id}>{label}</option>)}
          </select>
          <input value={form.toothNumber} onChange={(e) => setForm({ ...form, toothNumber: e.target.value })} placeholder="السن" className={INP} inputMode="numeric" />
          <input value={form.shade} onChange={(e) => setForm({ ...form, shade: e.target.value })} placeholder="اللون (Shade)" className={INP} />
          <input value={form.doctorName} onChange={(e) => setForm({ ...form, doctorName: e.target.value })} placeholder="الطبيب" className={INP} />
          <input type="date" value={form.expectedDate} onChange={(e) => setForm({ ...form, expectedDate: e.target.value })} className={INP} />
          <input value={form.cost} onChange={(e) => setForm({ ...form, cost: e.target.value })} placeholder="التكلفة ₪" className={INP} inputMode="numeric" />
          <button disabled={busy} className="rounded-xl bg-[#0F8B94] px-4 py-2 text-sm font-bold text-white">{busy ? "..." : "حفظ الطلب"}</button>
        </form>
      )}
      <div className="rounded-[24px] border border-[#EAECEF] bg-white shadow-sm">
        {loading ? <Center /> : orders.length === 0 ? <Empty text="لا توجد طلبات مختبر." /> : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-right text-sm">
              <thead><tr className="border-b border-[#EEF1F4] text-xs text-[#8B95A1]">
                <th className="px-4 py-3 font-semibold">المريض</th><th className="px-4 py-3 font-semibold">العمل</th><th className="px-4 py-3 font-semibold">المختبر</th>
                <th className="px-4 py-3 font-semibold">التسليم</th><th className="px-4 py-3 font-semibold">التكلفة</th><th className="px-4 py-3 font-semibold">الحالة</th>
              </tr></thead>
              <tbody>
                {orders.map((o) => (
                  <tr key={o.id} className="border-b border-[#F5F7FA] last:border-none">
                    <td className="px-4 py-3 font-bold text-[#1F2937]">{o.patientName}</td>
                    <td className="px-4 py-3 text-[#475569]">{LAB_WORK_TYPES[o.workType] || o.workType}{o.toothNumber ? ` · سن ${o.toothNumber}` : ""}{o.shade ? ` · ${o.shade}` : ""}</td>
                    <td className="px-4 py-3 text-[#475569]">{o.labName}</td>
                    <td className={`px-4 py-3 ${o.overdue ? "font-bold text-rose-600" : "text-[#64748B]"}`}>{o.expectedDate ? new Date(o.expectedDate).toLocaleDateString("ar") : "—"}{o.overdue ? " (متأخر)" : ""}</td>
                    <td className="px-4 py-3 font-bold text-[#334155]">₪ {o.cost.toLocaleString()}</td>
                    <td className="px-4 py-3">
                      <select value={o.status} onChange={(e) => setStatus(o.id, e.target.value)} className={`rounded-lg border px-2 py-1 text-xs font-bold ${LAB_STATUS_MAP[o.status]?.color || ""}`}>
                        {LAB_STATUSES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Shell>
  );
}

/* ---------------- Inventory ---------------- */
type Item = { id: number; name: string; sku: string | null; brand: string | null; quantity: number; minQuantity: number; purchasePrice: number; supplier: string | null; expiryDate: string | null; lowStock: boolean; expiringSoon: boolean; expired: boolean };

export function InventoryDashboard() {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [show, setShow] = useState(false);
  const [form, setForm] = useState({ name: "", sku: "", brand: "", quantity: "", minQuantity: "", purchasePrice: "", supplier: "", expiryDate: "" });
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/dental/inventory", { cache: "no-store" });
    if (res.ok) setItems((await res.json()).items || []);
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) return;
    setBusy(true);
    try {
      const res = await fetch("/api/dental/inventory", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      if (res.ok) { setForm({ name: "", sku: "", brand: "", quantity: "", minQuantity: "", purchasePrice: "", supplier: "", expiryDate: "" }); setShow(false); load(); }
    } finally { setBusy(false); }
  }

  async function adjust(id: number, delta: number) {
    await fetch(`/api/dental/inventory/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ adjust: delta }) });
    load();
  }

  const lowCount = items.filter((i) => i.lowStock).length;

  return (
    <Shell title="المخزون" subtitle={lowCount ? `${lowCount} صنف تحت الحد الأدنى` : "إدارة مواد العيادة"}>
      <div className="flex justify-end">
        <button onClick={() => setShow((v) => !v)} className="inline-flex items-center gap-2 rounded-2xl bg-[#0F8B94] px-4 py-2 text-sm font-bold text-white hover:bg-[#0B6E75]"><Plus className="h-4 w-4" /> صنف جديد</button>
      </div>
      {show && (
        <form onSubmit={create} className="grid grid-cols-1 gap-3 rounded-[24px] border border-[#EAECEF] bg-white p-6 shadow-sm md:grid-cols-4">
          <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="اسم الصنف" className={`${INP} md:col-span-2`} />
          <input value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} placeholder="SKU" className={INP} dir="ltr" />
          <input value={form.brand} onChange={(e) => setForm({ ...form, brand: e.target.value })} placeholder="الشركة" className={INP} />
          <input value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} placeholder="الكمية" className={INP} inputMode="numeric" />
          <input value={form.minQuantity} onChange={(e) => setForm({ ...form, minQuantity: e.target.value })} placeholder="الحد الأدنى" className={INP} inputMode="numeric" />
          <input value={form.purchasePrice} onChange={(e) => setForm({ ...form, purchasePrice: e.target.value })} placeholder="سعر الشراء ₪" className={INP} inputMode="numeric" />
          <input value={form.supplier} onChange={(e) => setForm({ ...form, supplier: e.target.value })} placeholder="المورد" className={INP} />
          <input type="date" value={form.expiryDate} onChange={(e) => setForm({ ...form, expiryDate: e.target.value })} className={INP} />
          <button disabled={busy} className="rounded-xl bg-[#0F8B94] px-4 py-2 text-sm font-bold text-white md:col-span-4">{busy ? "..." : "حفظ الصنف"}</button>
        </form>
      )}
      <div className="rounded-[24px] border border-[#EAECEF] bg-white shadow-sm">
        {loading ? <Center /> : items.length === 0 ? <Empty text="لا توجد أصناف." /> : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-right text-sm">
              <thead><tr className="border-b border-[#EEF1F4] text-xs text-[#8B95A1]">
                <th className="px-4 py-3 font-semibold">الصنف</th><th className="px-4 py-3 font-semibold">الكمية</th><th className="px-4 py-3 font-semibold">الحد الأدنى</th>
                <th className="px-4 py-3 font-semibold">الصلاحية</th><th className="px-4 py-3 font-semibold">المورد</th>
              </tr></thead>
              <tbody>
                {items.map((it) => (
                  <tr key={it.id} className="border-b border-[#F5F7FA] last:border-none">
                    <td className="px-4 py-3">
                      <p className="font-bold text-[#1F2937]">{it.name}</p>
                      <p className="text-xs text-[#94A3B8]">{[it.sku, it.brand].filter(Boolean).join(" · ")}</p>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button onClick={() => adjust(it.id, -1)} className="h-6 w-6 rounded-lg bg-[#F1F5F9] font-bold text-[#475569]">−</button>
                        <span className={`w-8 text-center font-bold ${it.lowStock ? "text-rose-600" : "text-[#334155]"}`}>{it.quantity}</span>
                        <button onClick={() => adjust(it.id, 1)} className="h-6 w-6 rounded-lg bg-[#F1F5F9] font-bold text-[#475569]">+</button>
                        {it.lowStock && <span className="rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-bold text-rose-600">منخفض</span>}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-[#64748B]">{it.minQuantity}</td>
                    <td className="px-4 py-3">
                      {it.expiryDate ? (
                        <span className={it.expired ? "font-bold text-rose-600" : it.expiringSoon ? "font-bold text-amber-600" : "text-[#64748B]"}>{new Date(it.expiryDate).toLocaleDateString("ar")}{it.expired ? " (منتهٍ)" : it.expiringSoon ? " (قريب)" : ""}</span>
                      ) : "—"}
                    </td>
                    <td className="px-4 py-3 text-[#64748B]">{it.supplier || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Shell>
  );
}

/* ---------------- Recall ---------------- */
type Recall = { id: number; patientId: number; patientName: string; phone: string | null; type: string; dueDate: string; status: string; nextAction: string | null };

export function RecallDashboard({ onOpenPatient }: { onOpenPatient: (id: number, tab?: string) => void }) {
  const [recalls, setRecalls] = useState<Recall[]>([]);
  const [loading, setLoading] = useState(true);
  const [show, setShow] = useState(false);
  const patients = usePatients();
  const [form, setForm] = useState({ patientId: "", type: "cleaning", dueDate: "", nextAction: "" });
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/dental/recalls", { cache: "no-store" });
    if (res.ok) setRecalls((await res.json()).recalls || []);
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!form.patientId || !form.dueDate) return;
    setBusy(true);
    try {
      const res = await fetch("/api/dental/recalls", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      if (res.ok) { setForm({ patientId: "", type: "cleaning", dueDate: "", nextAction: "" }); setShow(false); load(); }
    } finally { setBusy(false); }
  }

  async function setStatus(id: number, status: string) {
    await fetch(`/api/dental/recalls/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) });
    load();
  }

  const dueToday = recalls.filter((r) => r.status === "due").length;
  const overdue = recalls.filter((r) => r.status === "overdue").length;

  return (
    <Shell title="التذكير والمتابعة" subtitle={`${dueToday} مستحق اليوم · ${overdue} متأخر`}>
      <div className="flex justify-end">
        <button onClick={() => setShow((v) => !v)} className="inline-flex items-center gap-2 rounded-2xl bg-[#0F8B94] px-4 py-2 text-sm font-bold text-white hover:bg-[#0B6E75]"><Plus className="h-4 w-4" /> تذكير جديد</button>
      </div>
      {show && (
        <form onSubmit={create} className="grid grid-cols-1 gap-3 rounded-[24px] border border-[#EAECEF] bg-white p-6 shadow-sm md:grid-cols-4">
          <select value={form.patientId} onChange={(e) => setForm({ ...form, patientId: e.target.value })} className={INP} required>
            <option value="">اختر المريض</option>
            {patients.map((p) => <option key={p.id} value={p.id}>{p.fullName} — {p.patientNumber}</option>)}
          </select>
          <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} className={INP}>
            {Object.entries(RECALL_TYPES).map(([id, label]) => <option key={id} value={id}>{label}</option>)}
          </select>
          <input type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} className={INP} />
          <input value={form.nextAction} onChange={(e) => setForm({ ...form, nextAction: e.target.value })} placeholder="الإجراء التالي" className={INP} />
          <button disabled={busy} className="rounded-xl bg-[#0F8B94] px-4 py-2 text-sm font-bold text-white md:col-span-4">{busy ? "..." : "حفظ التذكير"}</button>
        </form>
      )}
      <div className="rounded-[24px] border border-[#EAECEF] bg-white shadow-sm">
        {loading ? <Center /> : recalls.length === 0 ? <Empty text="لا توجد تذكيرات." /> : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-right text-sm">
              <thead><tr className="border-b border-[#EEF1F4] text-xs text-[#8B95A1]">
                <th className="px-4 py-3 font-semibold">المريض</th><th className="px-4 py-3 font-semibold">النوع</th><th className="px-4 py-3 font-semibold">الاستحقاق</th>
                <th className="px-4 py-3 font-semibold">الإجراء التالي</th><th className="px-4 py-3 font-semibold">الحالة</th>
              </tr></thead>
              <tbody>
                {recalls.map((r) => (
                  <tr key={r.id} className="border-b border-[#F5F7FA] last:border-none">
                    <td className="px-4 py-3"><button onClick={() => onOpenPatient(r.patientId)} className="font-bold text-[#0F8B94] hover:underline">{r.patientName}</button><p className="text-xs text-[#94A3B8]" dir="ltr">{r.phone || ""}</p></td>
                    <td className="px-4 py-3 text-[#475569]">{RECALL_TYPES[r.type] || r.type}</td>
                    <td className="px-4 py-3 text-[#64748B]">{new Date(r.dueDate).toLocaleDateString("ar")}</td>
                    <td className="px-4 py-3 text-[#64748B]">{r.nextAction || "—"}</td>
                    <td className="px-4 py-3">
                      <select value={["overdue", "due"].includes(r.status) ? "upcoming" : r.status} onChange={(e) => setStatus(r.id, e.target.value)} className={`rounded-lg border px-2 py-1 text-xs font-bold ${RECALL_STATUS_MAP[r.status]?.color || ""}`}>
                        {RECALL_STATUSES.filter((s) => !["due", "overdue"].includes(s.id)).map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
                      </select>
                      {["due", "overdue"].includes(r.status) && <span className={`ml-2 rounded-full px-2 py-0.5 text-[10px] font-bold ${RECALL_STATUS_MAP[r.status]?.color}`}>{RECALL_STATUS_MAP[r.status]?.label}</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Shell>
  );
}

function Center() { return <div className="flex justify-center py-16 text-[#94A3B8]"><Loader2 className="h-6 w-6 animate-spin" /></div>; }
function Empty({ text }: { text: string }) { return <p className="py-16 text-center text-sm text-[#94A3B8]">{text}</p>; }

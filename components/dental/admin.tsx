"use client";

import { useState } from "react";
import { MessageCircle, Plus, ShieldCheck } from "lucide-react";
import { fmtDateTime, StateView, useApi, useConfirm, useMutation } from "@/components/dental/ui";
import { DENTAL_PERMISSION_LABELS, DENTAL_ROLE_LABELS, DENTAL_ROLES, permissionsForRole, type DentalPermission, type DentalRole } from "@/lib/dental/rbac";

const INP = "h-11 w-full rounded-xl border border-[#E5E7EB] bg-white px-3 text-sm text-[#1F2937] outline-none focus:border-[#0F8B94]";

/* ---------------- Staff ---------------- */
type Staff = { id: number; username: string; role: string; dentalRole: string | null; effectiveRole: string; isActive: boolean };

export function StaffDashboard() {
  const [show, setShow] = useState(false);
  const [form, setForm] = useState({ username: "", password: "", dentalRole: "reception" });
  const { pending, run } = useMutation();
  const { data, loading, error, reload } = useApi<{ staff: Staff[] }>("/api/dental/staff");
  const staff = data?.staff ?? [];

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (pending) return;
    const ok = await run("/api/dental/staff", "POST", form, { success: "تم إنشاء الموظف" });
    if (ok) { setForm({ username: "", password: "", dentalRole: "reception" }); setShow(false); reload(); }
  }

  async function patch(id: number, body: Record<string, unknown>) {
    const ok = await run(`/api/dental/staff/${id}`, "PATCH", body, { success: "تم تحديث الموظف" });
    if (ok) reload();
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div><h2 className="text-2xl font-bold text-[#1F2937]">الأطباء والموظفون</h2><p className="text-sm text-[#94A3B8]">إدارة المستخدمين وأدوارهم داخل العيادة.</p></div>
        <button onClick={() => setShow((v) => !v)} className="inline-flex items-center gap-2 rounded-2xl bg-[#0F8B94] px-4 py-2 text-sm font-bold text-white hover:bg-[#0B6E75]"><Plus className="h-4 w-4" /> موظف جديد</button>
      </div>
      {show && (
        <form onSubmit={create} className="grid grid-cols-1 gap-3 rounded-[24px] border border-[#EAECEF] bg-white p-6 shadow-sm md:grid-cols-4">
          <input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} placeholder="اسم المستخدم" className={INP} dir="ltr" />
          <input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="كلمة المرور" className={INP} dir="ltr" />
          <select value={form.dentalRole} onChange={(e) => setForm({ ...form, dentalRole: e.target.value })} className={INP}>
            {DENTAL_ROLES.map((r) => <option key={r} value={r}>{DENTAL_ROLE_LABELS[r]}</option>)}
          </select>
          <button disabled={pending} className="rounded-xl bg-[#0F8B94] px-4 py-2 text-sm font-bold text-white disabled:opacity-60">{pending ? "جارِ الإنشاء…" : "إنشاء"}</button>
        </form>
      )}
      <div className="rounded-[24px] border border-[#EAECEF] bg-white shadow-sm">
        <StateView loading={loading} error={error} onRetry={reload}>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-right text-sm">
              <thead><tr className="border-b border-[#EEF1F4] text-xs text-[#8B95A1]"><th className="px-4 py-3 font-semibold">المستخدم</th><th className="px-4 py-3 font-semibold">الدور</th><th className="px-4 py-3 font-semibold">الحالة</th></tr></thead>
              <tbody>
                {staff.map((s) => (
                  <tr key={s.id} className="border-b border-[#F5F7FA] last:border-none">
                    <td className="px-4 py-3 font-bold text-[#1F2937]" dir="ltr">{s.username}{s.role === "master" && <span className="mr-2 rounded-full bg-violet-50 px-2 py-0.5 text-[10px] text-violet-700">مدير النظام</span>}</td>
                    <td className="px-4 py-3">
                      <select value={s.effectiveRole} onChange={(e) => patch(s.id, { dentalRole: e.target.value })} className="rounded-lg border border-[#E5E7EB] px-2 py-1 text-xs font-bold text-[#334155]">
                        {DENTAL_ROLES.map((r) => <option key={r} value={r}>{DENTAL_ROLE_LABELS[r]}</option>)}
                      </select>
                    </td>
                    <td className="px-4 py-3">
                      <button onClick={() => patch(s.id, { isActive: !s.isActive })} className={`rounded-full px-2.5 py-1 text-xs font-bold ${s.isActive ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-400"}`}>{s.isActive ? "مفعّل" : "موقوف"}</button>
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

/* ---------------- Settings hub (audit + roles) ---------------- */
export function SettingsHub() {
  const [tab, setTab] = useState<"clinic" | "integrations" | "audit" | "roles">("clinic");
  const tabs: { id: typeof tab; label: string }[] = [
    { id: "clinic", label: "الأطباء والغرف" },
    { id: "integrations", label: "التكاملات" },
    { id: "audit", label: "سجل التدقيق" },
    { id: "roles", label: "الأدوار والصلاحيات" },
  ];
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-2xl font-bold text-[#1F2937]">الإعدادات والأمان</h2>
        <div className="flex rounded-xl border border-[#E5E7EB] bg-white p-0.5">
          {tabs.map((t) => (
            <button key={t.id} onClick={() => setTab(t.id)} className={`rounded-lg px-3 py-1.5 text-sm font-bold ${tab === t.id ? "bg-[#0F8B94] text-white" : "text-[#475569]"}`}>{t.label}</button>
          ))}
        </div>
      </div>
      {tab === "clinic" ? <ClinicOptionsManager /> : tab === "integrations" ? <IntegrationsSettings /> : tab === "audit" ? <AuditLog /> : <RolesReference />}
    </div>
  );
}

/* ---------------- Integrations: WhatsApp ---------------- */
type WaStatus = {
  configured: boolean;
  source: "db" | "env" | "none";
  phoneNumberId: string | null;
  businessAccountId: string | null;
  hasAccessToken: boolean;
  hasAppSecret: boolean;
  hasVerifyToken: boolean;
  defaultCountry: string;
  active: boolean;
  webhookPath: string;
};

function IntegrationsSettings() {
  const { data, loading, error, reload, setData } = useApi<{ status: WaStatus }>("/api/dental/whatsapp/config");
  const { pending, run } = useMutation();
  const [edit, setEdit] = useState(false);
  const [form, setForm] = useState({ phoneNumberId: "", businessAccountId: "", verifyToken: "", accessToken: "", appSecret: "", defaultCountry: "972" });
  const s = data?.status;
  const origin = typeof window !== "undefined" ? window.location.origin : "";

  function startEdit() {
    if (s) setForm({ phoneNumberId: s.phoneNumberId || "", businessAccountId: s.businessAccountId || "", verifyToken: "", accessToken: "", appSecret: "", defaultCountry: s.defaultCountry || "972" });
    setEdit(true);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (pending) return;
    const res = await run<{ status: WaStatus }>("/api/dental/whatsapp/config", "POST", form, { success: "تم حفظ إعدادات واتساب" });
    if (res) { setData({ status: res.status }); setEdit(false); }
  }

  return (
    <div className="space-y-4">
      <StateView loading={loading} error={error} onRetry={reload}>
        <div className="rounded-[24px] border border-[#EAECEF] bg-white p-6 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <MessageCircle className="h-5 w-5 text-[#25D366]" />
                <h3 className="text-lg font-bold text-[#1F2937]">WhatsApp Business</h3>
                {s && (
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${s.configured ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                    {s.configured ? "متصل" : "غير مُهيّأ"}
                  </span>
                )}
              </div>
              <p className="mt-1 text-sm text-[#94A3B8]">تكامل رسمي مع Meta WhatsApp Cloud API — لهذه العيادة فقط.</p>
            </div>
            <button onClick={startEdit} className="rounded-xl bg-[#0F8B94] px-4 py-2 text-sm font-bold text-white hover:bg-[#0B6E75]">
              {s?.configured ? "تعديل الربط" : "ربط واتساب"}
            </button>
          </div>

          {s && !s.configured && (
            <p className="mt-4 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-700">WhatsApp غير مُهيّأ. أدخل بيانات Meta لتفعيل الإرسال والاستقبال.</p>
          )}

          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
            <Field label="Phone Number ID" value={s?.phoneNumberId || "—"} mono />
            <Field label="Business Account ID" value={s?.businessAccountId || "—"} mono />
            <Field label="Access Token" value={s?.hasAccessToken ? "•••••••• (محفوظ)" : "غير مُعيّن"} />
            <Field label="App Secret" value={s?.hasAppSecret ? "•••••••• (محفوظ)" : "غير مُعيّن"} />
            <Field label="Verify Token" value={s?.hasVerifyToken ? "•••••••• (محفوظ)" : "غير مُعيّن"} />
            <Field label="رمز الدولة الافتراضي" value={s?.defaultCountry || "972"} mono />
          </div>

          <div className="mt-4 rounded-xl border border-[#EEF1F4] bg-[#F8FAFC] p-3">
            <p className="text-xs font-bold text-[#64748B]">Webhook URL (ضعه في إعدادات Meta)</p>
            <p className="mt-1 break-all font-mono text-xs text-[#0F8B94]" dir="ltr">{origin}{s?.webhookPath || "/api/dental/whatsapp/webhook"}</p>
            <p className="mt-2 text-[11px] text-[#94A3B8]">لا يُعرض Access Token أبدًا. تُحفظ الأسرار على الخادم فقط.</p>
          </div>
        </div>
      </StateView>

      {edit && (
        <form onSubmit={save} className="rounded-[24px] border border-[#EAECEF] bg-white p-6 shadow-sm">
          <h4 className="mb-3 text-base font-bold text-[#1F2937]">بيانات الربط</h4>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <input value={form.phoneNumberId} onChange={(e) => setForm({ ...form, phoneNumberId: e.target.value })} placeholder="Phone Number ID" className={INP} dir="ltr" />
            <input value={form.businessAccountId} onChange={(e) => setForm({ ...form, businessAccountId: e.target.value })} placeholder="Business Account ID (WABA)" className={INP} dir="ltr" />
            <input value={form.accessToken} onChange={(e) => setForm({ ...form, accessToken: e.target.value })} placeholder="Access Token (اتركه فارغًا للإبقاء على الحالي)" className={INP} dir="ltr" />
            <input value={form.appSecret} onChange={(e) => setForm({ ...form, appSecret: e.target.value })} placeholder="App Secret (اتركه فارغًا للإبقاء على الحالي)" className={INP} dir="ltr" />
            <input value={form.verifyToken} onChange={(e) => setForm({ ...form, verifyToken: e.target.value })} placeholder="Verify Token" className={INP} dir="ltr" />
            <input value={form.defaultCountry} onChange={(e) => setForm({ ...form, defaultCountry: e.target.value })} placeholder="رمز الدولة الافتراضي (مثال 972)" className={INP} dir="ltr" />
          </div>
          <div className="mt-4 flex gap-2">
            <button disabled={pending} className="rounded-xl bg-[#0F8B94] px-5 py-2 text-sm font-bold text-white disabled:opacity-60">{pending ? "جارِ الحفظ…" : "حفظ"}</button>
            <button type="button" onClick={() => setEdit(false)} className="rounded-xl bg-[#F1F5F9] px-5 py-2 text-sm font-bold text-[#475569]">إلغاء</button>
          </div>
        </form>
      )}

      <div className="rounded-[24px] border border-dashed border-[#E5E7EB] bg-white p-4 text-sm text-[#94A3B8]">
        قنوات أخرى (SMS / Instagram / البريد) — <span className="font-bold text-[#64748B]">قريبًا</span>.
      </div>
    </div>
  );
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="rounded-xl border border-[#EEF1F4] bg-[#F8FAFC] px-3 py-2">
      <p className="text-[11px] font-bold text-[#94A3B8]">{label}</p>
      <p className={`mt-0.5 truncate text-sm text-[#334155] ${mono ? "font-mono" : ""}`} dir={mono ? "ltr" : undefined}>{value}</p>
    </div>
  );
}

type ClinicOption = { id: number; kind: string; name: string; active: boolean };

function ClinicOptionsManager() {
  const confirm = useConfirm();
  const { pending, run } = useMutation();
  const { data, loading, error, reload } = useApi<{ options: ClinicOption[] }>("/api/dental/clinic-options?manage=1");
  const options = data?.options ?? [];
  const doctors = options.filter((o) => o.kind === "doctor");
  const rooms = options.filter((o) => o.kind === "room");
  const [doctorName, setDoctorName] = useState("");
  const [roomName, setRoomName] = useState("");

  async function add(kind: "doctor" | "room", name: string, reset: () => void) {
    if (!name.trim() || pending) return;
    const ok = await run("/api/dental/clinic-options", "POST", { kind, name }, { success: "تمت الإضافة" });
    if (ok) { reset(); reload(); }
  }

  async function remove(o: ClinicOption) {
    const yes = await confirm({ title: "حذف", message: `حذف «${o.name}»؟`, danger: true, confirmText: "حذف" });
    if (!yes) return;
    const ok = await run(`/api/dental/clinic-options/${o.id}`, "DELETE", undefined, { success: "تم الحذف" });
    if (ok) reload();
  }

  return (
    <StateView loading={loading} error={error} onRetry={reload}>
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        <OptionColumn title="الأطباء" list={doctors} value={doctorName} setValue={setDoctorName} placeholder="اسم الطبيب (مثال: د. أحمد)" pending={pending} onAdd={() => add("doctor", doctorName, () => setDoctorName(""))} onRemove={remove} />
        <OptionColumn title="الغرف" list={rooms} value={roomName} setValue={setRoomName} placeholder="اسم الغرفة (مثال: غرفة 1)" pending={pending} onAdd={() => add("room", roomName, () => setRoomName(""))} onRemove={remove} />
      </div>
    </StateView>
  );
}

function OptionColumn({ title, list, value, setValue, placeholder, pending, onAdd, onRemove }: { title: string; list: ClinicOption[]; value: string; setValue: (v: string) => void; placeholder: string; pending: boolean; onAdd: () => void; onRemove: (o: ClinicOption) => void }) {
  return (
    <div className="rounded-[24px] border border-[#EAECEF] bg-white p-6 shadow-sm">
      <h3 className="mb-3 text-lg font-bold text-[#1F2937]">{title}</h3>
      <form onSubmit={(e) => { e.preventDefault(); onAdd(); }} className="mb-4 flex gap-2">
        <input value={value} onChange={(e) => setValue(e.target.value)} placeholder={placeholder} className={INP} />
        <button disabled={pending || !value.trim()} className="inline-flex items-center gap-1 rounded-xl bg-[#0F8B94] px-4 py-2 text-sm font-bold text-white disabled:opacity-60"><Plus className="h-4 w-4" /> إضافة</button>
      </form>
      {list.length === 0 ? (
        <p className="py-4 text-center text-sm text-[#94A3B8]">لا توجد عناصر بعد.</p>
      ) : (
        <div className="space-y-2">
          {list.map((o) => (
            <div key={o.id} className="flex items-center justify-between rounded-xl bg-[#F8FAFC] px-3 py-2 text-sm">
              <span className="font-bold text-[#1F2937]">{o.name}</span>
              <button onClick={() => onRemove(o)} className="rounded-lg border border-[#E5E7EB] px-2 py-0.5 text-[11px] font-bold text-rose-600 hover:bg-rose-50">حذف</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

type Audit = { id: number; username: string; action: string; entityType: string; entityId: string | null; createdAt: string };
const ACTION_LABELS: Record<string, string> = { create: "إنشاء", update: "تحديث", delete: "حذف", void: "إلغاء", payment: "دفعة", complete: "إكمال", reschedule: "إعادة جدولة", role_change: "تغيير دور", upload: "رفع ملف", adjust: "تعديل مالي", session: "جلسة" };

function AuditLog() {
  const [filter, setFilter] = useState("");
  const { data, loading, error, reload } = useApi<{ entries: Audit[] }>(`/api/dental/audit${filter ? `?entityType=${filter}` : ""}`);
  const entries = data?.entries ?? [];

  return (
    <div className="rounded-[24px] border border-[#EAECEF] bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-[#EEF1F4] p-4">
        <p className="text-sm font-bold text-[#334155]">سجل التدقيق (غير قابل للحذف)</p>
        <select value={filter} onChange={(e) => setFilter(e.target.value)} className="h-9 rounded-lg border border-[#E5E7EB] bg-white px-2 text-sm">
          <option value="">كل الأنواع</option>
          {["patient", "appointment", "payment", "treatmentItem", "visit", "invoice", "user", "ledger", "labOrder", "inventory", "recall", "file"].map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>
      <StateView loading={loading} error={error} onRetry={reload} isEmpty={entries.length === 0} empty={<p className="py-16 text-center text-sm text-[#94A3B8]">لا توجد سجلات.</p>}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-right text-sm">
            <thead><tr className="border-b border-[#EEF1F4] text-xs text-[#8B95A1]"><th className="px-4 py-3 font-semibold">التاريخ</th><th className="px-4 py-3 font-semibold">المستخدم</th><th className="px-4 py-3 font-semibold">الإجراء</th><th className="px-4 py-3 font-semibold">العنصر</th></tr></thead>
            <tbody>
              {entries.map((e) => (
                <tr key={e.id} className="border-b border-[#F5F7FA] last:border-none">
                  <td className="px-4 py-2.5 text-xs text-[#94A3B8]">{fmtDateTime(e.createdAt)}</td>
                  <td className="px-4 py-2.5 font-bold text-[#334155]" dir="ltr">{e.username}</td>
                  <td className="px-4 py-2.5 text-[#475569]">{ACTION_LABELS[e.action] || e.action}</td>
                  <td className="px-4 py-2.5 text-xs text-[#64748B]">{e.entityType}{e.entityId ? ` #${e.entityId}` : ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </StateView>
    </div>
  );
}

function RolesReference() {
  const perms = Object.keys(DENTAL_PERMISSION_LABELS) as DentalPermission[];
  const rolePerms = Object.fromEntries(DENTAL_ROLES.map((r) => [r, new Set(permissionsForRole(r as DentalRole))])) as Record<DentalRole, Set<DentalPermission>>;
  return (
    <div className="overflow-x-auto rounded-[24px] border border-[#EAECEF] bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-[#0F8B94]" /><p className="text-sm font-bold text-[#334155]">مصفوفة الصلاحيات — تُطبَّق على الخادم</p></div>
      <table className="w-full min-w-[720px] text-right text-xs">
        <thead><tr className="border-b border-[#EEF1F4] text-[#8B95A1]"><th className="px-2 py-2 text-right font-semibold">الصلاحية</th>{DENTAL_ROLES.map((r) => <th key={r} className="px-2 py-2 font-semibold">{DENTAL_ROLE_LABELS[r as DentalRole]}</th>)}</tr></thead>
        <tbody>
          {perms.map((p) => (
            <tr key={p} className="border-b border-[#F5F7FA] last:border-none">
              <td className="px-2 py-2 font-semibold text-[#475569]">{DENTAL_PERMISSION_LABELS[p]}</td>
              {DENTAL_ROLES.map((r) => <td key={r} className="px-2 py-2 text-center">{rolePerms[r as DentalRole].has(p) ? <span className="text-emerald-600">✓</span> : <span className="text-[#E5E7EB]">—</span>}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";
import {
  BadgeDollarSign,
  Check,
  Copy,
  Download,
  Loader2,
  Plus,
  QrCode,
  ScanLine,
  Store,
  UserCheck,
  Users,
  X,
} from "lucide-react";

type ShopRow = {
  code: string;
  name: string;
  ownerName: string | null;
  contactPhone: string | null;
  email: string | null;
  username: string | null;
  commissionAmount: number;
  isActive: boolean;
  createdAt: string;
  scans: number;
  leads: number;
  subscribed: number;
};

type LeadRow = {
  id: number;
  name: string;
  businessName: string | null;
  phone: string;
  email: string | null;
  status: string;
  createdAt: string;
};

type Detail = {
  shop: { code: string; name: string; ownerName: string | null; contactPhone: string | null; email: string | null; username: string | null; commissionAmount: number } | null;
  code: string;
  scans: number;
  leads: number;
  subscribed: number;
  estimatedCommission: number;
  commissionAmount: number;
  items: LeadRow[];
};

const STATUS_LABELS: Record<string, string> = {
  new: "جديد",
  contacted: "تمّت المتابعة",
  subscribed: "مشترك",
  rejected: "غير مهتم",
};

const STATUS_OPTIONS = ["new", "contacted", "subscribed", "rejected"] as const;

const EMPTY_FORM = {
  name: "",
  ownerName: "",
  contactPhone: "",
  email: "",
  username: "",
  password: "",
  commissionAmount: "25",
};

function origin() {
  return typeof window !== "undefined" ? window.location.origin : "https://gosol.io";
}

export function QrDashboard() {
  const [shops, setShops] = useState<ShopRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState("");
  const [created, setCreated] = useState<{ code: string; name: string; username: string; password: string } | null>(null);

  const [selected, setSelected] = useState<string | null>(null);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const loadShops = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/qr/shops", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        setShops(data.shops || []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadShops();
  }, [loadShops]);

  const openDetail = useCallback(async (code: string) => {
    setSelected(code);
    setDetail(null);
    setDetailLoading(true);
    try {
      const res = await fetch(`/api/qr/shops/${encodeURIComponent(code)}`, { cache: "no-store" });
      if (res.ok) setDetail(await res.json());
    } finally {
      setDetailLoading(false);
    }
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setFormError("");
    setCreating(true);
    try {
      const res = await fetch("/api/qr/shops", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, commissionAmount: Number(form.commissionAmount) || 0 }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setFormError(String(data.error || "تعذّر إنشاء الزبون"));
        return;
      }
      setCreated({ code: data.code, name: form.name, username: form.username.trim().toLowerCase(), password: form.password });
      setForm({ ...EMPTY_FORM });
      setShowForm(false);
      await loadShops();
    } finally {
      setCreating(false);
    }
  }

  return (
    <main dir="rtl" className="min-h-screen bg-[#F5F8FB] text-[#1F2937]">
      <div className="border-b border-[#E7ECF1] bg-gradient-to-l from-[#0F8B94] to-[#0B6E75]">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5 text-white">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/20 text-base font-black">G</div>
            <span className="text-lg font-extrabold tracking-tight">Gosol CRM</span>
          </div>
          <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-bold ring-1 ring-white/25">لوحة إدارة الأكواد</span>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-5 py-8">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-[#1F2937] md:text-3xl">زبائن رموز QR</h1>
            <p className="mt-1 text-sm text-[#707A84]">أنشئ زبوناً جديداً وأصدر له رمز QR وحساب دخول للوحته.</p>
          </div>
          <button
            onClick={() => {
              setShowForm((v) => !v);
              setCreated(null);
            }}
            className="inline-flex items-center gap-2 rounded-2xl bg-[#0F8B94] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#0B6E75]"
          >
            <Plus className="h-4 w-4" />
            زبون جديد
          </button>
        </div>

        {created && (
          <div className="mt-5 rounded-[24px] border border-emerald-200 bg-emerald-50 p-6">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2">
                <Check className="h-5 w-5 text-emerald-600" />
                <h3 className="text-lg font-bold text-emerald-800">تم إنشاء الزبون: {created.name}</h3>
              </div>
              <button onClick={() => setCreated(null)} className="text-emerald-700 hover:text-emerald-900">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-[220px_1fr]">
              <QrBox link={`${origin()}/form?ref=${created.code}`} download={`qr-${created.code}.png`} />
              <div className="space-y-2 text-sm">
                <CredLine label="رمز الإحالة" value={created.code} />
                <CredLine label="رابط الفورم (للـ QR)" value={`${origin()}/form?ref=${created.code}`} />
                <CredLine label="رابط لوحة الزبون" value={`${origin()}/clientdashboard`} />
                <CredLine label="اسم المستخدم" value={created.username} />
                <CredLine label="كلمة المرور" value={created.password} />
                <p className="pt-1 text-xs text-emerald-700">احفظ كلمة المرور الآن، لن تظهر مرة أخرى.</p>
              </div>
            </div>
          </div>
        )}

        {showForm && (
          <form onSubmit={handleCreate} className="mt-5 rounded-[24px] border border-[#EAECEF] bg-white p-6 shadow-sm">
            <h3 className="text-lg font-bold text-[#1F2937]">بيانات الزبون الجديد</h3>
            <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
              <Field label="اسم المحل / الزبون" required>
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={INPUT} required />
              </Field>
              <Field label="اسم صاحب المحل">
                <input value={form.ownerName} onChange={(e) => setForm({ ...form, ownerName: e.target.value })} className={INPUT} />
              </Field>
              <Field label="رقم الهاتف">
                <input value={form.contactPhone} onChange={(e) => setForm({ ...form, contactPhone: e.target.value })} className={INPUT} dir="ltr" />
              </Field>
              <Field label="البريد الإلكتروني">
                <input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className={INPUT} dir="ltr" type="email" />
              </Field>
              <Field label="اسم المستخدم (للدخول)" required>
                <input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} className={INPUT} dir="ltr" required />
              </Field>
              <Field label="كلمة المرور" required>
                <input value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className={INPUT} dir="ltr" required />
              </Field>
              <Field label="العمولة لكل مشترك (₪)">
                <input value={form.commissionAmount} onChange={(e) => setForm({ ...form, commissionAmount: e.target.value })} className={INPUT} dir="ltr" inputMode="numeric" />
              </Field>
            </div>
            {formError && <p className="mt-3 rounded-xl bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-700">{formError}</p>}
            <div className="mt-4 flex gap-2">
              <button type="submit" disabled={creating} className="inline-flex items-center gap-2 rounded-2xl bg-[#0F8B94] px-5 py-2.5 text-sm font-bold text-white hover:bg-[#0B6E75] disabled:opacity-60">
                {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                إنشاء الزبون
              </button>
              <button type="button" onClick={() => setShowForm(false)} className="rounded-2xl border border-[#E5E7EB] bg-white px-5 py-2.5 text-sm font-bold text-[#64748B]">
                إلغاء
              </button>
            </div>
          </form>
        )}

        <div className="mt-6 rounded-[24px] border border-[#EAECEF] bg-white p-2 shadow-sm">
          {loading ? (
            <div className="flex items-center justify-center py-16 text-[#94A3B8]"><Loader2 className="h-6 w-6 animate-spin" /></div>
          ) : shops.length === 0 ? (
            <div className="py-16 text-center text-sm text-[#94A3B8]">لا يوجد زبائن بعد. أنشئ أول زبون.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[820px] text-right text-sm">
                <thead>
                  <tr className="border-b-2 border-[#EEF1F4] text-xs text-[#8B95A1]">
                    <th className="px-4 py-3 font-semibold">المحل</th>
                    <th className="px-4 py-3 font-semibold">الرمز</th>
                    <th className="px-4 py-3 font-semibold">الهاتف</th>
                    <th className="px-4 py-3 font-semibold">مسح</th>
                    <th className="px-4 py-3 font-semibold">طلبات</th>
                    <th className="px-4 py-3 font-semibold">مؤكّدون</th>
                    <th className="px-4 py-3 font-semibold">العمولة</th>
                  </tr>
                </thead>
                <tbody>
                  {shops.map((s) => (
                    <tr key={s.code} onClick={() => openDetail(s.code)} className="cursor-pointer border-b border-[#F5F7FA] transition last:border-none hover:bg-[#F1FBFA]">
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-2">
                          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#E7F6F5] text-[#0F8B94]"><Store className="h-4 w-4" /></div>
                          <div>
                            <p className="font-bold text-[#1F2937]">{s.name}</p>
                            {s.ownerName && <p className="text-xs text-[#94A3B8]">{s.ownerName}</p>}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3.5 font-mono text-xs text-[#475569]" dir="ltr">{s.code}</td>
                      <td className="px-4 py-3.5 text-[#4B5563]" dir="ltr">{s.contactPhone || "—"}</td>
                      <td className="px-4 py-3.5 font-bold text-[#1F2937]">{s.scans}</td>
                      <td className="px-4 py-3.5 font-bold text-[#1F2937]">{s.leads}</td>
                      <td className="px-4 py-3.5 font-bold text-emerald-700">{s.subscribed}</td>
                      <td className="px-4 py-3.5 font-bold text-[#B45309]">₪ {(s.subscribed * s.commissionAmount).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {selected && (
        <DetailDrawer
          code={selected}
          detail={detail}
          loading={detailLoading}
          onClose={() => {
            setSelected(null);
            setDetail(null);
          }}
          onRefresh={() => {
            openDetail(selected);
            loadShops();
          }}
        />
      )}
    </main>
  );
}

function DetailDrawer({
  code,
  detail,
  loading,
  onClose,
  onRefresh,
}: {
  code: string;
  detail: Detail | null;
  loading: boolean;
  onClose: () => void;
  onRefresh: () => void;
}) {
  const link = `${origin()}/form?ref=${code}`;
  const [savingId, setSavingId] = useState<number | null>(null);

  async function changeStatus(leadId: number, status: string) {
    setSavingId(leadId);
    try {
      await fetch(`/api/qr/leads/${leadId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      onRefresh();
    } finally {
      setSavingId(null);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex" dir="rtl">
      <div className="flex-1 bg-black/40" onClick={onClose} />
      <div className="h-full w-full max-w-xl overflow-y-auto bg-[#F5F8FB] shadow-2xl">
        <div className="flex items-center justify-between border-b border-[#E7ECF1] bg-white px-6 py-4">
          <h3 className="text-lg font-bold text-[#1F2937]">{detail?.shop?.name || code}</h3>
          <button onClick={onClose} className="rounded-lg p-1.5 text-[#64748B] hover:bg-[#F1F5F9]"><X className="h-5 w-5" /></button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-24 text-[#94A3B8]"><Loader2 className="h-6 w-6 animate-spin" /></div>
        ) : detail ? (
          <div className="space-y-5 p-6">
            <div className="grid grid-cols-2 gap-3">
              <MiniKpi icon={ScanLine} label="مسح" value={detail.scans} accent="teal" />
              <MiniKpi icon={Users} label="طلبات" value={detail.leads} accent="blue" />
              <MiniKpi icon={UserCheck} label="مؤكّدون" value={detail.subscribed} accent="violet" />
              <MiniKpi icon={BadgeDollarSign} label="العمولة" value={`₪ ${detail.estimatedCommission.toLocaleString()}`} accent="amber" />
            </div>

            <div className="rounded-2xl border border-[#EAECEF] bg-white p-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-[200px_1fr]">
                <QrBox link={link} download={`qr-${code}.png`} />
                <div className="space-y-1.5 text-sm">
                  <CredLine label="الرمز (لا يتغيّر — مرتبط بالـQR)" value={code} />
                  <CredLine label="اسم المستخدم (للدخول)" value={detail.shop?.username || "—"} />
                  <CredLine label="رابط الفورم" value={link} />
                </div>
              </div>
            </div>

            {detail.shop && <ShopEditor code={code} shop={detail.shop} onSaved={onRefresh} />}

            <div className="rounded-2xl border border-[#EAECEF] bg-white p-4">
              <h4 className="mb-1 text-sm font-bold text-[#334155]">العملاء ({detail.items.length})</h4>
              <p className="mb-3 text-[11px] text-[#94A3B8]">غيّر حالة أي عميل ليُحتسب كمشترك وتُحدّث عمولة المحل.</p>
              {detail.items.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[560px] text-right text-xs">
                    <thead>
                      <tr className="border-b border-[#EEF1F4] text-[#8B95A1]">
                        <th className="px-2 py-2 font-semibold">الاسم</th>
                        <th className="px-2 py-2 font-semibold">الهاتف</th>
                        <th className="px-2 py-2 font-semibold">البريد</th>
                        <th className="px-2 py-2 font-semibold">التاريخ</th>
                        <th className="px-2 py-2 font-semibold">الحالة</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detail.items.map((r) => (
                        <tr key={r.id} className="border-b border-[#F5F7FA] last:border-none">
                          <td className="px-2 py-2.5 font-bold text-[#1F2937]">{r.name}</td>
                          <td className="px-2 py-2.5 text-[#4B5563]" dir="ltr">{r.phone || "—"}</td>
                          <td className="px-2 py-2.5 text-[#4B5563]" dir="ltr">{r.email || "—"}</td>
                          <td className="px-2 py-2.5 text-[#94A3B8]">{new Date(r.createdAt).toLocaleDateString("ar")}</td>
                          <td className="px-2 py-2.5">
                            <select
                              value={r.status}
                              disabled={savingId === r.id}
                              onChange={(e) => changeStatus(r.id, e.target.value)}
                              className={`rounded-lg border px-2 py-1 text-[11px] font-bold outline-none ${
                                r.status === "subscribed"
                                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                                  : r.status === "contacted"
                                  ? "border-blue-200 bg-blue-50 text-blue-700"
                                  : r.status === "rejected"
                                  ? "border-rose-200 bg-rose-50 text-rose-700"
                                  : "border-slate-200 bg-slate-50 text-slate-600"
                              }`}
                            >
                              {STATUS_OPTIONS.map((s) => (
                                <option key={s} value={s}>
                                  {STATUS_LABELS[s]}
                                </option>
                              ))}
                            </select>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="py-6 text-center text-sm text-[#94A3B8]">لا يوجد عملاء بعد.</p>
              )}
            </div>
          </div>
        ) : (
          <div className="py-24 text-center text-sm text-[#94A3B8]">تعذّر تحميل البيانات.</div>
        )}
      </div>
    </div>
  );
}

function QrBox({ link, download }: { link: string; download: string }) {
  const [dataUrl, setDataUrl] = useState("");
  useEffect(() => {
    let active = true;
    QRCode.toDataURL(link, { width: 220, margin: 1, color: { dark: "#0B4A50", light: "#FFFFFF" } })
      .then((url) => {
        if (active) setDataUrl(url);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [link]);

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="rounded-2xl border border-[#E5E7EB] bg-white p-2">
        {dataUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={dataUrl} alt="QR" className="h-[180px] w-[180px]" />
        ) : (
          <div className="flex h-[180px] w-[180px] items-center justify-center text-[#94A3B8]"><QrCode className="h-8 w-8" /></div>
        )}
      </div>
      {dataUrl && (
        <a href={dataUrl} download={download} className="inline-flex items-center gap-1.5 rounded-lg bg-[#0F8B94] px-3 py-1.5 text-xs font-bold text-white hover:bg-[#0B6E75]">
          <Download className="h-3.5 w-3.5" />
          تنزيل QR
        </a>
      )}
    </div>
  );
}

function CredLine({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex items-center justify-between gap-2 rounded-lg bg-[#F5F8FB] px-3 py-2">
      <div className="min-w-0">
        <p className="text-[11px] font-bold text-[#94A3B8]">{label}</p>
        <p className="truncate text-sm text-[#334155]" dir="ltr">{value}</p>
      </div>
      <button
        onClick={() => {
          navigator.clipboard?.writeText(value).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          });
        }}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white text-[#0F8B94] ring-1 ring-[#E5E7EB] hover:bg-[#E7F6F5]"
      >
        {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
      </button>
    </div>
  );
}

function ShopEditor({
  code,
  shop,
  onSaved,
}: {
  code: string;
  shop: NonNullable<Detail["shop"]>;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    name: shop.name || "",
    ownerName: shop.ownerName || "",
    contactPhone: shop.contactPhone || "",
    email: shop.email || "",
    username: shop.username || "",
    password: "",
    commissionAmount: String(shop.commissionAmount ?? 0),
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSaved(false);
    setSaving(true);
    try {
      const res = await fetch(`/api/qr/shops/${encodeURIComponent(code)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          ownerName: form.ownerName,
          contactPhone: form.contactPhone,
          email: form.email,
          username: form.username,
          password: form.password,
          commissionAmount: Number(form.commissionAmount) || 0,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(String(data.error || "تعذّر الحفظ"));
        return;
      }
      setForm((f) => ({ ...f, password: "" }));
      setSaved(true);
      onSaved();
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={save} className="rounded-2xl border border-[#EAECEF] bg-white p-4">
      <h4 className="mb-1 text-sm font-bold text-[#334155]">تعديل بيانات الزبون</h4>
      <p className="mb-3 text-[11px] text-[#94A3B8]">يمكنك تغيير الاسم، الهاتف، البريد، اسم المستخدم، وكلمة المرور. الرمز والـQR يبقيان كما هما.</p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <EditField label="الاسم" value={form.name} onChange={(v) => setForm({ ...form, name: v })} />
        <EditField label="اسم صاحب المحل" value={form.ownerName} onChange={(v) => setForm({ ...form, ownerName: v })} />
        <EditField label="الهاتف" value={form.contactPhone} onChange={(v) => setForm({ ...form, contactPhone: v })} dir="ltr" />
        <EditField label="البريد الإلكتروني" value={form.email} onChange={(v) => setForm({ ...form, email: v })} dir="ltr" />
        <EditField label="اسم المستخدم (للدخول)" value={form.username} onChange={(v) => setForm({ ...form, username: v })} dir="ltr" />
        <EditField label="كلمة مرور جديدة (اتركها فارغة للإبقاء)" value={form.password} onChange={(v) => setForm({ ...form, password: v })} dir="ltr" type="password" />
        <EditField label="العمولة لكل مشترك ₪" value={form.commissionAmount} onChange={(v) => setForm({ ...form, commissionAmount: v })} dir="ltr" />
      </div>
      {error && <p className="mt-2 text-xs font-bold text-rose-600">{error}</p>}
      {saved && !error && <p className="mt-2 text-xs font-bold text-emerald-600">تم حفظ التعديلات ✓</p>}
      <button disabled={saving} className="mt-3 rounded-xl bg-[#0F8B94] px-4 py-2 text-sm font-bold text-white hover:bg-[#0B6E75] disabled:opacity-60">
        {saving ? "جارِ الحفظ…" : "حفظ التعديلات"}
      </button>
    </form>
  );
}

function EditField({
  label,
  value,
  onChange,
  dir,
  type,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  dir?: "ltr" | "rtl";
  type?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-bold text-[#94A3B8]">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        dir={dir}
        type={type || "text"}
        className="h-10 w-full rounded-xl border border-[#E5E7EB] bg-white px-3 text-sm outline-none focus:border-[#0F8B94]"
      />
    </label>
  );
}

const MINI_ACCENTS: Record<string, string> = {
  teal: "bg-[#E7F6F5] text-[#0F8B94]",
  blue: "bg-blue-50 text-blue-600",
  violet: "bg-violet-50 text-violet-600",
  amber: "bg-amber-50 text-amber-600",
};

function MiniKpi({ icon: Icon, label, value, accent }: { icon: typeof Users; label: string; value: number | string; accent: string }) {
  return (
    <div className="rounded-2xl border border-[#EAECEF] bg-white p-4">
      <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${MINI_ACCENTS[accent] || MINI_ACCENTS.teal}`}>
        <Icon className="h-4 w-4" />
      </div>
      <p className="mt-2 text-2xl font-black text-[#1F2937]">{value}</p>
      <p className="text-xs font-bold text-[#94A3B8]">{label}</p>
    </div>
  );
}

const INPUT =
  "h-11 w-full rounded-xl border border-[#E5E7EB] bg-[#FAFBFC] px-3 text-sm text-[#1F2937] outline-none transition focus:border-[#0F8B94] focus:bg-white";

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-semibold text-[#374151]">
        {label}
        {required && <span className="text-[#0F8B94]"> *</span>}
      </span>
      {children}
    </label>
  );
}

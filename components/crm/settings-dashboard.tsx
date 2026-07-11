"use client";

import { Loader2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { SETTINGS_API_URL } from "@/lib/crm/constants";
import type { SystemSettings } from "@/lib/crm/settings";

export function SettingsDashboard({ canEdit }: { canEdit: boolean }) {
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const loadSettings = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(SETTINGS_API_URL, { cache: "no-store" });
      const data = await res.json();
      if (res.ok) setSettings(data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!settings || !canEdit) return;
    setSaving(true);
    try {
      const res = await fetch(SETTINGS_API_URL, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      if (!res.ok) {
        alert((await res.json()).error || "فشل حفظ الإعدادات");
        return;
      }
      setSettings(await res.json());
      alert("تم حفظ الإعدادات");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="mt-8 flex items-center justify-center rounded-[28px] border border-[#EAECEF] bg-white py-20 text-[#707A84]">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  if (!settings) {
    return <div className="mt-8 rounded-[28px] border border-rose-200 bg-rose-50 p-8 text-center text-rose-700">تعذر تحميل الإعدادات</div>;
  }

  return (
    <section className="mt-8">
      <form onSubmit={handleSave} className="rounded-[28px] border border-[#EAECEF] bg-white p-6 shadow-sm">
        <h3 className="text-[22px] font-bold text-[#1F2937]">إعدادات الشركة والنظام</h3>
        <p className="mt-1 text-sm text-[#707A84]">الاسم، العملة، الضريبة الافتراضية، والتنسيقات</p>

        <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
          <label className="block text-sm md:col-span-2">
            <span className="mb-1 block font-semibold">اسم الشركة</span>
            <input value={settings.companyName} disabled={!canEdit} onChange={(e) => setSettings({ ...settings, companyName: e.target.value })} className="w-full rounded-xl border border-[#E5E7EB] px-3 py-2" />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-semibold">العنوان</span>
            <input value={settings.address || ""} disabled={!canEdit} onChange={(e) => setSettings({ ...settings, address: e.target.value })} className="w-full rounded-xl border border-[#E5E7EB] px-3 py-2" />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-semibold">الرقم الضريبي</span>
            <input value={settings.taxNumber || ""} disabled={!canEdit} onChange={(e) => setSettings({ ...settings, taxNumber: e.target.value })} className="w-full rounded-xl border border-[#E5E7EB] px-3 py-2" dir="ltr" />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-semibold">العملة</span>
            <input value={settings.currency} disabled={!canEdit} onChange={(e) => setSettings({ ...settings, currency: e.target.value })} className="w-full rounded-xl border border-[#E5E7EB] px-3 py-2" dir="ltr" />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-semibold">اللغة</span>
            <select value={settings.language} disabled={!canEdit} onChange={(e) => setSettings({ ...settings, language: e.target.value })} className="w-full rounded-xl border border-[#E5E7EB] px-3 py-2">
              <option value="ar">العربية</option>
              <option value="en">English</option>
            </select>
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-semibold">المنطقة الزمنية</span>
            <input value={settings.timezone} disabled={!canEdit} onChange={(e) => setSettings({ ...settings, timezone: e.target.value })} className="w-full rounded-xl border border-[#E5E7EB] px-3 py-2" dir="ltr" />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-semibold">تنسيق التاريخ</span>
            <input value={settings.dateFormat} disabled={!canEdit} onChange={(e) => setSettings({ ...settings, dateFormat: e.target.value })} className="w-full rounded-xl border border-[#E5E7EB] px-3 py-2" dir="ltr" />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-semibold">نسبة الضريبة الافتراضية %</span>
            <input type="number" value={settings.defaultTaxRate} disabled={!canEdit} onChange={(e) => setSettings({ ...settings, defaultTaxRate: Number(e.target.value) })} className="w-full rounded-xl border border-[#E5E7EB] px-3 py-2" />
          </label>
          <label className="block text-sm md:col-span-2">
            <span className="mb-1 block font-semibold">رابط الشعار</span>
            <input value={settings.logoUrl || ""} disabled={!canEdit} onChange={(e) => setSettings({ ...settings, logoUrl: e.target.value })} className="w-full rounded-xl border border-[#E5E7EB] px-3 py-2" dir="ltr" />
          </label>
        </div>

        {canEdit && (
          <button type="submit" disabled={saving} className="mt-6 rounded-xl bg-[#0F8B94] px-5 py-2 text-sm font-bold text-white">
            {saving ? "جاري الحفظ..." : "حفظ الإعدادات"}
          </button>
        )}
      </form>
    </section>
  );
}

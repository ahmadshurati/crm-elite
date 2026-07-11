"use client";

import { Loader2, Plus, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { ROLES_API_URL } from "@/lib/crm/constants";
import {
  PERMISSION_FIELDS,
  defaultPermissions,
  permissionLabels,
} from "@/lib/crm/user-permissions";
import type { RoleTemplateRecord } from "@/lib/crm/role-templates-data";

const emptyForm = {
  name: "",
  description: "",
  ...defaultPermissions,
};

export function RoleTemplatesDashboard({ canEdit }: { canEdit: boolean }) {
  const [templates, setTemplates] = useState<RoleTemplateRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const loadTemplates = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(ROLES_API_URL, { cache: "no-store" });
      const data = await res.json();
      if (res.ok) setTemplates(Array.isArray(data) ? data : []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTemplates();
  }, [loadTemplates]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      const res = await fetch(ROLES_API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        alert((await res.json()).error || "فشل إنشاء القالب");
        return;
      }
      setForm(emptyForm);
      setFormOpen(false);
      await loadTemplates();
    } finally {
      setSaving(false);
    }
  }

  async function deleteTemplate(template: RoleTemplateRecord) {
    if (!canEdit || template.isSystem || !confirm(`حذف ${template.name}؟`)) return;
    const res = await fetch(`${ROLES_API_URL}/${template.id}`, { method: "DELETE" });
    if (!res.ok) {
      alert((await res.json()).error || "لا يمكن حذف هذا القالب");
      return;
    }
    await loadTemplates();
  }

  return (
    <section className="mt-8 space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-[28px] border border-[#EAECEF] bg-white px-6 py-5 shadow-sm">
        <div>
          <h3 className="text-[22px] font-bold text-[#1F2937]">قوالب الأدوار والصلاحيات</h3>
          <p className="mt-1 text-sm text-[#707A84]">تطبيق صلاحيات جاهزة على المستخدمين بسرعة</p>
        </div>
        {canEdit && (
          <button type="button" onClick={() => setFormOpen((v) => !v)} className="flex items-center gap-2 rounded-2xl bg-[#0F8B94] px-5 py-3 text-sm font-bold text-white">
            <Plus className="h-4 w-4" />{formOpen ? "إخفاء" : "قالب جديد"}
          </button>
        )}
      </div>

      {formOpen && canEdit && (
        <form onSubmit={handleCreate} className="rounded-[28px] border border-[#EAECEF] bg-white p-6">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <label className="block text-sm">
              <span className="mb-1 block font-semibold">اسم القالب</span>
              <input value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} className="w-full rounded-xl border border-[#E5E7EB] px-3 py-2" />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block font-semibold">الوصف</span>
              <input value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} className="w-full rounded-xl border border-[#E5E7EB] px-3 py-2" />
            </label>
          </div>
          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
            {PERMISSION_FIELDS.map((field) => (
              <label key={field} className="flex items-center gap-2 rounded-xl border border-[#E5E7EB] bg-[#FAFAFA] p-3 text-sm">
                <input type="checkbox" checked={Boolean(form[field as keyof typeof form])} onChange={(e) => setForm((p) => ({ ...p, [field]: e.target.checked }))} />
                {permissionLabels[field]}
              </label>
            ))}
          </div>
          <button type="submit" disabled={saving} className="mt-4 rounded-xl bg-[#0F8B94] px-5 py-2 text-sm font-bold text-white">{saving ? "جاري الحفظ..." : "حفظ القالب"}</button>
        </form>
      )}

      <div className="rounded-[28px] border border-[#EAECEF] bg-white shadow-sm">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-[#707A84]"><Loader2 className="h-5 w-5 animate-spin" /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-[900px] w-full text-right text-sm">
              <thead>
                <tr className="border-b border-[#EEF1F4] text-[#8B95A1]">
                  <th className="px-4 py-3">القالب</th>
                  <th className="px-4 py-3">الوصف</th>
                  <th className="px-4 py-3">الصلاحيات</th>
                  <th className="px-4 py-3">النوع</th>
                  <th className="px-4 py-3">إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {templates.map((template) => (
                  <tr key={template.id} className="border-b border-[#F1F5F9]">
                    <td className="px-4 py-4 font-bold">{template.name}</td>
                    <td className="px-4 py-4 text-[#707A84]">{template.description || "-"}</td>
                    <td className="px-4 py-4">{PERMISSION_FIELDS.filter((field) => template.permissions[field]).length} صلاحية</td>
                    <td className="px-4 py-4">{template.isSystem ? "نظام" : "مخصص"}</td>
                    <td className="px-4 py-4">
                      {canEdit && !template.isSystem && (
                        <button type="button" onClick={() => deleteTemplate(template)} className="rounded-lg bg-rose-50 p-1.5 text-rose-600">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}

export type { RoleTemplateRecord };

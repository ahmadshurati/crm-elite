"use client";

import {
  Building2,
  Loader2,
  Plus,
  Shield,
  ToggleLeft,
  ToggleRight,
  UserPlus,
  Users,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { CompanyRecord } from "@/lib/tenant";

type PlatformUser = {
  id: number;
  username: string;
  role: string;
  isActive: boolean | number;
  companyId: number | null;
  companyName?: string | null;
  companySlug?: string | null;
  companyIsDemo?: boolean | number;
};

const PLATFORM_COMPANIES_URL = "/api/platform/companies";
const PLATFORM_USERS_URL = "/api/platform/users";

const demoPermissions = {
  viewSubscribers: true,
  createSubscribers: true,
  editSubscribers: true,
  deleteSubscribers: false,
  viewAccidents: true,
  createAccidents: true,
  editAccidents: true,
  deleteAccidents: false,
  viewAccounting: true,
  editPayments: false,
  viewUsers: false,
  createUsers: false,
  editUsers: false,
  deleteUsers: false,
  viewActivityLog: false,
};

export function PlatformOwnerDashboard() {
  const [companies, setCompanies] = useState<CompanyRecord[]>([]);
  const [users, setUsers] = useState<PlatformUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<"companies" | "users" | "demo">("companies");
  const [companyForm, setCompanyForm] = useState({
    name: "",
    type: "insurance",
    contactEmail: "",
    contactPhone: "",
    adminUsername: "",
    adminPassword: "",
    notes: "",
  });
  const [userForm, setUserForm] = useState({
    companyId: "",
    username: "",
    password: "",
    role: "user" as "master" | "user",
  });
  const [lastCreated, setLastCreated] = useState<{ username: string; password: string; company: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [companiesRes, usersRes] = await Promise.all([
        fetch(PLATFORM_COMPANIES_URL, { cache: "no-store" }),
        fetch(PLATFORM_USERS_URL, { cache: "no-store" }),
      ]);
      if (!companiesRes.ok || !usersRes.ok) throw new Error("تعذّر تحميل بيانات المنصة");
      setCompanies(await companiesRes.json());
      setUsers(await usersRes.json());
    } catch (loadError: unknown) {
      setError(loadError instanceof Error ? loadError.message : "حدث خطأ");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const demoCompany = useMemo(() => companies.find((company) => company.isDemo), [companies]);
  const demoUsers = useMemo(
    () => users.filter((user) => user.companyId === demoCompany?.id),
    [users, demoCompany]
  );
  const clientCompanies = useMemo(() => companies.filter((company) => !company.isDemo), [companies]);

  async function createCompany() {
    if (!companyForm.name.trim()) {
      setError("اسم الشركة مطلوب");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const res = await fetch(PLATFORM_COMPANIES_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(companyForm),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "فشل إنشاء الشركة");

      if (data.adminUser && companyForm.adminUsername && companyForm.adminPassword) {
        setLastCreated({
          username: companyForm.adminUsername,
          password: companyForm.adminPassword,
          company: companyForm.name,
        });
      }

      setCompanyForm({
        name: "",
        type: "insurance",
        contactEmail: "",
        contactPhone: "",
        adminUsername: "",
        adminPassword: "",
        notes: "",
      });
      await load();
    } catch (saveError: unknown) {
      setError(saveError instanceof Error ? saveError.message : "حدث خطأ");
    } finally {
      setSaving(false);
    }
  }

  async function toggleCompanyActive(company: CompanyRecord) {
    setSaving(true);
    try {
      const res = await fetch(`${PLATFORM_COMPANIES_URL}/${company.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !company.isActive }),
      });
      if (!res.ok) throw new Error("فشل تحديث حالة الشركة");
      await load();
    } catch (saveError: unknown) {
      setError(saveError instanceof Error ? saveError.message : "حدث خطأ");
    } finally {
      setSaving(false);
    }
  }

  async function createCompanyUser() {
    if (!userForm.companyId || !userForm.username || !userForm.password) {
      setError("اختر الشركة وأدخل اسم المستخدم وكلمة المرور");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const res = await fetch(PLATFORM_USERS_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyId: Number(userForm.companyId),
          username: userForm.username,
          password: userForm.password,
          role: userForm.role,
          viewSubscribers: true,
          createSubscribers: userForm.role === "master",
          editSubscribers: userForm.role === "master",
          deleteSubscribers: false,
          viewAccidents: true,
          createAccidents: true,
          editAccidents: userForm.role === "master",
          deleteAccidents: false,
          viewAccounting: userForm.role === "master",
          editPayments: userForm.role === "master",
          viewUsers: userForm.role === "master",
          createUsers: userForm.role === "master",
          editUsers: userForm.role === "master",
          deleteUsers: false,
          viewActivityLog: userForm.role === "master",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "فشل إنشاء المستخدم");

      setLastCreated({
        username: userForm.username,
        password: userForm.password,
        company: companies.find((c) => c.id === Number(userForm.companyId))?.name || "",
      });
      setUserForm({ companyId: userForm.companyId, username: "", password: "", role: "user" });
      await load();
    } catch (saveError: unknown) {
      setError(saveError instanceof Error ? saveError.message : "حدث خطأ");
    } finally {
      setSaving(false);
    }
  }

  async function ensureDemoUser() {
    if (!demoCompany) {
      setError("شركة العرض التجريبي غير موجودة");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const username = "demo";
      const password = "demo1234";
      const res = await fetch(PLATFORM_USERS_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyId: demoCompany.id,
          username,
          password,
          role: "user",
          ...demoPermissions,
        }),
      });
      const data = await res.json();
      if (!res.ok && !String(data.error || "").includes("Duplicate")) {
        throw new Error(data.error || "فشل إنشاء حساب العرض");
      }
      setLastCreated({ username, password, company: demoCompany.name });
      await load();
    } catch (saveError: unknown) {
      setError(saveError instanceof Error ? saveError.message : "حدث خطأ");
    } finally {
      setSaving(false);
    }
  }

  async function toggleUserActive(user: PlatformUser) {
    if (user.role === "platform_owner") return;
    setSaving(true);
    try {
      const res = await fetch(PLATFORM_USERS_URL, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: user.id,
          isActive: !user.isActive,
          role: user.role,
          viewSubscribers: true,
          createSubscribers: true,
          editSubscribers: true,
          deleteSubscribers: false,
          viewAccidents: true,
          createAccidents: true,
          editAccidents: true,
          deleteAccidents: false,
          viewAccounting: true,
          editPayments: true,
          viewUsers: user.role === "master",
          createUsers: user.role === "master",
          editUsers: user.role === "master",
          deleteUsers: false,
          viewActivityLog: user.role === "master",
        }),
      });
      if (!res.ok) throw new Error("فشل تحديث المستخدم");
      await load();
    } catch (saveError: unknown) {
      setError(saveError instanceof Error ? saveError.message : "حدث خطأ");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[320px] items-center justify-center text-slate-400">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  return (
    <section className="space-y-6">
      {error && (
        <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 px-5 py-3 text-rose-200">{error}</div>
      )}

      {lastCreated && (
        <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-5 py-4 text-emerald-100">
          <p className="font-bold">تم إنشاء الحساب بنجاح — {lastCreated.company}</p>
          <p className="mt-2 text-sm" dir="ltr">
            Username: <strong>{lastCreated.username}</strong> · Password: <strong>{lastCreated.password}</strong>
          </p>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {[
          { key: "companies" as const, label: "الشركات", icon: Building2 },
          { key: "users" as const, label: "المستخدمون", icon: Users },
          { key: "demo" as const, label: "العرض التجريبي", icon: Shield },
        ].map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => setTab(item.key)}
            className={`inline-flex items-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-bold ${
              tab === item.key
                ? "bg-orange-500 text-white"
                : "border border-white/10 bg-[#111827] text-slate-300"
            }`}
          >
            <item.icon className="h-4 w-4" />
            {item.label}
          </button>
        ))}
      </div>

      {tab === "companies" && (
        <div id="companies" className="grid grid-cols-1 gap-6 xl:grid-cols-[380px_1fr]">
          <div className="rounded-[28px] border border-white/10 bg-[#111827] p-6">
            <h3 className="mb-4 flex items-center gap-2 text-lg font-bold text-white">
              <Plus className="h-5 w-5 text-orange-400" />
              شركة جديدة (عميل)
            </h3>
            <div className="space-y-3">
              <label className="block text-sm">
                <span className="mb-1 block font-medium text-slate-400">نوع النظام</span>
                <select
                  value={companyForm.type}
                  onChange={(e) => setCompanyForm((prev) => ({ ...prev, type: e.target.value }))}
                  className="h-11 w-full rounded-xl border border-white/10 bg-[#0B1120] px-3 text-white outline-none focus:border-orange-400"
                >
                  <option value="insurance">تأمين (CRM)</option>
                  <option value="dental">عيادة أسنان</option>
                </select>
              </label>
              {[
                ["name", "اسم الشركة / العيادة", "text"],
                ["contactEmail", "البريد", "email"],
                ["contactPhone", "الهاتف", "text"],
                ["adminUsername", "مدير الشركة (اسم مستخدم)", "text"],
                ["adminPassword", "كلمة مرور المدير", "password"],
                ["notes", "ملاحظات", "text"],
              ].map(([key, label, type]) => (
                <label key={key} className="block text-sm">
                  <span className="mb-1 block font-medium text-slate-400">{label}</span>
                  <input
                    type={type}
                    value={companyForm[key as keyof typeof companyForm]}
                    onChange={(e) => setCompanyForm((prev) => ({ ...prev, [key]: e.target.value }))}
                    className="h-11 w-full rounded-xl border border-white/10 bg-[#0B1120] px-3 text-white outline-none focus:border-orange-400"
                  />
                </label>
              ))}
              <button
                type="button"
                disabled={saving}
                onClick={createCompany}
                className="mt-2 w-full rounded-2xl bg-orange-500 py-3 text-sm font-bold text-white disabled:opacity-60"
              >
                {saving ? "جاري الحفظ..." : "إنشاء الشركة"}
              </button>
            </div>
          </div>

          <div className="overflow-hidden rounded-[28px] border border-white/10 bg-[#111827]">
            <table className="w-full text-right text-sm text-slate-200">
              <thead className="bg-white/5 text-slate-400">
                <tr>
                  <th className="px-5 py-4">الشركة</th>
                  <th className="px-5 py-4">المستخدمون</th>
                  <th className="px-5 py-4">الحالة</th>
                  <th className="px-5 py-4">إجراء</th>
                </tr>
              </thead>
              <tbody>
                {clientCompanies.map((company) => (
                  <tr key={company.id} className="border-t border-white/10">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white">{company.name}</span>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                            company.type === "dental" ? "bg-sky-500/20 text-sky-300" : "bg-orange-500/20 text-orange-300"
                          }`}
                        >
                          {company.type === "dental" ? "أسنان" : "تأمين"}
                        </span>
                      </div>
                      <div className="text-xs text-slate-500" dir="ltr">
                        {company.slug}
                      </div>
                    </td>
                    <td className="px-5 py-4">{company.userCount ?? 0}</td>
                    <td className="px-5 py-4">
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-bold ${
                          company.isActive ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"
                        }`}
                      >
                        {company.isActive ? "فعالة" : "موقوفة"}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <button
                        type="button"
                        disabled={saving}
                        onClick={() => toggleCompanyActive(company)}
                        className="inline-flex items-center gap-1 rounded-xl border border-white/10 px-3 py-2 text-xs font-bold text-slate-200"
                      >
                        {company.isActive ? <ToggleRight className="h-4 w-4" /> : <ToggleLeft className="h-4 w-4" />}
                        {company.isActive ? "إيقاف" : "تفعيل"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === "users" && (
        <div id="users" className="grid grid-cols-1 gap-6 xl:grid-cols-[380px_1fr]">
          <div className="rounded-[28px] border border-white/10 bg-[#111827] p-6">
            <h3 className="mb-4 flex items-center gap-2 text-lg font-bold text-white">
              <UserPlus className="h-5 w-5 text-orange-400" />
              مستخدم لشركة
            </h3>
            <div className="space-y-3">
              <label className="block text-sm">
                <span className="mb-1 block font-medium text-slate-400">الشركة</span>
                <select
                  value={userForm.companyId}
                  onChange={(e) => setUserForm((prev) => ({ ...prev, companyId: e.target.value }))}
                  className="h-11 w-full rounded-xl border border-white/10 bg-[#0B1120] px-3 text-white outline-none focus:border-orange-400"
                >
                  <option value="">اختر شركة</option>
                  {companies.filter((c) => c.isActive).map((company) => (
                    <option key={company.id} value={company.id}>
                      {company.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm">
                <span className="mb-1 block font-medium text-slate-400">اسم المستخدم</span>
                <input
                  value={userForm.username}
                  onChange={(e) => setUserForm((prev) => ({ ...prev, username: e.target.value }))}
                  className="h-11 w-full rounded-xl border border-white/10 bg-[#0B1120] px-3 text-white outline-none focus:border-orange-400"
                  dir="ltr"
                />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block font-medium text-slate-400">كلمة المرور</span>
                <input
                  type="password"
                  value={userForm.password}
                  onChange={(e) => setUserForm((prev) => ({ ...prev, password: e.target.value }))}
                  className="h-11 w-full rounded-xl border border-white/10 bg-[#0B1120] px-3 text-white outline-none focus:border-orange-400"
                  dir="ltr"
                />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block font-medium text-slate-400">الدور</span>
                <select
                  value={userForm.role}
                  onChange={(e) => setUserForm((prev) => ({ ...prev, role: e.target.value as "master" | "user" }))}
                  className="h-11 w-full rounded-xl border border-white/10 bg-[#0B1120] px-3 text-white outline-none focus:border-orange-400"
                >
                  <option value="master">مدير الشركة</option>
                  <option value="user">موظف</option>
                </select>
              </label>
              <button
                type="button"
                disabled={saving}
                onClick={createCompanyUser}
                className="mt-2 w-full rounded-2xl bg-orange-500 py-3 text-sm font-bold text-white disabled:opacity-60"
              >
                {saving ? "جاري الحفظ..." : "إنشاء المستخدم"}
              </button>
            </div>
          </div>

          <div className="overflow-hidden rounded-[28px] border border-white/10 bg-[#111827]">
            <table className="w-full text-right text-sm text-slate-200">
              <thead className="bg-white/5 text-slate-400">
                <tr>
                  <th className="px-5 py-4">المستخدم</th>
                  <th className="px-5 py-4">الشركة</th>
                  <th className="px-5 py-4">الدور</th>
                  <th className="px-5 py-4">الحالة</th>
                  <th className="px-5 py-4">إجراء</th>
                </tr>
              </thead>
              <tbody>
                {users
                  .filter((user) => user.role !== "platform_owner")
                  .map((user) => (
                    <tr key={user.id} className="border-t border-white/10">
                      <td className="px-5 py-4 font-bold" dir="ltr">
                        {user.username}
                      </td>
                      <td className="px-5 py-4">
                        {user.companyName || "—"}
                        {user.companyIsDemo ? (
                          <span className="ms-2 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-bold text-amber-700">
                            تجريبي
                          </span>
                        ) : null}
                      </td>
                      <td className="px-5 py-4">{user.role === "master" ? "مدير" : "موظف"}</td>
                      <td className="px-5 py-4">
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-bold ${
                            user.isActive ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"
                          }`}
                        >
                          {user.isActive ? "فعال" : "موقوف"}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <button
                          type="button"
                          disabled={saving}
                          onClick={() => toggleUserActive(user)}
                          className="rounded-xl border border-white/10 px-3 py-2 text-xs font-bold text-slate-200"
                        >
                          {user.isActive ? "إيقاف" : "تفعيل"}
                        </button>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === "demo" && (
        <div id="demo" className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="rounded-[28px] border border-white/10 bg-[#111827] p-6">
            <h3 className="text-lg font-bold text-white">حساب العرض التجريبي</h3>
            <p className="mt-2 text-sm leading-7 text-slate-400">
              للعروض التقديمية فقط. سجّل الدخول من <span dir="ltr">gosol.io/login</span> بحساب demo.
            </p>
            {demoCompany ? (
              <div className="mt-4 rounded-2xl bg-orange-500/10 p-4 text-sm text-orange-100">
                <p>
                  <strong>الشركة:</strong> {demoCompany.name}
                </p>
                <p className="mt-2">
                  <strong>المستخدمون:</strong> {demoUsers.length}
                </p>
              </div>
            ) : null}
            <button
              type="button"
              disabled={saving || !demoCompany}
              onClick={ensureDemoUser}
              className="mt-4 rounded-2xl bg-orange-500 px-5 py-3 text-sm font-bold text-white disabled:opacity-60"
            >
              {demoUsers.length ? "إعادة إنشاء حساب demo" : "إنشاء حساب demo"}
            </button>
            {demoUsers.length > 0 && (
              <div className="mt-4 rounded-2xl border border-white/10 p-4 text-sm text-slate-300" dir="ltr">
                {demoUsers.map((user) => (
                  <div key={user.id} className="font-mono">
                    username: <strong>{user.username}</strong>
                  </div>
                ))}
                <p className="mt-2 text-slate-500">كلمة المرور الافتراضية: demo1234</p>
              </div>
            )}
          </div>

          <div className="rounded-[28px] border border-white/10 bg-[#111827] p-6">
            <h3 className="text-lg font-bold text-white">كيف يعمل النظام</h3>
            <ol className="mt-4 list-decimal space-y-3 ps-5 text-sm leading-7 text-slate-400">
              <li>أنت تدير العملاء من <span dir="ltr">/admin</span>.</li>
              <li>موظفو الشركة يدخلون من <span dir="ltr">/login</span> ويرون بيانات شركتهم فقط.</li>
              <li>موظفو النسخة التجريبية يرون بيانات تجريبية فقط — نفس صفحة الدخول.</li>
              <li>عند توقيع عميل جديد، أنشئ شركته من تبويب الشركات.</li>
            </ol>
          </div>
        </div>
      )}
    </section>
  );
}

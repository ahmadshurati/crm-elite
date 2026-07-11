"use client";

import { useState } from "react";
import { Lock, Shield, User } from "lucide-react";

export function AdminLoginForm() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [totpCode, setTotpCode] = useState("");
  const [requires2fa, setRequires2fa] = useState(false);
  const [error, setError] = useState("");

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    const res = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: username.trim(),
        password: password.trim(),
        totpCode: requires2fa ? totpCode.trim() : undefined,
      }),
    });

    const data = await res.json().catch(() => ({}));

    if (data.requires2fa) {
      setRequires2fa(true);
      setError("أدخل رمز المصادقة الثنائية");
      return;
    }

    if (!res.ok) {
      setError(String(data.error || "بيانات الدخول غير صحيحة"));
      return;
    }

    window.location.href = String(data.redirectTo || "/admin");
  }

  return (
    <main dir="rtl" className="flex min-h-screen items-center justify-center bg-[#0B1120] p-6">
      <form
        onSubmit={handleLogin}
        className="w-full max-w-[430px] rounded-[28px] border border-white/10 bg-[#111827] p-8 shadow-2xl"
      >
        <p className="text-center text-xs font-bold uppercase tracking-[0.25em] text-orange-400">Gosol Platform</p>
        <h1 className="mt-4 text-center text-3xl font-bold text-white">دخول الإدارة</h1>
        <p className="mt-2 text-center text-sm text-slate-400">لوحة مالك المنصة فقط — ليس لموظفي الشركات</p>

        <div className="mt-8 space-y-4">
          <label className="block text-sm">
            <span className="mb-2 block font-bold text-slate-300">اسم المستخدم</span>
            <div className="flex h-12 items-center gap-3 rounded-2xl border border-white/10 bg-[#0B1120] px-4 focus-within:border-orange-400">
              <User className="h-5 w-5 text-slate-500" />
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="h-12 flex-1 bg-transparent text-left text-white outline-none"
                dir="ltr"
                placeholder="owner"
                required
              />
            </div>
          </label>

          <label className="block text-sm">
            <span className="mb-2 block font-bold text-slate-300">كلمة المرور</span>
            <div className="flex h-12 items-center gap-3 rounded-2xl border border-white/10 bg-[#0B1120] px-4 focus-within:border-orange-400">
              <Lock className="h-5 w-5 text-slate-500" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-12 flex-1 bg-transparent text-left text-white outline-none"
                dir="ltr"
                required
              />
            </div>
          </label>

          {requires2fa && (
            <label className="block text-sm">
              <span className="mb-2 block font-bold text-slate-300">رمز المصادقة الثنائية</span>
              <div className="flex h-12 items-center gap-3 rounded-2xl border border-white/10 bg-[#0B1120] px-4">
                <Shield className="h-5 w-5 text-slate-500" />
                <input
                  value={totpCode}
                  onChange={(e) => setTotpCode(e.target.value)}
                  className="h-12 flex-1 bg-transparent text-left text-white outline-none"
                  dir="ltr"
                  inputMode="numeric"
                  required
                />
              </div>
            </label>
          )}
        </div>

        {error && (
          <div className="mt-5 rounded-2xl bg-rose-500/10 px-4 py-3 text-center text-sm font-bold text-rose-300">
            {error}
          </div>
        )}

        <button
          type="submit"
          className="mt-7 h-12 w-full rounded-2xl bg-orange-500 text-base font-bold text-white transition hover:bg-orange-400"
        >
          {requires2fa ? "تأكيد الدخول" : "دخول الإدارة"}
        </button>
      </form>
    </main>
  );
}

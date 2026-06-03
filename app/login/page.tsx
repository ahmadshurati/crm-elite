"use client";

import { useState } from "react";
import { Lock, User } from "lucide-react";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    const res = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: username.trim(),
        password: password.trim(),
      }),
    });

    if (res.status === 500) {
      setError(
        "خطأ في الخادم (500). افتح /api/ping?diag=1 للتحقق من DATABASE_URL و SESSION_SECRET، ثم راجع سجلات الاستضافة."
      );
      return;
    }

    if (!res.ok) {
      setError("اسم المستخدم أو كلمة المرور غير صحيحة");
      return;
    }

    window.location.href = "/";
  }

  return (
    <main
      dir="rtl"
      className="flex min-h-screen items-center justify-center bg-[#F4F7FB] p-6"
    >
      <form
        onSubmit={handleLogin}
        className="w-full max-w-[430px] rounded-[34px] border border-[#E8EDF3] bg-white p-8 shadow-2xl"
      >
        <div className="flex justify-center">
          <img
            src="/loag.png"
            alt="Elite Insurance"
            width="150"
            height="55"
            className="object-contain"
          />
        </div>

        <h1 className="mt-8 text-center text-3xl font-bold text-[#1F2937]">
          تسجيل الدخول
        </h1>

        <p className="mt-2 text-center text-sm text-[#7A8594]">
        </p>

        <div className="mt-8 space-y-4">
          <div>
            <label className="mb-2 block text-sm font-bold text-[#374151]">
              اسم المستخدم
            </label>

            <div className="flex h-12 items-center gap-3 rounded-2xl border border-[#E5E7EB] bg-[#FAFBFC] px-4 focus-within:border-[#0F8B94]">
              <User className="h-5 w-5 text-[#9AA3AF]" />
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="h-12 flex-1 bg-transparent text-left outline-none"
                dir="ltr"
                placeholder="username@elite"
                required
              />
            </div>
          </div>

          <div>
            <label className="mb-2 block text-sm font-bold text-[#374151]">
              كلمة المرور
            </label>

            <div className="flex h-12 items-center gap-3 rounded-2xl border border-[#E5E7EB] bg-[#FAFBFC] px-4 focus-within:border-[#0F8B94]">
              <Lock className="h-5 w-5 text-[#9AA3AF]" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-12 flex-1 bg-transparent text-left outline-none"
                dir="ltr"
                placeholder="••••••••"
                required
              />
            </div>
          </div>
        </div>

        {error && (
          <div className="mt-5 rounded-2xl bg-rose-50 px-4 py-3 text-center text-sm font-bold text-rose-600">
            {error}
          </div>
        )}

        <button
          type="submit"
          className="mt-7 h-12 w-full rounded-2xl bg-[#0F8B94] text-base font-bold text-white transition hover:opacity-90"
        >
          دخول
        </button>
      </form>
    </main>
  );
}

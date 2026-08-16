"use client";

import { Building2, LayoutDashboard, LogOut, Menu, Shield, Users, X } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";

export function AdminShell({
  username,
  children,
}: {
  username?: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  async function logout() {
    await fetch("/api/logout", { method: "POST" });
    router.replace("/admin/login");
  }

  const nav = [
    { href: "/admin", label: "نظرة عامة", icon: LayoutDashboard },
    { href: "/admin#companies", label: "الشركات", icon: Building2 },
    { href: "/admin#users", label: "المستخدمون", icon: Users },
    { href: "/admin#demo", label: "العرض التجريبي", icon: Shield },
  ];

  return (
    <div dir="rtl" className="min-h-screen bg-[#0B1120] text-slate-100">
      <div className="flex min-h-screen">
        {open && (
          <div onClick={() => setOpen(false)} className="fixed inset-0 z-40 bg-black/50 lg:hidden" aria-hidden="true" />
        )}
        <aside className={`fixed inset-y-0 right-0 z-50 flex w-72 max-w-[85vw] shrink-0 flex-col border-l border-white/10 bg-[#111827] transition-transform duration-200 lg:static lg:z-auto lg:max-w-none lg:translate-x-0 ${open ? "translate-x-0" : "translate-x-full"}`}>
          <div className="relative border-b border-white/10 px-6 py-6">
            <button type="button" onClick={() => setOpen(false)} aria-label="إغلاق القائمة" className="absolute left-4 top-6 rounded-lg p-1.5 text-slate-300 hover:bg-white/10 lg:hidden">
              <X className="h-5 w-5" />
            </button>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-orange-400">Gosol Platform</p>
            <h1 className="mt-2 text-2xl font-bold text-white">لوحة الإدارة</h1>
            <p className="mt-2 text-sm text-slate-400">إدارة شركات CRM والعملاء</p>
          </div>

          <nav className="flex-1 space-y-1 p-4">
            {nav.map((item) => {
              const active = pathname === "/admin" && item.href.startsWith("/admin");
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className={`flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-bold transition ${
                    active ? "bg-orange-500/15 text-orange-300" : "text-slate-300 hover:bg-white/5 hover:text-white"
                  }`}
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="border-t border-white/10 p-4">
            <div className="rounded-2xl bg-white/5 px-4 py-3 text-sm">
              <p className="text-slate-400">مسجل الدخول</p>
              <p className="mt-1 font-bold text-white" dir="ltr">
                {username || "owner"}
              </p>
            </div>
            <button
              type="button"
              onClick={logout}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl border border-white/10 px-4 py-3 text-sm font-bold text-slate-200 hover:bg-white/5"
            >
              <LogOut className="h-4 w-4" />
              تسجيل الخروج
            </button>
          </div>
        </aside>

        <main className="min-w-0 flex-1">
          <header className="flex items-center justify-between border-b border-white/10 bg-[#111827]/80 px-4 py-4 backdrop-blur lg:hidden">
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => setOpen(true)} aria-label="القائمة" className="rounded-xl border border-white/10 p-2 text-slate-200 hover:bg-white/5">
                <Menu className="h-5 w-5" />
              </button>
              <div>
                <p className="text-xs font-bold text-orange-400">Gosol Platform</p>
                <h1 className="text-lg font-bold">لوحة الإدارة</h1>
              </div>
            </div>
            <button type="button" onClick={logout} className="rounded-xl border border-white/10 px-3 py-2 text-xs font-bold">
              خروج
            </button>
          </header>
          <div className="p-6 md:p-8">{children}</div>
        </main>
      </div>
    </div>
  );
}

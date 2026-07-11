"use client";

import { Suspense, useEffect, useState } from "react";
import { AdminShell } from "@/components/admin/admin-shell";
import { PlatformOwnerDashboard } from "@/components/admin/platform-owner-dashboard";

function AdminHomeInner() {
  const [username, setUsername] = useState<string>();

  useEffect(() => {
    fetch("/api/me", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.username) setUsername(data.username);
      })
      .catch(() => undefined);
  }, []);

  return (
    <AdminShell username={username}>
      <PlatformOwnerDashboard />
    </AdminShell>
  );
}

export default function AdminHomePage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[#0B1120] text-slate-400">
          جاري تحميل لوحة الإدارة...
        </div>
      }
    >
      <AdminHomeInner />
    </Suspense>
  );
}

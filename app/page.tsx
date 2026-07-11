"use client";

import { Suspense } from "react";
import { HomePage } from "@/components/crm/home-page";

export default function Home() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[#F7F8FA] text-[#707A84]">
          جاري تحميل النظام...
        </div>
      }
    >
      <HomePage />
    </Suspense>
  );
}

import { Suspense } from "react";
import { ClientDashboard } from "@/components/public/client-dashboard";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Gosol CRM — لوحة الشريك",
  description: "تابع عدد الزيارات والاشتراكات والعمولة الخاصة بك.",
};

export default function ClientDashboardPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[#F5F8FB] text-[#707A84]">
          جاري التحميل...
        </div>
      }
    >
      <ClientDashboard />
    </Suspense>
  );
}

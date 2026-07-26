import { Suspense } from "react";
import { LeadForm } from "@/components/public/lead-form";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Gosol CRM — سجّل اهتمامك",
  description: "نظام واحد لإدارة عملائك ومبيعاتك وتواصلك. سجّل بياناتك وسنتواصل معك.",
};

export default function FormPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[#0F8B94] text-white">
          جاري التحميل...
        </div>
      }
    >
      <LeadForm />
    </Suspense>
  );
}

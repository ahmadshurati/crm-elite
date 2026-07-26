"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  BarChart3,
  CalendarClock,
  CheckCircle2,
  FileText,
  Loader2,
  MessagesSquare,
  Sparkles,
  Users,
} from "lucide-react";

const FEATURES = [
  { icon: Users, title: "إدارة العملاء", desc: "جميع بيانات عملائك ومتابعاتهم في مكانٍ واحدٍ منظّم." },
  { icon: MessagesSquare, title: "تواصل موحّد", desc: "واتساب والبريد الإلكتروني والرسائل من داخل النظام." },
  { icon: BarChart3, title: "الصفقات والمبيعات", desc: "تابِع صفقاتك من أوّل تواصل حتى الإغلاق." },
  { icon: CalendarClock, title: "المهام والتذكيرات", desc: "لا يفوتك موعدٌ أو متابعةٌ مع أيّ عميل." },
  { icon: FileText, title: "الفواتير والعروض", desc: "أنشئ عروض أسعارٍ وفواتير احترافيةً بسرعة." },
  { icon: Sparkles, title: "تقارير ذكية", desc: "تعرَّف على أداء عملك بلمحةٍ عبر لوحةٍ واضحة." },
];

export function LeadForm() {
  const searchParams = useSearchParams();
  const ref = searchParams.get("ref");
  const scanLogged = useRef(false);

  const [form, setForm] = useState({
    name: "",
    businessName: "",
    phone: "",
    email: "",
    note: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (scanLogged.current) return;
    scanLogged.current = true;

    const scanKey = `gosol_scan_${ref || "direct"}`;
    if (typeof window !== "undefined" && sessionStorage.getItem(scanKey)) return;

    fetch("/api/referral/scan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ref }),
    })
      .catch(() => {})
      .finally(() => {
        try {
          sessionStorage.setItem(scanKey, "1");
        } catch {
          // ignore
        }
      });
  }, [ref]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, ref }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(String(data.error || "تعذّر الإرسال، حاول مرة أخرى"));
        return;
      }
      setDone(true);
    } catch {
      setError("تعذّر الاتصال، تأكد من الإنترنت وحاول مجدداً");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main
      dir="rtl"
      className="relative min-h-screen overflow-hidden text-white"
      style={{
        backgroundColor: "#0A565C",
        backgroundImage: [
          "radial-gradient(circle at 8% 6%, rgba(94,234,212,0.65) 0px, transparent 38%)",
          "radial-gradient(circle at 95% 4%, rgba(56,189,248,0.45) 0px, transparent 40%)",
          "radial-gradient(circle at 92% 96%, rgba(4,47,52,0.85) 0px, transparent 46%)",
          "radial-gradient(circle at 10% 98%, rgba(13,148,136,0.55) 0px, transparent 44%)",
          "linear-gradient(135deg, #16A6B0 0%, #0B6A71 48%, #06373C 100%)",
        ].join(", "),
      }}
    >
      {/* decorative animated glows */}
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="gosol-float absolute -right-24 -top-24 h-80 w-80 rounded-full bg-[#7CE0DA]/25 blur-3xl" />
        <div
          className="gosol-float absolute -left-20 top-1/3 h-72 w-72 rounded-full bg-[#38BDF8]/20 blur-3xl"
          style={{ animationDelay: "1.5s" }}
        />
        <div
          className="gosol-float absolute -bottom-10 right-1/3 h-72 w-72 rounded-full bg-[#042F34]/50 blur-3xl"
          style={{ animationDelay: "3s" }}
        />
      </div>

      <div className="relative mx-auto flex max-w-6xl flex-col gap-10 px-5 py-9 lg:py-14">
        <header className="gosol-fade-up flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/15 text-lg font-black text-white shadow-lg ring-1 ring-white/25">
              G
            </div>
            <span className="text-xl font-extrabold tracking-tight">Gosol CRM</span>
          </div>
          <span className="rounded-full bg-white/15 px-3.5 py-1.5 text-xs font-bold ring-1 ring-white/25">
            منصة إدارة الأعمال
          </span>
        </header>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-start">
          <section>
            <span
              className="gosol-fade-up inline-flex items-center gap-1.5 rounded-full bg-white/12 px-3 py-1 text-xs font-bold ring-1 ring-white/25"
              style={{ animationDelay: "0.05s" }}
            >
              <Sparkles className="h-3.5 w-3.5" />
              جرّبه مجاناً
            </span>
            <h1
              className="gosol-fade-up mt-4 text-3xl font-black leading-tight drop-shadow-sm md:text-[44px] md:leading-[1.12]"
              style={{ animationDelay: "0.12s" }}
            >
              منظومةٌ واحدةٌ لإدارة عملائك
              <br className="hidden md:block" /> ومبيعاتك وتواصلك
            </h1>
            <p
              className="gosol-fade-up mt-4 max-w-xl text-[15px] leading-8 text-white/90 md:text-base"
              style={{ animationDelay: "0.2s" }}
            >
              يساعدك Gosol CRM على تنظيم عملائك، ومتابعة صفقاتك ومهامك، وإصدار فواتيرك، والتواصل مع
              زبائنك عبر واتساب والبريد الإلكتروني — كلّ ذلك من مكانٍ واحدٍ وبسهولة. اترك بياناتك وسنتواصل
              معك لنقدّم لك جولةً تعريفيةً على النظام.
            </p>

            <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2">
              {FEATURES.map((f, i) => (
                <div
                  key={f.title}
                  className="gosol-fade-up group flex items-start gap-3 rounded-2xl bg-white/10 p-4 ring-1 ring-white/15 backdrop-blur-sm transition duration-300 hover:-translate-y-1 hover:bg-white/15"
                  style={{ animationDelay: `${0.28 + i * 0.07}s` }}
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/15 transition group-hover:scale-110">
                    <f.icon className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <p className="text-sm font-bold">{f.title}</p>
                    <p className="mt-0.5 text-xs leading-6 text-white/80">{f.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section
            className="gosol-fade-up rounded-[30px] border border-white/40 bg-white p-6 text-[#1F2937] shadow-2xl md:p-8"
            style={{ animationDelay: "0.18s" }}
          >
            {done ? (
              <div className="flex flex-col items-center py-10 text-center">
                <div className="gosol-pop flex h-16 w-16 items-center justify-center rounded-full bg-[#E7F6F5]">
                  <CheckCircle2 className="h-9 w-9 text-[#0F8B94]" />
                </div>
                <h2 className="mt-5 text-2xl font-bold text-[#1F2937]">تمّ استلام بياناتك</h2>
                <p className="mt-2 max-w-xs text-sm leading-7 text-[#707A84]">
                  شكراً لاهتمامك بـ Gosol CRM. سيتواصل معك فريقنا في أقرب وقت.
                </p>
              </div>
            ) : (
              <>
                <h2 className="text-2xl font-bold text-[#1F2937]">سجّل اهتمامك</h2>
                <p className="mt-1 text-sm text-[#707A84]">
                  اترك بياناتك وسنتواصل معك لنقدّم لك جولةً مجانيةً على النظام.
                </p>

                <form onSubmit={handleSubmit} className="mt-6 space-y-4">
                  <Field label="الاسم الكامل" required>
                    <input
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                      className={inputClass}
                      placeholder="مثال: أحمد محمد"
                      required
                    />
                  </Field>

                  <Field label="اسم النشاط / المحل">
                    <input
                      value={form.businessName}
                      onChange={(e) => setForm({ ...form, businessName: e.target.value })}
                      className={inputClass}
                      placeholder="اختياري"
                    />
                  </Field>

                  <Field label="رقم الهاتف" required>
                    <input
                      value={form.phone}
                      onChange={(e) => setForm({ ...form, phone: e.target.value })}
                      className={inputClass}
                      placeholder="05xxxxxxxx"
                      dir="ltr"
                      inputMode="tel"
                      required
                    />
                  </Field>

                  <Field label="البريد الإلكتروني">
                    <input
                      value={form.email}
                      onChange={(e) => setForm({ ...form, email: e.target.value })}
                      className={inputClass}
                      placeholder="اختياري"
                      dir="ltr"
                      type="email"
                    />
                  </Field>

                  <Field label="رسالة">
                    <textarea
                      value={form.note}
                      onChange={(e) => setForm({ ...form, note: e.target.value })}
                      className={`${inputClass} min-h-[84px] resize-none py-3`}
                      placeholder="اختياري — ما الذي تودّ معرفته عن النظام؟"
                    />
                  </Field>

                  {error && (
                    <p className="rounded-xl bg-rose-50 px-4 py-2.5 text-sm font-semibold text-rose-700">
                      {error}
                    </p>
                  )}

                  <button
                    type="submit"
                    disabled={submitting}
                    className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#0F8B94] px-5 py-3.5 text-base font-bold text-white shadow-lg shadow-[#0F8B94]/30 transition duration-200 hover:-translate-y-0.5 hover:bg-[#0B6E75] hover:shadow-xl active:translate-y-0 disabled:opacity-60"
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="h-5 w-5 animate-spin" />
                        جاري الإرسال...
                      </>
                    ) : (
                      "أرسل بياناتي"
                    )}
                  </button>

                  <p className="text-center text-[11px] leading-5 text-[#9AA3AF]">
                    بياناتك تُستخدم فقط للتواصل معك بخصوص Gosol CRM.
                  </p>
                </form>
              </>
            )}
          </section>
        </div>

        <footer className="gosol-fade-up text-center text-xs text-white/70" style={{ animationDelay: "0.6s" }}>
          © {new Date().getFullYear()} Gosol CRM — جميع الحقوق محفوظة
        </footer>
      </div>
    </main>
  );
}

const inputClass =
  "h-12 w-full rounded-xl border border-[#E5E7EB] bg-[#FAFBFC] px-4 text-sm text-[#1F2937] outline-none transition focus:border-[#0F8B94] focus:bg-white focus:ring-2 focus:ring-[#0F8B94]/15";

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-semibold text-[#374151]">
        {label}
        {required && <span className="text-[#0F8B94]"> *</span>}
      </span>
      {children}
    </label>
  );
}

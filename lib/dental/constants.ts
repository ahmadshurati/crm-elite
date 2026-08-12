export const TOOTH_CONDITIONS: { id: string; label: string; color: string }[] = [
  { id: "healthy", label: "سليم", color: "#E5E7EB" },
  { id: "caries", label: "تسوس", color: "#F59E0B" },
  { id: "filling", label: "حشوة", color: "#3B82F6" },
  { id: "temp_filling", label: "حشوة مؤقتة", color: "#93C5FD" },
  { id: "root_canal", label: "علاج عصب", color: "#8B5CF6" },
  { id: "crown", label: "تاج", color: "#F59E0B" },
  { id: "bridge", label: "جسر", color: "#D97706" },
  { id: "implant", label: "زرعة", color: "#0EA5E9" },
  { id: "missing", label: "مفقود", color: "#9CA3AF" },
  { id: "needs_extraction", label: "يحتاج خلع", color: "#EF4444" },
  { id: "extracted", label: "مخلوع", color: "#6B7280" },
  { id: "fracture", label: "كسر", color: "#DC2626" },
  { id: "inflammation", label: "التهاب", color: "#F43F5E" },
  { id: "gum_issue", label: "مشكلة لثة", color: "#EC4899" },
];

export const CONDITION_MAP: Record<string, { label: string; color: string }> = Object.fromEntries(
  TOOTH_CONDITIONS.map((c) => [c.id, { label: c.label, color: c.color }])
);

// FDI numbering per quadrant (permanent teeth)
export const QUADRANTS: { id: string; label: string; teeth: number[] }[] = [
  { id: "ur", label: "علوي أيمن", teeth: [18, 17, 16, 15, 14, 13, 12, 11] },
  { id: "ul", label: "علوي أيسر", teeth: [21, 22, 23, 24, 25, 26, 27, 28] },
  { id: "lr", label: "سفلي أيمن", teeth: [48, 47, 46, 45, 44, 43, 42, 41] },
  { id: "ll", label: "سفلي أيسر", teeth: [31, 32, 33, 34, 35, 36, 37, 38] },
];

export const APPOINTMENT_STATUSES: { id: string; label: string; color: string }[] = [
  { id: "scheduled", label: "مجدول", color: "bg-slate-100 text-slate-600" },
  { id: "confirmed", label: "مؤكد", color: "bg-blue-50 text-blue-700" },
  { id: "arrived", label: "وصل", color: "bg-teal-50 text-teal-700" },
  { id: "waiting", label: "ينتظر", color: "bg-amber-50 text-amber-700" },
  { id: "in_treatment", label: "قيد العلاج", color: "bg-violet-50 text-violet-700" },
  { id: "completed", label: "مكتمل", color: "bg-emerald-50 text-emerald-700" },
  { id: "cancelled", label: "ملغي", color: "bg-rose-50 text-rose-700" },
  { id: "no_show", label: "لم يحضر", color: "bg-gray-200 text-gray-600" },
];

export const APPOINTMENT_STATUS_MAP: Record<string, { label: string; color: string }> = Object.fromEntries(
  APPOINTMENT_STATUSES.map((s) => [s.id, { label: s.label, color: s.color }])
);

export const PLAN_ITEM_STATUSES: { id: string; label: string }[] = [
  { id: "proposed", label: "مقترح" },
  { id: "approved", label: "وافق المريض" },
  { id: "in_progress", label: "قيد التنفيذ" },
  { id: "completed", label: "مكتمل" },
  { id: "cancelled", label: "ملغي" },
];

export const PLAN_ITEM_STATUS_MAP: Record<string, string> = Object.fromEntries(
  PLAN_ITEM_STATUSES.map((s) => [s.id, s.label])
);

export const PAYMENT_METHODS: { id: string; label: string }[] = [
  { id: "cash", label: "نقدي" },
  { id: "card", label: "بطاقة" },
  { id: "transfer", label: "تحويل بنكي" },
  { id: "check", label: "شيك" },
  { id: "insurance", label: "تأمين" },
];

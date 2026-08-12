export const TOOTH_CONDITIONS: { id: string; label: string; color: string; code: string }[] = [
  { id: "healthy", label: "سليم", color: "#E5E7EB", code: "" },
  { id: "caries", label: "تسوس", color: "#F59E0B", code: "C" },
  { id: "filling", label: "حشوة", color: "#3B82F6", code: "F" },
  { id: "temp_filling", label: "حشوة مؤقتة", color: "#93C5FD", code: "TF" },
  { id: "root_canal", label: "علاج عصب", color: "#8B5CF6", code: "RC" },
  { id: "crown", label: "تاج", color: "#F59E0B", code: "Cr" },
  { id: "bridge", label: "جسر", color: "#D97706", code: "Br" },
  { id: "implant", label: "زرعة", color: "#0EA5E9", code: "Im" },
  { id: "missing", label: "مفقود", color: "#9CA3AF", code: "—" },
  { id: "needs_extraction", label: "يحتاج خلع", color: "#EF4444", code: "!" },
  { id: "extracted", label: "مخلوع", color: "#6B7280", code: "X" },
  { id: "fracture", label: "كسر", color: "#DC2626", code: "Fr" },
  { id: "inflammation", label: "التهاب", color: "#F43F5E", code: "In" },
  { id: "gum_issue", label: "مشكلة لثة", color: "#EC4899", code: "G" },
];

export const CONDITION_MAP: Record<string, { label: string; color: string; code: string }> = Object.fromEntries(
  TOOTH_CONDITIONS.map((c) => [c.id, { label: c.label, color: c.color, code: c.code }])
);

// FDI numbering per quadrant (permanent teeth)
export const QUADRANTS: { id: string; label: string; teeth: number[] }[] = [
  { id: "ur", label: "علوي أيمن", teeth: [18, 17, 16, 15, 14, 13, 12, 11] },
  { id: "ul", label: "علوي أيسر", teeth: [21, 22, 23, 24, 25, 26, 27, 28] },
  { id: "lr", label: "سفلي أيمن", teeth: [48, 47, 46, 45, 44, 43, 42, 41] },
  { id: "ll", label: "سفلي أيسر", teeth: [31, 32, 33, 34, 35, 36, 37, 38] },
];

// FDI numbering per quadrant (primary / deciduous teeth)
export const PRIMARY_QUADRANTS: { id: string; label: string; teeth: number[] }[] = [
  { id: "ur", label: "علوي أيمن", teeth: [55, 54, 53, 52, 51] },
  { id: "ul", label: "علوي أيسر", teeth: [61, 62, 63, 64, 65] },
  { id: "lr", label: "سفلي أيمن", teeth: [85, 84, 83, 82, 81] },
  { id: "ll", label: "سفلي أيسر", teeth: [71, 72, 73, 74, 75] },
];

export const TOOTH_SURFACES: { id: string; label: string; short: string }[] = [
  { id: "mesial", label: "إنسي (Mesial)", short: "M" },
  { id: "distal", label: "وحشي (Distal)", short: "D" },
  { id: "occlusal", label: "إطباقي (Occlusal)", short: "O" },
  { id: "incisal", label: "قاطع (Incisal)", short: "I" },
  { id: "buccal", label: "دهليزي (Buccal)", short: "B" },
  { id: "lingual", label: "لساني (Lingual)", short: "L" },
];

export const TOOTH_HISTORY_ACTIONS: Record<string, string> = {
  diagnosis: "تشخيص",
  condition: "تغيير حالة",
  surface: "سطح",
  treatment: "علاج",
  note: "ملاحظة",
};

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
  { id: "accepted", label: "وافق المريض" },
  { id: "declined", label: "رفض المريض" },
  { id: "in_progress", label: "قيد التنفيذ" },
  { id: "completed", label: "مكتمل" },
  { id: "cancelled", label: "ملغي" },
];

export const PLAN_ITEM_STATUS_MAP: Record<string, string> = Object.fromEntries(
  PLAN_ITEM_STATUSES.map((s) => [s.id, s.label])
);

// Statuses that count toward what the patient owes
export const CHARGEABLE_STATUSES = ["accepted", "in_progress", "completed"] as const;

export const FILE_CATEGORIES: { id: string; label: string; kind: "imaging" | "document" }[] = [
  { id: "bitewing", label: "أشعة عضّة (Bitewing)", kind: "imaging" },
  { id: "periapical", label: "أشعة ذروية (Periapical)", kind: "imaging" },
  { id: "panoramic", label: "بانوراما (Panoramic)", kind: "imaging" },
  { id: "cbct", label: "أشعة مقطعية (CBCT)", kind: "imaging" },
  { id: "intraoral", label: "صورة داخل الفم", kind: "imaging" },
  { id: "photo", label: "صورة سريرية", kind: "imaging" },
  { id: "before_after", label: "قبل / بعد", kind: "imaging" },
  { id: "document", label: "مستند", kind: "document" },
  { id: "consent", label: "موافقة / إقرار", kind: "document" },
  { id: "other", label: "أخرى", kind: "document" },
];

export const FILE_CATEGORY_MAP: Record<string, string> = Object.fromEntries(FILE_CATEGORIES.map((c) => [c.id, c.label]));

export const TREATMENT_CATEGORIES: Record<string, string> = {
  general: "عام",
  preventive: "وقائي",
  restorative: "ترميمي",
  endodontics: "علاج جذور",
  surgery: "جراحة",
  prosthetics: "تعويضات",
  periodontics: "لثة",
  orthodontics: "تقويم",
  cosmetic: "تجميلي",
};

export const PAYMENT_METHODS: { id: string; label: string }[] = [
  { id: "cash", label: "نقدي" },
  { id: "card", label: "بطاقة" },
  { id: "transfer", label: "تحويل بنكي" },
  { id: "check", label: "شيك" },
  { id: "insurance", label: "تأمين" },
];

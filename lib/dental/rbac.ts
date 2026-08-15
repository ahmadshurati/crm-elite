export type DentalPermission =
  | "patients.view"
  | "patients.create"
  | "patients.edit"
  | "medical.view"
  | "medical.edit"
  | "appointments.manage"
  | "visits.manage"
  | "treatments.create"
  | "treatments.complete"
  | "chart.edit"
  | "billing.view"
  | "payments.create"
  | "payments.void"
  | "prescriptions.create"
  | "reports.view"
  | "inventory.manage"
  | "messages.view"
  | "messages.send"
  | "audit.view"
  | "users.manage"
  | "settings.manage";

const ALL: DentalPermission[] = [
  "patients.view", "patients.create", "patients.edit",
  "medical.view", "medical.edit",
  "appointments.manage", "visits.manage",
  "treatments.create", "treatments.complete", "chart.edit",
  "billing.view", "payments.create", "payments.void",
  "prescriptions.create", "reports.view", "inventory.manage",
  "messages.view", "messages.send", "audit.view",
  "users.manage", "settings.manage",
];

export const DENTAL_ROLES = ["owner", "manager", "dentist", "assistant", "reception", "accountant"] as const;
export type DentalRole = (typeof DENTAL_ROLES)[number];

export const DENTAL_ROLE_LABELS: Record<DentalRole, string> = {
  owner: "المالك",
  manager: "مدير العيادة",
  dentist: "طبيب أسنان",
  assistant: "مساعد",
  reception: "استقبال",
  accountant: "محاسب",
};

export const DENTAL_PERMISSION_LABELS: Record<DentalPermission, string> = {
  "patients.view": "عرض المرضى",
  "patients.create": "إضافة مرضى",
  "patients.edit": "تعديل المرضى",
  "medical.view": "عرض التاريخ الطبي",
  "medical.edit": "تعديل التاريخ الطبي",
  "appointments.manage": "إدارة المواعيد",
  "visits.manage": "إدارة الزيارات",
  "treatments.create": "إنشاء العلاجات",
  "treatments.complete": "إنهاء العلاجات",
  "chart.edit": "تعديل مخطط الأسنان",
  "billing.view": "عرض الحسابات",
  "payments.create": "تسجيل الدفعات",
  "payments.void": "إلغاء الدفعات",
  "prescriptions.create": "إصدار الوصفات",
  "reports.view": "عرض التقارير",
  "inventory.manage": "إدارة المخزون",
  "messages.view": "عرض محادثات واتساب",
  "messages.send": "إرسال رسائل واتساب",
  "audit.view": "عرض سجل التدقيق",
  "users.manage": "إدارة المستخدمين",
  "settings.manage": "إدارة الإعدادات",
};

const ROLE_PERMISSIONS: Record<DentalRole, DentalPermission[]> = {
  owner: ALL,
  manager: ALL.filter((p) => p !== "payments.void" || true), // manager full except nothing for now
  dentist: [
    "patients.view", "patients.create", "patients.edit",
    "medical.view", "medical.edit",
    "appointments.manage", "visits.manage",
    "treatments.create", "treatments.complete", "chart.edit",
    "prescriptions.create", "billing.view",
    "messages.view", "messages.send",
  ],
  assistant: [
    "patients.view", "medical.view",
    "appointments.manage", "visits.manage", "chart.edit", "inventory.manage",
    "messages.view", "messages.send",
  ],
  reception: [
    "patients.view", "patients.create", "patients.edit",
    "appointments.manage", "billing.view", "payments.create",
    "messages.view", "messages.send",
  ],
  accountant: [
    "patients.view", "billing.view", "payments.create", "payments.void", "reports.view",
    "messages.view",
  ],
};

/** Resolve the effective dental role. `role='master'` (company admin) maps to owner. */
export function resolveDentalRole(role: string, dentalRole: string | null | undefined): DentalRole {
  const dr = String(dentalRole || "").toLowerCase();
  if ((DENTAL_ROLES as readonly string[]).includes(dr)) return dr as DentalRole;
  if (role === "master") return "owner";
  return "reception";
}

export function permissionsForRole(role: DentalRole): DentalPermission[] {
  return ROLE_PERMISSIONS[role] || [];
}

export function roleCan(role: DentalRole, permission: DentalPermission): boolean {
  return permissionsForRole(role).includes(permission);
}

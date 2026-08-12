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
  | "audit.view"
  | "users.manage"
  | "settings.manage";

const ALL: DentalPermission[] = [
  "patients.view", "patients.create", "patients.edit",
  "medical.view", "medical.edit",
  "appointments.manage", "visits.manage",
  "treatments.create", "treatments.complete", "chart.edit",
  "billing.view", "payments.create", "payments.void",
  "prescriptions.create", "reports.view", "inventory.manage", "audit.view",
  "users.manage", "settings.manage",
];

export const DENTAL_ROLES = ["owner", "manager", "dentist", "assistant", "reception", "accountant"] as const;
export type DentalRole = (typeof DENTAL_ROLES)[number];

const ROLE_PERMISSIONS: Record<DentalRole, DentalPermission[]> = {
  owner: ALL,
  manager: ALL.filter((p) => p !== "payments.void" || true), // manager full except nothing for now
  dentist: [
    "patients.view", "patients.create", "patients.edit",
    "medical.view", "medical.edit",
    "appointments.manage", "visits.manage",
    "treatments.create", "treatments.complete", "chart.edit",
    "prescriptions.create", "billing.view",
  ],
  assistant: [
    "patients.view", "medical.view",
    "appointments.manage", "visits.manage", "chart.edit", "inventory.manage",
  ],
  reception: [
    "patients.view", "patients.create", "patients.edit",
    "appointments.manage", "billing.view", "payments.create",
  ],
  accountant: [
    "patients.view", "billing.view", "payments.create", "payments.void", "reports.view",
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

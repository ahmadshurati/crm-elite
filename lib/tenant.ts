import type { CurrentUser } from "@/lib/auth";

export const PLATFORM_OWNER_ROLE = "platform_owner";
export const DEMO_COMPANY_SLUG = "demo";

export type CompanyRecord = {
  id: number;
  name: string;
  slug: string;
  type: string;
  isActive: boolean | number;
  isDemo: boolean | number;
  contactEmail: string | null;
  contactPhone: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  userCount?: number;
};

export function isPlatformOwner(user: Pick<CurrentUser, "role"> | null | undefined) {
  return user?.role === PLATFORM_OWNER_ROLE;
}

export function resolveCompanyId(user: CurrentUser): number | null {
  if (isPlatformOwner(user)) return null;
  const companyId = Number((user as CurrentUser & { companyId?: number | null }).companyId);
  return Number.isFinite(companyId) && companyId > 0 ? companyId : null;
}

export function requireCompanyId(user: CurrentUser): number {
  const companyId = resolveCompanyId(user);
  if (!companyId) {
    throw new Error("Company context required");
  }
  return companyId;
}

export function customerCompanyClause(alias = "c", companyId?: number | null) {
  if (!companyId) return { clause: "", params: [] as number[] };
  return {
    clause: ` AND ${alias}.companyId = ?`,
    params: [companyId],
  };
}

export function taskCompanyScopeClause(companyId: number) {
  return {
    clause: ` AND (c.companyId = ? OR (t.customerId IS NULL AND cb.companyId = ?))`,
    params: [companyId, companyId],
  };
}

export function messageCompanyScopeClause(companyId: number, alias = "m") {
  return {
    clause: ` AND (
      ${alias}.customerId IN (SELECT id FROM Customer WHERE companyId = ?)
      OR ${alias}.userId IN (SELECT id FROM AppUser WHERE companyId = ?)
    )`,
    params: [companyId, companyId],
  };
}

export const DEMO_COMPANY_ID = 2;

export function isDemoTenant(input: {
  companyId?: number | null;
  isDemo?: boolean | number | null;
  slug?: string | null;
}) {
  const companyId = Number(input.companyId);
  if (companyId === DEMO_COMPANY_ID) return true;
  if (Boolean(input.isDemo)) return true;
  return String(input.slug || "").trim().toLowerCase() === DEMO_COMPANY_SLUG;
}

export function slugifyCompanyName(name: string) {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^\w\u0600-\u06FF]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "company";
}

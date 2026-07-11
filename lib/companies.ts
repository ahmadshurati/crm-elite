import { execute, query, queryOne } from "@/lib/db";
import type { CompanyRecord } from "@/lib/tenant";
import { slugifyCompanyName } from "@/lib/tenant";
import { DEFAULT_SETTINGS } from "@/lib/crm/settings-defaults";

function mapCompany(row: Record<string, unknown>): CompanyRecord {
  return {
    id: Number(row.id),
    name: String(row.name),
    slug: String(row.slug),
    isActive: Boolean(row.isActive),
    isDemo: Boolean(row.isDemo),
    contactEmail: row.contactEmail ? String(row.contactEmail) : null,
    contactPhone: row.contactPhone ? String(row.contactPhone) : null,
    notes: row.notes ? String(row.notes) : null,
    createdAt: new Date(row.createdAt as string | Date).toISOString(),
    updatedAt: new Date(row.updatedAt as string | Date).toISOString(),
    userCount: row.userCount != null ? Number(row.userCount) : undefined,
  };
}

export async function listCompanies() {
  const rows = await query<Record<string, unknown>>(
    `SELECT c.*, (
       SELECT COUNT(*) FROM AppUser u WHERE u.companyId = c.id
     ) AS userCount
     FROM Company c
     ORDER BY c.isDemo ASC, c.id ASC`
  );
  return rows.map(mapCompany);
}

export async function getCompanyById(id: number) {
  const row = await queryOne<Record<string, unknown>>(
    `SELECT c.*, (
       SELECT COUNT(*) FROM AppUser u WHERE u.companyId = c.id
     ) AS userCount
     FROM Company c WHERE c.id = ? LIMIT 1`,
    [id]
  );
  return row ? mapCompany(row) : null;
}

export async function getCompanyBySlug(slug: string) {
  const row = await queryOne<Record<string, unknown>>("SELECT * FROM Company WHERE slug = ? LIMIT 1", [slug]);
  return row ? mapCompany(row) : null;
}

async function ensureUniqueSlug(base: string) {
  let slug = base;
  let suffix = 1;
  while (await queryOne("SELECT id FROM Company WHERE slug = ? LIMIT 1", [slug])) {
    slug = `${base}-${suffix}`;
    suffix += 1;
  }
  return slug;
}

export async function createCompany(input: {
  name: string;
  slug?: string;
  contactEmail?: string;
  contactPhone?: string;
  notes?: string;
  isDemo?: boolean;
}) {
  const name = String(input.name || "").trim();
  if (!name) throw new Error("Company name is required");

  const baseSlug = slugifyCompanyName(input.slug || name);
  const slug = await ensureUniqueSlug(baseSlug);

  const result = await execute(
    `INSERT INTO Company (name, slug, isActive, isDemo, contactEmail, contactPhone, notes, createdAt, updatedAt)
     VALUES (?, ?, 1, ?, ?, ?, ?, NOW(), NOW())`,
    [
      name,
      slug,
      input.isDemo ? 1 : 0,
      input.contactEmail ? String(input.contactEmail) : null,
      input.contactPhone ? String(input.contactPhone) : null,
      input.notes ? String(input.notes) : null,
    ]
  );

  const companyId = result.insertId;

  await execute(
    `INSERT INTO SystemSetting (companyId, companyName, currency, language, timezone, dateFormat, defaultTaxRate, updatedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, NOW())`,
    [
      companyId,
      name,
      DEFAULT_SETTINGS.currency,
      DEFAULT_SETTINGS.language,
      DEFAULT_SETTINGS.timezone,
      DEFAULT_SETTINGS.dateFormat,
      DEFAULT_SETTINGS.defaultTaxRate,
    ]
  );

  const company = await getCompanyById(companyId);
  if (!company) throw new Error("Failed to create company");
  return company;
}

export async function updateCompany(
  id: number,
  input: Partial<Pick<CompanyRecord, "name" | "contactEmail" | "contactPhone" | "notes" | "isActive">>
) {
  const fields: string[] = [];
  const values: unknown[] = [];

  if (input.name != null) {
    fields.push("name = ?");
    values.push(String(input.name));
  }
  if (input.contactEmail !== undefined) {
    fields.push("contactEmail = ?");
    values.push(input.contactEmail ? String(input.contactEmail) : null);
  }
  if (input.contactPhone !== undefined) {
    fields.push("contactPhone = ?");
    values.push(input.contactPhone ? String(input.contactPhone) : null);
  }
  if (input.notes !== undefined) {
    fields.push("notes = ?");
    values.push(input.notes ? String(input.notes) : null);
  }
  if (input.isActive != null) {
    fields.push("isActive = ?");
    values.push(input.isActive ? 1 : 0);
  }

  if (!fields.length) return getCompanyById(id);

  fields.push("updatedAt = NOW()");
  values.push(id);
  await execute(`UPDATE Company SET ${fields.join(", ")} WHERE id = ?`, values);

  if (input.name != null) {
    await execute("UPDATE SystemSetting SET companyName = ? WHERE companyId = ?", [String(input.name), id]);
  }

  return getCompanyById(id);
}

export async function listAllUsersWithCompany() {
  return query<Record<string, unknown>>(
    `SELECT u.id, u.username, u.role, u.isActive, u.companyId,
            u.viewSubscribers, u.createSubscribers, u.editSubscribers, u.deleteSubscribers,
            u.viewAccidents, u.createAccidents, u.editAccidents, u.deleteAccidents,
            u.viewAccounting, u.editPayments, u.viewUsers, u.createUsers, u.editUsers,
            u.deleteUsers, u.viewActivityLog, u.createdAt, u.updatedAt,
            c.name AS companyName, c.slug AS companySlug, c.isDemo AS companyIsDemo
     FROM AppUser u
     LEFT JOIN Company c ON c.id = u.companyId
     ORDER BY u.id ASC`
  );
}

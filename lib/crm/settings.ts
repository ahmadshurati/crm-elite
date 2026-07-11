import { execute, queryOne } from "@/lib/db";
import { DEFAULT_SETTINGS } from "@/lib/crm/settings-defaults";

export type SystemSettings = {
  id: number;
  companyId: number | null;
  companyName: string;
  logoUrl: string | null;
  address: string | null;
  taxNumber: string | null;
  currency: string;
  language: string;
  timezone: string;
  dateFormat: string;
  defaultTaxRate: number;
  updatedAt: string;
};

function mapRow(row: Record<string, unknown>): SystemSettings {
  return {
    id: Number(row.id),
    companyId: row.companyId != null ? Number(row.companyId) : null,
    companyName: String(row.companyName || DEFAULT_SETTINGS.companyName),
    logoUrl: row.logoUrl ? String(row.logoUrl) : null,
    address: row.address ? String(row.address) : null,
    taxNumber: row.taxNumber ? String(row.taxNumber) : null,
    currency: String(row.currency || DEFAULT_SETTINGS.currency),
    language: String(row.language || DEFAULT_SETTINGS.language),
    timezone: String(row.timezone || DEFAULT_SETTINGS.timezone),
    dateFormat: String(row.dateFormat || DEFAULT_SETTINGS.dateFormat),
    defaultTaxRate: Number(row.defaultTaxRate || 0),
    updatedAt: new Date(row.updatedAt as string | Date).toISOString(),
  };
}

export async function ensureSystemSettings(companyId: number) {
  const existing = await queryOne<Record<string, unknown>>(
    "SELECT id FROM SystemSetting WHERE companyId = ? LIMIT 1",
    [companyId]
  );
  if (existing) return;

  const company = await queryOne<{ name: string }>("SELECT name FROM Company WHERE id = ? LIMIT 1", [companyId]);

  await execute(
    `INSERT INTO SystemSetting (companyId, companyName, logoUrl, address, taxNumber, currency, language, timezone, dateFormat, defaultTaxRate, updatedAt)
     VALUES (?, ?, NULL, NULL, NULL, ?, ?, ?, ?, ?, NOW())`,
    [
      companyId,
      company?.name || DEFAULT_SETTINGS.companyName,
      DEFAULT_SETTINGS.currency,
      DEFAULT_SETTINGS.language,
      DEFAULT_SETTINGS.timezone,
      DEFAULT_SETTINGS.dateFormat,
      DEFAULT_SETTINGS.defaultTaxRate,
    ]
  );
}

export async function getSystemSettings(companyId: number): Promise<SystemSettings> {
  await ensureSystemSettings(companyId);
  const row = await queryOne<Record<string, unknown>>(
    "SELECT * FROM SystemSetting WHERE companyId = ? LIMIT 1",
    [companyId]
  );
  return mapRow(row || { id: 0, companyId, ...DEFAULT_SETTINGS, updatedAt: new Date() });
}

export async function updateSystemSettings(companyId: number, input: Partial<SystemSettings>) {
  await ensureSystemSettings(companyId);

  const fields: string[] = [];
  const values: unknown[] = [];

  if (input.companyName != null) {
    fields.push("companyName = ?");
    values.push(String(input.companyName));
  }
  if (input.logoUrl !== undefined) {
    fields.push("logoUrl = ?");
    values.push(input.logoUrl ? String(input.logoUrl) : null);
  }
  if (input.address !== undefined) {
    fields.push("address = ?");
    values.push(input.address ? String(input.address) : null);
  }
  if (input.taxNumber !== undefined) {
    fields.push("taxNumber = ?");
    values.push(input.taxNumber ? String(input.taxNumber) : null);
  }
  if (input.currency != null) {
    fields.push("currency = ?");
    values.push(String(input.currency));
  }
  if (input.language != null) {
    fields.push("language = ?");
    values.push(String(input.language));
  }
  if (input.timezone != null) {
    fields.push("timezone = ?");
    values.push(String(input.timezone));
  }
  if (input.dateFormat != null) {
    fields.push("dateFormat = ?");
    values.push(String(input.dateFormat));
  }
  if (input.defaultTaxRate != null) {
    fields.push("defaultTaxRate = ?");
    values.push(Number(input.defaultTaxRate || 0));
  }

  if (!fields.length) return getSystemSettings(companyId);

  fields.push("updatedAt = NOW()");
  values.push(companyId);
  await execute(`UPDATE SystemSetting SET ${fields.join(", ")} WHERE companyId = ?`, values);
  return getSystemSettings(companyId);
}

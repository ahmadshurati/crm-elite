// WhatsApp connection config resolver (server-only). Secrets never leave this layer.
//
// Multi-tenant model: config is stored PER COMPANY in `DentalWhatsAppConfig`. Environment
// variables act as a shared default/fallback for a single-clinic deployment. The webhook routes
// each event to the company that owns the incoming `phone_number_id`, which guarantees a message
// meant for Clinic A can never land in Clinic B.

import { query, queryOne, execute } from "@/lib/db";

export type WaConfig = {
  companyId: number;
  phoneNumberId: string;
  businessAccountId: string | null;
  verifyToken: string | null;
  accessToken: string;
  appSecret: string | null;
  defaultCountry: string;
};

type ConfigRow = {
  companyId: number;
  phoneNumberId: string | null;
  businessAccountId: string | null;
  verifyToken: string | null;
  accessToken: string | null;
  appSecret: string | null;
  defaultCountry: string | null;
  active: number | boolean;
};

function env(name: string): string | null {
  const v = process.env[name];
  const t = typeof v === "string" ? v.trim() : "";
  return t ? t : null;
}

/** Business rule (config-driven): the WhatsApp customer-service free-text window, in hours. */
export function serviceWindowHours(): number {
  const raw = Number(env("WHATSAPP_SERVICE_WINDOW_HOURS") || "24");
  return Number.isFinite(raw) && raw > 0 ? raw : 24;
}

/** Is free-form (non-template) messaging currently allowed for this conversation? */
export function isWithinServiceWindow(lastInboundAt: Date | string | null | undefined): boolean {
  if (!lastInboundAt) return false;
  const t = new Date(lastInboundAt).getTime();
  if (!Number.isFinite(t)) return false;
  return Date.now() - t < serviceWindowHours() * 60 * 60 * 1000;
}

/** Default country calling code used by the phone normalizer when a number looks local. */
export function defaultCountryCode(): string {
  return env("WHATSAPP_DEFAULT_COUNTRY") || "972";
}

/**
 * Resolve the effective config for a company (DB row first, env as fallback per-field).
 * Returns null when neither a phone number id nor an access token can be found.
 */
export async function getConfig(companyId: number): Promise<WaConfig | null> {
  const row = await queryOne<ConfigRow>(
    "SELECT * FROM DentalWhatsAppConfig WHERE companyId = ? LIMIT 1",
    [companyId]
  );
  if (row && !(row.active === true || row.active === 1)) return null;

  const phoneNumberId = (row?.phoneNumberId || env("WHATSAPP_PHONE_NUMBER_ID")) ?? null;
  const accessToken = (row?.accessToken || env("WHATSAPP_ACCESS_TOKEN")) ?? null;
  if (!phoneNumberId || !accessToken) return null;

  return {
    companyId,
    phoneNumberId,
    businessAccountId: row?.businessAccountId || env("WHATSAPP_BUSINESS_ACCOUNT_ID"),
    verifyToken: row?.verifyToken || env("WHATSAPP_VERIFY_TOKEN"),
    accessToken,
    appSecret: row?.appSecret || env("WHATSAPP_APP_SECRET"),
    defaultCountry: row?.defaultCountry || defaultCountryCode(),
  };
}

/** Non-secret status snapshot for the Settings UI. Never includes tokens/secrets. */
export type WaConfigStatus = {
  configured: boolean;
  source: "db" | "env" | "none";
  phoneNumberId: string | null;
  businessAccountId: string | null;
  hasAccessToken: boolean;
  hasAppSecret: boolean;
  hasVerifyToken: boolean;
  defaultCountry: string;
  active: boolean;
  webhookPath: string;
};

export async function getConfigStatus(companyId: number): Promise<WaConfigStatus> {
  const row = await queryOne<ConfigRow>(
    "SELECT * FROM DentalWhatsAppConfig WHERE companyId = ? LIMIT 1",
    [companyId]
  );
  const phoneNumberId = (row?.phoneNumberId || env("WHATSAPP_PHONE_NUMBER_ID")) ?? null;
  const accessToken = (row?.accessToken || env("WHATSAPP_ACCESS_TOKEN")) ?? null;
  const appSecret = (row?.appSecret || env("WHATSAPP_APP_SECRET")) ?? null;
  const verifyToken = (row?.verifyToken || env("WHATSAPP_VERIFY_TOKEN")) ?? null;
  const active = row ? row.active === true || row.active === 1 : true;
  const source: "db" | "env" | "none" = row?.phoneNumberId
    ? "db"
    : env("WHATSAPP_PHONE_NUMBER_ID")
      ? "env"
      : "none";
  return {
    configured: !!(phoneNumberId && accessToken && active),
    source,
    phoneNumberId,
    businessAccountId: row?.businessAccountId || env("WHATSAPP_BUSINESS_ACCOUNT_ID"),
    hasAccessToken: !!accessToken,
    hasAppSecret: !!appSecret,
    hasVerifyToken: !!verifyToken,
    defaultCountry: row?.defaultCountry || defaultCountryCode(),
    active,
    webhookPath: "/api/dental/whatsapp/webhook",
  };
}

/** Webhook routing: which company owns this Meta phone_number_id? (isolation-critical) */
export async function getCompanyIdByPhoneNumberId(phoneNumberId: string): Promise<number | null> {
  const pid = String(phoneNumberId || "").trim();
  if (!pid) return null;
  const row = await queryOne<{ companyId: number }>(
    "SELECT companyId FROM DentalWhatsAppConfig WHERE phoneNumberId = ? AND active = true LIMIT 1",
    [pid]
  );
  if (row) return row.companyId;

  // Env-only fallback (single-clinic deployments with no saved row): only when a lone dental
  // company exists, so we can never mis-route between two clinics.
  if (env("WHATSAPP_PHONE_NUMBER_ID") === pid) {
    const dentals = await query<{ id: number }>(
      "SELECT id FROM Company WHERE type = 'dental' LIMIT 2"
    );
    if (dentals.length === 1) return dentals[0].id;
  }
  return null;
}

export type SaveConfigInput = {
  phoneNumberId?: string | null;
  businessAccountId?: string | null;
  verifyToken?: string | null;
  accessToken?: string | null; // only overwritten when a non-empty value is provided
  appSecret?: string | null; // only overwritten when a non-empty value is provided
  defaultCountry?: string | null;
  active?: boolean;
};

/** Upsert a company's WhatsApp config. Secrets are preserved when left blank. */
export async function saveConfig(companyId: number, userId: number, input: SaveConfigInput): Promise<void> {
  const country = (input.defaultCountry || "").replace(/\D/g, "") || defaultCountryCode();
  await execute(
    `INSERT INTO DentalWhatsAppConfig
       (companyId, phoneNumberId, businessAccountId, verifyToken, accessToken, appSecret, defaultCountry, active, createdByUserId, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, NULLIF(?, ''), NULLIF(?, ''), ?, ?, ?, NOW(3), NOW(3))
     ON DUPLICATE KEY UPDATE
       phoneNumberId = VALUES(phoneNumberId),
       businessAccountId = VALUES(businessAccountId),
       verifyToken = VALUES(verifyToken),
       accessToken = COALESCE(VALUES(accessToken), accessToken),
       appSecret = COALESCE(VALUES(appSecret), appSecret),
       defaultCountry = VALUES(defaultCountry),
       active = VALUES(active),
       updatedAt = NOW(3)`,
    [
      companyId,
      (input.phoneNumberId || "").trim() || null,
      (input.businessAccountId || "").trim() || null,
      (input.verifyToken || "").trim() || null,
      (input.accessToken || "").trim(),
      (input.appSecret || "").trim(),
      country,
      input.active === false ? 0 : 1,
      userId,
    ]
  );
}

export async function disableConfig(companyId: number): Promise<void> {
  await execute("UPDATE DentalWhatsAppConfig SET active = false, updatedAt = NOW(3) WHERE companyId = ?", [companyId]);
}

/** Verify-challenge (GET) token check: matches any active DB config OR the env verify token. */
export async function isValidVerifyToken(token: string): Promise<boolean> {
  const t = String(token || "");
  if (!t) return false;
  if (env("WHATSAPP_VERIFY_TOKEN") && t === env("WHATSAPP_VERIFY_TOKEN")) return true;
  const row = await queryOne<{ id: number }>(
    "SELECT id FROM DentalWhatsAppConfig WHERE verifyToken = ? AND active = true LIMIT 1",
    [t]
  );
  return !!row;
}

import { createHash, randomBytes } from "crypto";
import { execute, query, queryOne } from "@/lib/db";

export const API_KEY_PREFIX = "elite_";
export const DEFAULT_API_SCOPES = ["read:customers", "read:deals", "read:tasks"] as const;

export type ApiKeyRecord = {
  id: number;
  name: string;
  keyPrefix: string;
  scopes: string[];
  isActive: boolean;
  lastUsedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
};

function hashApiKey(rawKey: string) {
  return createHash("sha256").update(rawKey).digest("hex");
}

function mapRow(row: Record<string, unknown>): ApiKeyRecord {
  let scopes: string[] = [];
  try {
    scopes = JSON.parse(String(row.scopes || "[]"));
  } catch {
    scopes = [];
  }

  return {
    id: Number(row.id),
    name: String(row.name || ""),
    keyPrefix: String(row.keyPrefix || ""),
    scopes,
    isActive: Boolean(row.isActive),
    lastUsedAt: row.lastUsedAt ? new Date(row.lastUsedAt as string | Date).toISOString() : null,
    expiresAt: row.expiresAt ? new Date(row.expiresAt as string | Date).toISOString() : null,
    createdAt: new Date(row.createdAt as string | Date).toISOString(),
  };
}

export function generateApiKeyValue() {
  return `${API_KEY_PREFIX}${randomBytes(24).toString("hex")}`;
}

export async function listApiKeys() {
  const rows = await query<Record<string, unknown>>(
    "SELECT id, name, keyPrefix, scopes, isActive, lastUsedAt, expiresAt, createdAt FROM ApiKey ORDER BY createdAt DESC"
  );
  return rows.map(mapRow);
}

export async function createApiKey(input: {
  name: string;
  scopes?: string[];
  createdByUserId?: number;
  expiresAt?: Date | null;
}) {
  const rawKey = generateApiKeyValue();
  const keyHash = hashApiKey(rawKey);
  const keyPrefix = rawKey.slice(0, 12);
  const scopes = JSON.stringify(input.scopes?.length ? input.scopes : [...DEFAULT_API_SCOPES]);

  const result = await execute(
    `INSERT INTO ApiKey (name, keyPrefix, keyHash, scopes, createdByUserId, isActive, expiresAt, createdAt)
     VALUES (?, ?, ?, ?, ?, true, ?, NOW())`,
    [input.name, keyPrefix, keyHash, scopes, input.createdByUserId ?? null, input.expiresAt ?? null]
  );

  const row = await queryOne<Record<string, unknown>>("SELECT * FROM ApiKey WHERE id = ? LIMIT 1", [
    result.insertId,
  ]);

  return {
    key: rawKey,
    record: mapRow(row || {}),
  };
}

export async function revokeApiKey(id: number) {
  await execute("UPDATE ApiKey SET isActive = false WHERE id = ?", [id]);
}

export async function validateApiKey(rawKey: string | null | undefined) {
  const key = String(rawKey || "").trim();
  if (!key.startsWith(API_KEY_PREFIX)) return null;

  const keyHash = hashApiKey(key);
  const row = await queryOne<Record<string, unknown>>(
    "SELECT * FROM ApiKey WHERE keyHash = ? AND isActive = true LIMIT 1",
    [keyHash]
  );

  if (!row) return null;

  if (row.expiresAt) {
    const expiresAt = new Date(row.expiresAt as string | Date);
    if (expiresAt.getTime() < Date.now()) return null;
  }

  await execute("UPDATE ApiKey SET lastUsedAt = NOW() WHERE id = ?", [row.id]);

  return mapRow(row);
}

export function extractApiKeyFromRequest(req: Request) {
  const header = req.headers.get("x-api-key") || req.headers.get("authorization");
  if (!header) return null;
  if (header.toLowerCase().startsWith("bearer ")) {
    return header.slice(7).trim();
  }
  return header.trim();
}

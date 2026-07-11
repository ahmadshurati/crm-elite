import { execute, query } from "@/lib/db";
import type { CurrentUser } from "@/lib/auth";

export type FieldChangeRecord = {
  id: number;
  userId: number | null;
  username: string;
  module: string;
  entityType: string;
  entityId: number;
  fieldName: string;
  oldValue: string | null;
  newValue: string | null;
  createdAt: string;
};

function normalizeValue(value: unknown) {
  if (value == null || value === "") return null;
  return String(value);
}

export async function logFieldChanges(input: {
  user: Pick<CurrentUser, "id" | "username">;
  module: string;
  entityType: string;
  entityId: number;
  before: Record<string, unknown>;
  after: Record<string, unknown>;
  fields: string[];
}) {
  const changes = input.fields.filter((field) => {
    return normalizeValue(input.before[field]) !== normalizeValue(input.after[field]);
  });

  if (!changes.length) return;

  for (const fieldName of changes) {
    await execute(
      `INSERT INTO FieldChangeLog (userId, username, module, entityType, entityId, fieldName, oldValue, newValue, createdAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [
        input.user.id,
        input.user.username,
        input.module,
        input.entityType,
        input.entityId,
        fieldName,
        normalizeValue(input.before[fieldName]),
        normalizeValue(input.after[fieldName]),
      ]
    );
  }
}

export async function listFieldChanges(options: {
  limit?: number;
  entityType?: string;
  entityId?: number;
  module?: string;
}) {
  const limit = Math.min(200, Math.max(1, options.limit || 50));
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (options.entityType) {
    conditions.push("entityType = ?");
    params.push(options.entityType);
  }
  if (options.entityId != null) {
    conditions.push("entityId = ?");
    params.push(options.entityId);
  }
  if (options.module) {
    conditions.push("module = ?");
    params.push(options.module);
  }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

  const rows = await query<Record<string, unknown>>(
    `SELECT * FROM FieldChangeLog ${where} ORDER BY createdAt DESC LIMIT ?`,
    [...params, limit]
  );

  return rows.map(
    (row): FieldChangeRecord => ({
      id: Number(row.id),
      userId: row.userId != null ? Number(row.userId) : null,
      username: String(row.username || ""),
      module: String(row.module || ""),
      entityType: String(row.entityType || ""),
      entityId: Number(row.entityId),
      fieldName: String(row.fieldName || ""),
      oldValue: row.oldValue != null ? String(row.oldValue) : null,
      newValue: row.newValue != null ? String(row.newValue) : null,
      createdAt: new Date(row.createdAt as string | Date).toISOString(),
    })
  );
}

import { execute, query, queryOne } from "@/lib/db";
import {
  builtInRoleTemplates,
  PERMISSION_FIELDS,
  permissionSqlValues,
  readPermissionsFromBody,
  type PermissionMap,
} from "@/lib/crm/user-permissions";

export type RoleTemplateRecord = {
  id: number;
  name: string;
  description: string | null;
  isSystem: boolean;
  permissions: PermissionMap;
  createdAt: string;
  updatedAt: string;
};

function mapRow(row: Record<string, unknown>): RoleTemplateRecord {
  const permissions = Object.fromEntries(
    PERMISSION_FIELDS.map((field) => [field, Number(row[field]) === 1])
  ) as PermissionMap;

  return {
    id: Number(row.id),
    name: String(row.name || ""),
    description: row.description ? String(row.description) : null,
    isSystem: Boolean(row.isSystem),
    permissions,
    createdAt: new Date(row.createdAt as string | Date).toISOString(),
    updatedAt: new Date(row.updatedAt as string | Date).toISOString(),
  };
}

export async function ensureBuiltInRoleTemplates() {
  for (const template of builtInRoleTemplates) {
    const existing = await queryOne<{ id: number }>(
      "SELECT id FROM RoleTemplate WHERE name = ? LIMIT 1",
      [template.name]
    );

    if (existing) continue;

    await execute(
      `INSERT INTO RoleTemplate (
        name, description, isSystem,
        viewSubscribers, createSubscribers, editSubscribers, deleteSubscribers,
        viewAccidents, createAccidents, editAccidents, deleteAccidents,
        viewAccounting, editPayments,
        viewUsers, createUsers, editUsers, deleteUsers,
        viewActivityLog, createdAt, updatedAt
      ) VALUES (?, ?, true, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [
        template.name,
        template.description,
        ...permissionSqlValues(template.permissions),
      ]
    );
  }
}

export async function listRoleTemplates() {
  await ensureBuiltInRoleTemplates();
  const rows = await query<Record<string, unknown>>("SELECT * FROM RoleTemplate ORDER BY isSystem DESC, name ASC");
  return rows.map(mapRow);
}

export async function getRoleTemplateById(id: number) {
  const row = await queryOne<Record<string, unknown>>("SELECT * FROM RoleTemplate WHERE id = ? LIMIT 1", [id]);
  return row ? mapRow(row) : null;
}

export async function createRoleTemplate(input: { name: string; description?: string; permissions: PermissionMap }) {
  const result = await execute(
    `INSERT INTO RoleTemplate (
      name, description, isSystem,
      viewSubscribers, createSubscribers, editSubscribers, deleteSubscribers,
      viewAccidents, createAccidents, editAccidents, deleteAccidents,
      viewAccounting, editPayments,
      viewUsers, createUsers, editUsers, deleteUsers,
      viewActivityLog, createdAt, updatedAt
    ) VALUES (?, ?, false, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
    [
      input.name,
      input.description || null,
      ...permissionSqlValues(input.permissions),
    ]
  );

  return getRoleTemplateById(result.insertId);
}

export async function updateRoleTemplate(
  id: number,
  input: { name?: string; description?: string; permissions?: PermissionMap }
) {
  const existing = await getRoleTemplateById(id);
  if (!existing) return null;

  const fields: string[] = [];
  const values: unknown[] = [];

  if (input.name != null) {
    fields.push("name = ?");
    values.push(String(input.name));
  }
  if (input.description !== undefined) {
    fields.push("description = ?");
    values.push(input.description ? String(input.description) : null);
  }
  if (input.permissions) {
    PERMISSION_FIELDS.forEach((field) => {
      fields.push(`${field} = ?`);
      values.push(input.permissions![field] ? 1 : 0);
    });
  }

  if (!fields.length) return existing;

  fields.push("updatedAt = NOW()");
  values.push(id);
  await execute(`UPDATE RoleTemplate SET ${fields.join(", ")} WHERE id = ?`, values);
  return getRoleTemplateById(id);
}

export async function deleteRoleTemplate(id: number) {
  const existing = await getRoleTemplateById(id);
  if (!existing || existing.isSystem) return false;
  await execute("DELETE FROM RoleTemplate WHERE id = ? AND isSystem = false", [id]);
  return true;
}

export async function applyRoleTemplateToUser(userId: number, templateId: number) {
  const template = await getRoleTemplateById(templateId);
  if (!template) return false;

  const sets = PERMISSION_FIELDS.map((field) => `${field} = ?`).join(", ");
  await execute(
    `UPDATE AppUser SET roleTemplateId = ?, ${sets}, updatedAt = NOW() WHERE id = ?`,
    [templateId, ...permissionSqlValues(template.permissions), userId]
  );
  return true;
}

export function permissionsFromBody(body: Record<string, unknown>) {
  return readPermissionsFromBody(body);
}

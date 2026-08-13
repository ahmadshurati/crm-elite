import { execute, query, queryOne } from "@/lib/db";
import { hashPassword } from "@/lib/password";
import { safeIso } from "@/lib/dental/format";
import { writeDentalAudit } from "@/lib/dental/services/audit";
import { DENTAL_ROLES, resolveDentalRole, type DentalRole } from "@/lib/dental/rbac";

type Ctx = { companyId: number; userId: number; username: string };

export async function listStaff(companyId: number) {
  const rows = await query<Record<string, unknown>>(
    "SELECT id, username, role, dentalRole, isActive, createdAt FROM AppUser WHERE companyId = ? ORDER BY id ASC",
    [companyId]
  );
  return rows.map((u) => ({
    id: Number(u.id),
    username: String(u.username),
    role: String(u.role),
    dentalRole: u.dentalRole ? String(u.dentalRole) : null,
    effectiveRole: resolveDentalRole(String(u.role), u.dentalRole ? String(u.dentalRole) : null),
    isActive: Boolean(u.isActive),
  }));
}

export async function setStaffRole(ctx: Ctx, userId: number, dentalRole: string) {
  if (!(DENTAL_ROLES as readonly string[]).includes(dentalRole)) throw new Error("دور غير صحيح");
  const user = await queryOne<{ id: number; dentalRole: string | null }>("SELECT id, dentalRole FROM AppUser WHERE id = ? AND companyId = ? LIMIT 1", [userId, ctx.companyId]);
  if (!user) throw new Error("المستخدم غير موجود");
  await execute("UPDATE AppUser SET dentalRole = ?, updatedAt = NOW() WHERE id = ? AND companyId = ?", [dentalRole, userId, ctx.companyId]);
  await writeDentalAudit({ companyId: ctx.companyId, userId: ctx.userId, username: ctx.username, action: "role_change", entityType: "user", entityId: userId, oldValues: { dentalRole: user.dentalRole }, newValues: { dentalRole } });
}

export async function setStaffActive(ctx: Ctx, userId: number, isActive: boolean) {
  if (userId === ctx.userId) throw new Error("لا يمكنك تعطيل حسابك");
  const user = await queryOne<{ id: number }>("SELECT id FROM AppUser WHERE id = ? AND companyId = ? LIMIT 1", [userId, ctx.companyId]);
  if (!user) throw new Error("المستخدم غير موجود");
  await execute("UPDATE AppUser SET isActive = ?, updatedAt = NOW() WHERE id = ? AND companyId = ?", [isActive ? 1 : 0, userId, ctx.companyId]);
  await writeDentalAudit({ companyId: ctx.companyId, userId: ctx.userId, username: ctx.username, action: "update", entityType: "user", entityId: userId, newValues: { isActive } });
}

export async function createStaff(ctx: Ctx, input: { username: string; password: string; dentalRole: string }) {
  const username = String(input.username || "").trim().toLowerCase();
  const password = String(input.password || "");
  const dentalRole = String(input.dentalRole || "");
  if (!username || username.length < 3) throw new Error("اسم المستخدم قصير جداً");
  if (password.length < 6) throw new Error("كلمة المرور يجب أن تكون 6 أحرف على الأقل");
  if (!(DENTAL_ROLES as readonly string[]).includes(dentalRole)) throw new Error("دور غير صحيح");
  const dup = await queryOne<{ id: number }>("SELECT id FROM AppUser WHERE username = ? LIMIT 1", [username]);
  if (dup) throw new Error("اسم المستخدم مستخدم مسبقاً");
  const hashed = await hashPassword(password);
  const result = await execute(
    "INSERT INTO AppUser (username, password, role, dentalRole, companyId, isActive, createdAt, updatedAt) VALUES (?, ?, 'user', ?, ?, 1, NOW(), NOW())",
    [username, hashed, dentalRole, ctx.companyId]
  );
  await writeDentalAudit({ companyId: ctx.companyId, userId: ctx.userId, username: ctx.username, action: "create", entityType: "user", entityId: Number(result.insertId), newValues: { username, dentalRole } });
  return Number(result.insertId);
}

export async function listAudit(companyId: number, opts: { entityType?: string; limit?: number } = {}) {
  const params: (string | number)[] = [companyId];
  let sql = "SELECT id, username, action, entityType, entityId, oldValues, newValues, createdAt FROM DentalAuditLog WHERE companyId = ?";
  if (opts.entityType) { sql += " AND entityType = ?"; params.push(opts.entityType); }
  sql += " ORDER BY createdAt DESC LIMIT ?";
  params.push(Math.min(opts.limit || 200, 500));
  const rows = await query<Record<string, unknown>>(sql, params);
  return rows.map((r) => ({
    id: Number(r.id),
    username: String(r.username || ""),
    action: String(r.action),
    entityType: String(r.entityType),
    entityId: r.entityId ? String(r.entityId) : null,
    createdAt: safeIso(r.createdAt),
    oldValues: r.oldValues ? String(r.oldValues) : null,
    newValues: r.newValues ? String(r.newValues) : null,
  }));
}

export type StaffRole = DentalRole;

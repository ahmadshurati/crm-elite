import { execute, query, queryOne } from "@/lib/db";
import { hashPassword } from "@/lib/password";

export type ShopWithCounts = {
  code: string;
  name: string;
  ownerName: string | null;
  contactPhone: string | null;
  email: string | null;
  username: string | null;
  commissionAmount: number;
  isActive: boolean;
  createdAt: string;
  scans: number;
  leads: number;
  subscribed: number;
};

export type ShopAccount = {
  id: number;
  code: string;
  name: string;
  username: string | null;
  passwordHash: string | null;
  isActive: boolean | number;
};

function slugify(name: string) {
  return (
    String(name || "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9\u0600-\u06FF]+/g, "-")
      .replace(/[\u0600-\u06FF]/g, "")
      .replace(/^-+|-+$/g, "")
      .slice(0, 30) || "shop"
  );
}

function randomSuffix() {
  return Math.random().toString(36).slice(2, 6);
}

export async function generateUniqueCode(name: string) {
  const base = slugify(name);
  for (let attempt = 0; attempt < 8; attempt++) {
    const candidate = attempt === 0 ? base : `${base}-${randomSuffix()}`;
    const existing = await queryOne<{ id: number }>(
      "SELECT id FROM ReferralShop WHERE code = ? LIMIT 1",
      [candidate]
    );
    if (!existing) return candidate;
  }
  return `shop-${Date.now().toString(36)}`;
}

export async function getShopAccountByUsername(username: string) {
  return queryOne<ShopAccount>(
    "SELECT id, code, name, username, passwordHash, isActive FROM ReferralShop WHERE username = ? LIMIT 1",
    [username]
  );
}

export async function createShop(input: {
  name: string;
  ownerName?: string | null;
  contactPhone?: string | null;
  email?: string | null;
  username: string;
  password: string;
  commissionAmount?: number;
}) {
  const code = await generateUniqueCode(input.name);
  const passwordHash = await hashPassword(input.password);

  const result = await execute(
    `INSERT INTO ReferralShop
       (code, name, ownerName, contactPhone, email, username, passwordHash, commissionAmount, isActive, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, NOW(), NOW())`,
    [
      code,
      input.name.trim().slice(0, 190),
      input.ownerName ? input.ownerName.trim().slice(0, 190) : null,
      input.contactPhone ? input.contactPhone.trim().slice(0, 40) : null,
      input.email ? input.email.trim().slice(0, 190) : null,
      input.username.trim().toLowerCase().slice(0, 60),
      passwordHash,
      Number(input.commissionAmount) || 0,
    ]
  );

  return { id: Number(result.insertId), code };
}

export async function listShopsWithCounts(): Promise<ShopWithCounts[]> {
  const rows = await query<Record<string, unknown>>(
    `SELECT s.code, s.name, s.ownerName, s.contactPhone, s.email, s.username,
            s.commissionAmount, s.isActive, s.createdAt,
            (SELECT COUNT(*) FROM ScanEvent e WHERE e.shopCode = s.code) AS scans,
            (SELECT COUNT(*) FROM \`Lead\` l WHERE l.shopCode = s.code) AS leads,
            (SELECT COUNT(*) FROM \`Lead\` l WHERE l.shopCode = s.code AND l.status = 'subscribed') AS subscribed
     FROM ReferralShop s
     ORDER BY s.createdAt DESC`
  );

  return rows.map((row) => ({
    code: String(row.code),
    name: String(row.name),
    ownerName: row.ownerName ? String(row.ownerName) : null,
    contactPhone: row.contactPhone ? String(row.contactPhone) : null,
    email: row.email ? String(row.email) : null,
    username: row.username ? String(row.username) : null,
    commissionAmount: Number(row.commissionAmount || 0),
    isActive: Boolean(row.isActive),
    createdAt: new Date(row.createdAt as string | Date).toISOString(),
    scans: Number(row.scans || 0),
    leads: Number(row.leads || 0),
    subscribed: Number(row.subscribed || 0),
  }));
}

export async function usernameExists(username: string) {
  const row = await queryOne<{ id: number }>(
    "SELECT id FROM ReferralShop WHERE username = ? LIMIT 1",
    [username.trim().toLowerCase()]
  );
  return Boolean(row);
}

export type UpdateShopResult = { ok: true } | { ok: false; error: string; status: number };

/**
 * Update an existing shop's editable fields. The `code` (and thus the QR / referral link and all
 * historical leads/scans keyed on it) is intentionally immutable. Password is only changed when a
 * non-empty value is provided, and it is re-hashed with bcrypt.
 */
export async function updateShop(
  code: string,
  input: {
    name?: string;
    ownerName?: string | null;
    contactPhone?: string | null;
    email?: string | null;
    username?: string;
    password?: string;
    commissionAmount?: number;
  }
): Promise<UpdateShopResult> {
  const shop = await queryOne<{ id: number }>("SELECT id FROM ReferralShop WHERE code = ? LIMIT 1", [code]);
  if (!shop) return { ok: false, error: "الزبون غير موجود", status: 404 };

  const sets: string[] = [];
  const vals: (string | number | null)[] = [];

  if (input.name !== undefined) {
    const name = String(input.name).trim();
    if (!name) return { ok: false, error: "الاسم مطلوب", status: 400 };
    sets.push("name = ?");
    vals.push(name.slice(0, 190));
  }
  if (input.ownerName !== undefined) {
    sets.push("ownerName = ?");
    vals.push(input.ownerName ? String(input.ownerName).trim().slice(0, 190) : null);
  }
  if (input.contactPhone !== undefined) {
    sets.push("contactPhone = ?");
    vals.push(input.contactPhone ? String(input.contactPhone).trim().slice(0, 40) : null);
  }
  if (input.email !== undefined) {
    sets.push("email = ?");
    vals.push(input.email ? String(input.email).trim().slice(0, 190) : null);
  }
  if (input.commissionAmount !== undefined) {
    sets.push("commissionAmount = ?");
    vals.push(Number(input.commissionAmount) || 0);
  }
  if (input.username !== undefined) {
    const username = String(input.username).trim().toLowerCase();
    if (username.length < 3) return { ok: false, error: "اسم مستخدم صحيح مطلوب (3 أحرف على الأقل)", status: 400 };
    const taken = await queryOne<{ id: number }>(
      "SELECT id FROM ReferralShop WHERE username = ? AND code <> ? LIMIT 1",
      [username, code]
    );
    if (taken) return { ok: false, error: "اسم المستخدم مستخدم مسبقاً", status: 409 };
    sets.push("username = ?");
    vals.push(username.slice(0, 60));
  }
  if (input.password !== undefined && String(input.password).trim() !== "") {
    const password = String(input.password).trim();
    if (password.length < 6) return { ok: false, error: "كلمة مرور 6 أحرف على الأقل مطلوبة", status: 400 };
    sets.push("passwordHash = ?");
    vals.push(await hashPassword(password));
  }

  if (sets.length === 0) return { ok: true };

  sets.push("updatedAt = NOW()");
  vals.push(code);
  await execute(`UPDATE ReferralShop SET ${sets.join(", ")} WHERE code = ?`, vals);
  return { ok: true };
}

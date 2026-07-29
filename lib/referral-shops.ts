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

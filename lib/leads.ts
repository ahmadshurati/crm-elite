import { execute, query, queryOne } from "@/lib/db";

export type LeadInput = {
  name: string;
  phone: string;
  email?: string | null;
  businessName?: string | null;
  note?: string | null;
  shopCode?: string | null;
  ipAddress?: string | null;
};

export type ReferralShopRecord = {
  code: string;
  name: string;
  ownerName: string | null;
  commissionAmount: number;
};

export type ReferralLeadRow = {
  name: string;
  businessName: string | null;
  phone: string;
  email: string | null;
  status: string;
  createdAt: string;
};

export type ReferralStats = {
  shop: ReferralShopRecord | null;
  code: string;
  scans: number;
  leads: number;
  subscribed: number;
  commissionAmount: number;
  estimatedCommission: number;
  range: { from: string | null; to: string | null };
  items: ReferralLeadRow[];
};

function normalizeCode(code?: string | null) {
  const value = String(code || "").trim().toLowerCase();
  if (!value) return null;
  return value.replace(/[^a-z0-9_-]/g, "").slice(0, 60) || null;
}

function normalizeDate(value?: string | null) {
  const v = String(value || "").trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null;
}

export async function createLead(input: LeadInput) {
  const name = String(input.name || "").trim().slice(0, 120);
  const phone = String(input.phone || "").trim().slice(0, 40);
  const email = input.email ? String(input.email).trim().slice(0, 190) : null;
  const businessName = input.businessName ? String(input.businessName).trim().slice(0, 190) : null;
  const note = input.note ? String(input.note).trim().slice(0, 1000) : null;
  const shopCode = normalizeCode(input.shopCode);

  const result = await execute(
    `INSERT INTO \`Lead\` (name, phone, email, businessName, note, shopCode, status, ipAddress, createdAt)
     VALUES (?, ?, ?, ?, ?, ?, 'new', ?, NOW())`,
    [name, phone, email, businessName, note, shopCode, input.ipAddress || null]
  );

  return Number(result.insertId);
}

export async function logScan(input: { shopCode?: string | null; ipAddress?: string | null; userAgent?: string | null }) {
  const shopCode = normalizeCode(input.shopCode);
  await execute(
    `INSERT INTO ScanEvent (shopCode, ipAddress, userAgent, createdAt) VALUES (?, ?, ?, NOW())`,
    [shopCode, input.ipAddress || null, input.userAgent ? String(input.userAgent).slice(0, 500) : null]
  );
}

export async function getReferralStats(
  rawCode: string,
  opts?: { from?: string | null; to?: string | null }
): Promise<ReferralStats> {
  const code = normalizeCode(rawCode) || "";
  const from = normalizeDate(opts?.from);
  const to = normalizeDate(opts?.to);

  const dateClause = () => {
    const clauses: string[] = [];
    const params: string[] = [];
    if (from) {
      clauses.push("createdAt >= ?");
      params.push(`${from} 00:00:00`);
    }
    if (to) {
      clauses.push("createdAt <= ?");
      params.push(`${to} 23:59:59`);
    }
    return { clause: clauses.length ? ` AND ${clauses.join(" AND ")}` : "", params };
  };

  const scanR = dateClause();
  const leadR = dateClause();
  const subR = dateClause();
  const listR = dateClause();

  const shop = await queryOne<ReferralShopRecord>(
    "SELECT code, name, ownerName, commissionAmount FROM ReferralShop WHERE code = ? LIMIT 1",
    [code]
  );

  const [scansRow, leadsRow, subscribedRow, rows] = await Promise.all([
    queryOne<{ count: number }>(
      `SELECT COUNT(*) AS count FROM ScanEvent WHERE shopCode = ?${scanR.clause}`,
      [code, ...scanR.params]
    ),
    queryOne<{ count: number }>(
      `SELECT COUNT(*) AS count FROM \`Lead\` WHERE shopCode = ?${leadR.clause}`,
      [code, ...leadR.params]
    ),
    queryOne<{ count: number }>(
      `SELECT COUNT(*) AS count FROM \`Lead\` WHERE shopCode = ? AND status = 'subscribed'${subR.clause}`,
      [code, ...subR.params]
    ),
    query<{ name: string; businessName: string | null; phone: string; email: string | null; status: string; createdAt: string | Date }>(
      `SELECT name, businessName, phone, email, status, createdAt
       FROM \`Lead\` WHERE shopCode = ?${listR.clause}
       ORDER BY createdAt DESC LIMIT 300`,
      [code, ...listR.params]
    ),
  ]);

  const scans = Number(scansRow?.count || 0);
  const leads = Number(leadsRow?.count || 0);
  const subscribed = Number(subscribedRow?.count || 0);
  const commissionAmount = Number(shop?.commissionAmount || 0);

  return {
    shop: shop
      ? { code: shop.code, name: shop.name, ownerName: shop.ownerName, commissionAmount }
      : null,
    code,
    scans,
    leads,
    subscribed,
    commissionAmount,
    estimatedCommission: subscribed * commissionAmount,
    range: { from, to },
    items: rows.map((row) => ({
      name: maskName(String(row.name || "")),
      businessName: row.businessName ? String(row.businessName) : null,
      phone: maskPhone(String(row.phone || "")),
      email: maskEmail(row.email ? String(row.email) : null),
      status: String(row.status || "new"),
      createdAt: new Date(row.createdAt as string | Date).toISOString(),
    })),
  };
}

function maskName(name: string) {
  const trimmed = name.trim();
  if (trimmed.length <= 2) return trimmed;
  const parts = trimmed.split(/\s+/);
  return parts
    .map((part) => (part.length <= 2 ? part : `${part.slice(0, 2)}${"*".repeat(Math.min(part.length - 2, 4))}`))
    .join(" ");
}

function maskPhone(phone: string) {
  const digits = phone.replace(/\s+/g, "");
  if (digits.length <= 4) return digits;
  return `${digits.slice(0, 3)}${"*".repeat(Math.max(digits.length - 5, 2))}${digits.slice(-2)}`;
}

function maskEmail(email: string | null) {
  if (!email) return null;
  const [user, domain] = email.split("@");
  if (!domain) return email;
  const maskedUser = user.length <= 2 ? user : `${user.slice(0, 2)}${"*".repeat(Math.min(user.length - 2, 4))}`;
  return `${maskedUser}@${domain}`;
}

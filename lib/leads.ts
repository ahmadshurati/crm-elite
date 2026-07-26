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

export type ReferralStats = {
  shop: ReferralShopRecord | null;
  code: string;
  scans: number;
  leads: number;
  subscribed: number;
  commissionAmount: number;
  estimatedCommission: number;
  recentLeads: { name: string; createdAt: string; status: string }[];
};

function normalizeCode(code?: string | null) {
  const value = String(code || "").trim().toLowerCase();
  if (!value) return null;
  return value.replace(/[^a-z0-9_-]/g, "").slice(0, 60) || null;
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

export async function getReferralStats(rawCode: string): Promise<ReferralStats> {
  const code = normalizeCode(rawCode) || "";

  const shop = await queryOne<ReferralShopRecord>(
    "SELECT code, name, ownerName, commissionAmount FROM ReferralShop WHERE code = ? LIMIT 1",
    [code]
  );

  const [scansRow, leadsRow, subscribedRow] = await Promise.all([
    queryOne<{ count: number }>("SELECT COUNT(*) AS count FROM ScanEvent WHERE shopCode = ?", [code]),
    queryOne<{ count: number }>("SELECT COUNT(*) AS count FROM `Lead` WHERE shopCode = ?", [code]),
    queryOne<{ count: number }>(
      "SELECT COUNT(*) AS count FROM `Lead` WHERE shopCode = ? AND status = 'subscribed'",
      [code]
    ),
  ]);

  const recent = await query<{ name: string; createdAt: string | Date; status: string }>(
    "SELECT name, status, createdAt FROM `Lead` WHERE shopCode = ? ORDER BY createdAt DESC LIMIT 8",
    [code]
  );

  const scans = Number(scansRow?.count || 0);
  const leads = Number(leadsRow?.count || 0);
  const subscribed = Number(subscribedRow?.count || 0);
  const commissionAmount = Number(shop?.commissionAmount || 0);

  return {
    shop: shop
      ? {
          code: shop.code,
          name: shop.name,
          ownerName: shop.ownerName,
          commissionAmount,
        }
      : null,
    code,
    scans,
    leads,
    subscribed,
    commissionAmount,
    estimatedCommission: subscribed * commissionAmount,
    recentLeads: recent.map((row) => ({
      name: maskName(String(row.name || "")),
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

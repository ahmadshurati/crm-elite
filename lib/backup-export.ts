import { query, queryOne } from "@/lib/db";

export type BackupSummary = {
  generatedAt: string;
  counts: Record<string, number>;
};

export async function getBackupSummary(): Promise<BackupSummary> {
  const tables = [
    "Customer",
    "Car",
    "Insurance",
    "AccidentCase",
    "AppUser",
    "Deal",
    "Quote",
    "Invoice",
    "CrmTask",
    "Contract",
    "Product",
    "CrmFile",
    "FieldChangeLog",
    "ActivityLog",
  ] as const;

  const counts: Record<string, number> = {};

  await Promise.all(
    tables.map(async (table) => {
      const row = await queryOne<{ count: number }>(`SELECT COUNT(*) AS count FROM \`${table}\``);
      counts[table] = Number(row?.count || 0);
    })
  );

  return {
    generatedAt: new Date().toISOString(),
    counts,
  };
}

export async function exportBackupSnapshot() {
  const [customers, deals, tasks, quotes, invoices, contracts, products] = await Promise.all([
    query<Record<string, unknown>>(
      "SELECT id, name, phone, email, customerStatus, isArchived, createdAt FROM Customer ORDER BY id ASC LIMIT 5000"
    ),
    query<Record<string, unknown>>(
      "SELECT id, customerId, title, stage, value, isArchived, createdAt FROM Deal ORDER BY id ASC LIMIT 5000"
    ),
    query<Record<string, unknown>>(
      "SELECT id, customerId, title, status, dueDate, priority, createdAt FROM CrmTask ORDER BY id ASC LIMIT 5000"
    ),
    query<Record<string, unknown>>(
      "SELECT id, customerId, quoteNumber, title, status, total, createdAt FROM Quote ORDER BY id ASC LIMIT 5000"
    ),
    query<Record<string, unknown>>(
      "SELECT id, customerId, invoiceNumber, title, status, total, paidAmount, createdAt FROM Invoice ORDER BY id ASC LIMIT 5000"
    ),
    query<Record<string, unknown>>(
      "SELECT id, customerId, contractNumber, title, status, startDate, endDate, createdAt FROM Contract ORDER BY id ASC LIMIT 5000"
    ),
    query<Record<string, unknown>>(
      "SELECT id, sku, name, category, unitPrice, isActive FROM Product ORDER BY id ASC LIMIT 5000"
    ),
  ]);

  return {
    ...(await getBackupSummary()),
    data: {
      customers,
      deals,
      tasks,
      quotes,
      invoices,
      contracts,
      products,
    },
  };
}

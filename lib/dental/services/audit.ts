import { execute } from "@/lib/db";
import type { TransactionClient } from "@/lib/db";

type Executor = Pick<TransactionClient, "execute"> | null;

async function run(tx: Executor, sql: string, params: unknown[]) {
  if (tx) return tx.execute(sql, params);
  return execute(sql, params);
}

export async function writeDentalAudit(
  input: {
    companyId: number;
    userId: number | null;
    username: string;
    action: string;
    entityType: string;
    entityId?: string | number | null;
    oldValues?: unknown;
    newValues?: unknown;
  },
  tx: Executor = null
) {
  await run(
    tx,
    `INSERT INTO DentalAuditLog (companyId, userId, username, action, entityType, entityId, oldValues, newValues, createdAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
    [
      input.companyId,
      input.userId ?? null,
      input.username,
      input.action,
      input.entityType,
      input.entityId != null ? String(input.entityId) : null,
      input.oldValues != null ? JSON.stringify(input.oldValues) : null,
      input.newValues != null ? JSON.stringify(input.newValues) : null,
    ]
  );
}

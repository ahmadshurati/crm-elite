import { execute, query } from "@/lib/db";
import type { TransactionClient } from "@/lib/db";
import { safeIso } from "@/lib/dental/format";

type Executor = Pick<TransactionClient, "execute"> | null;

export async function addTimelineEvent(
  input: {
    companyId: number;
    patientId: number;
    type: string;
    title: string;
    refType?: string | null;
    refId?: number | null;
    actorName?: string | null;
  },
  tx: Executor = null
) {
  const sql = `INSERT INTO DentalTimelineEvent (companyId, patientId, type, title, refType, refId, actorName, createdAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, NOW())`;
  const params = [
    input.companyId,
    input.patientId,
    input.type,
    input.title,
    input.refType || null,
    input.refId ?? null,
    input.actorName || null,
  ];
  if (tx) return tx.execute(sql, params);
  return execute(sql, params);
}

export async function getTimeline(companyId: number, patientId: number) {
  const rows = await query<Record<string, unknown>>(
    `SELECT id, type, title, refType, refId, actorName, createdAt
     FROM DentalTimelineEvent
     WHERE companyId = ? AND patientId = ?
     ORDER BY createdAt DESC LIMIT 200`,
    [companyId, patientId]
  );
  return rows.map((r) => ({
    id: Number(r.id),
    type: String(r.type),
    title: String(r.title),
    refType: r.refType ? String(r.refType) : null,
    refId: r.refId != null ? Number(r.refId) : null,
    actorName: r.actorName ? String(r.actorName) : null,
    createdAt: safeIso(r.createdAt),
  }));
}

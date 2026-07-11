import { query } from "@/lib/db";
import { communicationTypeLabels } from "@/lib/crm/communications";

export type TimelineItem = {
  id: string;
  kind: "communication" | "insurance" | "accident" | "document";
  type: string;
  title: string;
  summary: string;
  occurredAt: string;
  username?: string | null;
  attachmentUrl?: string | null;
};

function toIso(value: unknown) {
  if (!value) return "";
  const date = new Date(value as string | Date);
  return Number.isNaN(date.getTime()) ? String(value) : date.toISOString();
}

export async function buildCustomerTimeline(customerId: number): Promise<TimelineItem[]> {
  const [communications, insurances, accidents, documents] = await Promise.all([
    query<Record<string, unknown>>(
      `SELECT id, username, type, occurredAt, summary, attachmentUrl
       FROM CustomerCommunication
       WHERE customerId = ?
       ORDER BY occurredAt DESC`,
      [customerId]
    ),
    query<Record<string, unknown>>(
      `SELECT i.id, i.insuranceType, i.insuranceCompany, i.startDate, i.endDate, i.status, car.carName, car.carNumber
       FROM Insurance i
       INNER JOIN Car car ON car.id = i.carId
       WHERE i.customerId = ?
       ORDER BY i.startDate DESC`,
      [customerId]
    ),
    query<Record<string, unknown>>(
      `SELECT id, caseNumber, details, status, openedAt
       FROM AccidentCase
       WHERE customerId = ?
       ORDER BY openedAt DESC`,
      [customerId]
    ),
    query<Record<string, unknown>>(
      `SELECT d.id, d.type, d.fileName, d.fileUrl, i.insuranceCompany
       FROM Document d
       INNER JOIN Insurance i ON i.id = d.insuranceId
       WHERE i.customerId = ?
       ORDER BY d.id DESC
       LIMIT 50`,
      [customerId]
    ),
  ]);

  const items: TimelineItem[] = [];

  communications.forEach((row) => {
    const type = String(row.type || "note");
    items.push({
      id: `communication-${row.id}`,
      kind: "communication",
      type,
      title: communicationTypeLabels[type as keyof typeof communicationTypeLabels] || type,
      summary: String(row.summary || ""),
      occurredAt: toIso(row.occurredAt),
      username: String(row.username || ""),
      attachmentUrl: row.attachmentUrl ? String(row.attachmentUrl) : null,
    });
  });

  insurances.forEach((row) => {
    items.push({
      id: `insurance-${row.id}`,
      kind: "insurance",
      type: "insurance",
      title: `تأمين ${String(row.insuranceType || "")} — ${String(row.insuranceCompany || "")}`,
      summary: `سيارة ${String(row.carName || "")} (${String(row.carNumber || "")}) — ${String(row.status || "")}`,
      occurredAt: toIso(row.startDate),
    });
  });

  accidents.forEach((row) => {
    items.push({
      id: `accident-${row.id}`,
      kind: "accident",
      type: "accident",
      title: `حادث ${String(row.caseNumber || "")}`,
      summary: String(row.details || ""),
      occurredAt: toIso(row.openedAt),
    });
  });

  documents.forEach((row) => {
    items.push({
      id: `document-${row.id}`,
      kind: "document",
      type: String(row.type || "document"),
      title: `مستند: ${String(row.type || "file")}`,
      summary: `${String(row.insuranceCompany || "")} — ${String(row.fileName || "")}`,
      occurredAt: toIso(new Date()),
      attachmentUrl: String(row.fileUrl || ""),
    });
  });

  return items.sort((a, b) => String(b.occurredAt).localeCompare(String(a.occurredAt)));
}

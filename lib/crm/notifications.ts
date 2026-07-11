import { execute, query } from "@/lib/db";

export type CrmNotificationRecord = {
  id: number;
  userId: number;
  type: string;
  title: string;
  body: string;
  entityType: string | null;
  entityId: number | null;
  isRead: boolean;
  createdAt: string;
};

async function upsertNotification(input: {
  userId: number;
  type: string;
  title: string;
  body: string;
  entityType?: string | null;
  entityId?: number | null;
}) {
  await execute(
    `INSERT INTO CrmNotification (userId, type, title, body, entityType, entityId, isRead, createdAt)
     VALUES (?, ?, ?, ?, ?, ?, false, NOW())
     ON DUPLICATE KEY UPDATE title = VALUES(title), body = VALUES(body), createdAt = NOW()`,
    [
      input.userId,
      input.type,
      input.title,
      input.body,
      input.entityType ?? null,
      input.entityId ?? null,
    ]
  );
}

export async function syncNotificationsForUser(userId: number, companyId?: number | null) {
  if (!companyId) return;

  const today = new Date();
  const todayKey = today.toISOString().slice(0, 10);

  const [dueTasks, overdueInvoices, expiringInsurances] = await Promise.all([
    query<Record<string, unknown>>(
      `SELECT t.id, t.title, t.dueDate, t.status
       FROM CrmTask t
       LEFT JOIN Customer c ON c.id = t.customerId
       LEFT JOIN AppUser cb ON cb.id = t.createdByUserId
       WHERE t.status IN ('pending', 'in_progress')
         AND DATE(t.dueDate) <= DATE(?)
         AND (c.companyId = ? OR (t.customerId IS NULL AND cb.companyId = ?))
       ORDER BY t.dueDate ASC
       LIMIT 20`,
      [todayKey, companyId, companyId]
    ),
    query<Record<string, unknown>>(
      `SELECT inv.id, inv.invoiceNumber, inv.title, inv.dueDate, inv.total, inv.paidAmount
       FROM Invoice inv
       INNER JOIN Customer c ON c.id = inv.customerId
       WHERE inv.status IN ('unpaid', 'partial', 'overdue')
         AND inv.dueDate IS NOT NULL
         AND DATE(inv.dueDate) < DATE(?)
         AND c.companyId = ?
       ORDER BY inv.dueDate ASC
       LIMIT 20`,
      [todayKey, companyId]
    ),
    query<Record<string, unknown>>(
      `SELECT i.id, c.name AS customerName, car.carNumber, i.endDate
       FROM Insurance i
       INNER JOIN Customer c ON c.id = i.customerId
       INNER JOIN Car car ON car.id = i.carId
       WHERE i.status = 'فعال'
         AND c.companyId = ?
         AND YEAR(i.endDate) = YEAR(CURRENT_DATE())
         AND MONTH(i.endDate) = MONTH(CURRENT_DATE())
       ORDER BY i.endDate ASC
       LIMIT 20`,
      [companyId]
    ),
  ]);

  for (const task of dueTasks) {
    const dueDate = new Date(task.dueDate as string | Date).toISOString().slice(0, 10);
    const isToday = dueDate === todayKey;
    await upsertNotification({
      userId,
      type: isToday ? "task_due_today" : "task_overdue",
      title: isToday ? "مهمة مستحقة اليوم" : "مهمة متأخرة",
      body: String(task.title || "مهمة"),
      entityType: "task",
      entityId: Number(task.id),
    });
  }

  for (const invoice of overdueInvoices) {
    await upsertNotification({
      userId,
      type: "invoice_overdue",
      title: "فاتورة متأخرة",
      body: `${invoice.invoiceNumber} — ${invoice.title}`,
      entityType: "invoice",
      entityId: Number(invoice.id),
    });
  }

  for (const insurance of expiringInsurances) {
    await upsertNotification({
      userId,
      type: "renewal_due",
      title: "تأمين ينتهي هذا الشهر",
      body: `${insurance.customerName} — ${insurance.carNumber}`,
      entityType: "insurance",
      entityId: Number(insurance.id),
    });
  }
}

export async function listNotifications(userId: number, companyId?: number | null) {
  await syncNotificationsForUser(userId, companyId);

  const rows = await query<Record<string, unknown>>(
    `SELECT id, userId, type, title, body, entityType, entityId, isRead, createdAt
     FROM CrmNotification
     WHERE userId = ?
     ORDER BY isRead ASC, createdAt DESC
     LIMIT 50`,
    [userId]
  );

  return rows.map((row) => ({
    id: Number(row.id),
    userId: Number(row.userId),
    type: String(row.type || ""),
    title: String(row.title || ""),
    body: String(row.body || ""),
    entityType: row.entityType ? String(row.entityType) : null,
    entityId: row.entityId != null ? Number(row.entityId) : null,
    isRead: Boolean(row.isRead),
    createdAt: new Date(row.createdAt as string | Date).toISOString(),
  })) satisfies CrmNotificationRecord[];
}

export async function markNotificationsRead(userId: number, ids?: number[]) {
  if (ids?.length) {
    const placeholders = ids.map(() => "?").join(", ");
    await execute(
      `UPDATE CrmNotification SET isRead = true WHERE userId = ? AND id IN (${placeholders})`,
      [userId, ...ids]
    );
    return;
  }

  await execute("UPDATE CrmNotification SET isRead = true WHERE userId = ? AND isRead = false", [userId]);
}

export async function countUnreadNotifications(userId: number, companyId?: number | null) {
  await syncNotificationsForUser(userId, companyId);
  const rows = await query<{ count: number }>(
    "SELECT COUNT(*) AS count FROM CrmNotification WHERE userId = ? AND isRead = false",
    [userId]
  );
  return Number(rows[0]?.count || 0);
}

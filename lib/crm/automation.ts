import { execute, query, queryOne } from "@/lib/db";

export type AutomationTrigger =
  | "quote_approved"
  | "deal_won"
  | "insurance_expiring"
  | "customer_imported";

export type AutomationAction = "create_task" | "create_communication";

export type AutomationRuleRecord = {
  id: number;
  name: string;
  triggerType: AutomationTrigger | string;
  actionType: AutomationAction | string;
  config: Record<string, unknown>;
  isEnabled: boolean;
};

type AutomationContext = {
  customerId?: number | null;
  userId?: number | null;
  username?: string;
  entityId?: number | null;
  entityLabel?: string;
};

const builtInRules: Array<Omit<AutomationRuleRecord, "id">> = [
  {
    name: "متابعة بعد موافقة عرض سعر",
    triggerType: "quote_approved",
    actionType: "create_task",
    isEnabled: true,
    config: { title: "متابعة عرض سعر موافق", type: "follow-up", dueDays: 2, priority: "high" },
  },
  {
    name: "متابعة بعد فوز صفقة",
    triggerType: "deal_won",
    actionType: "create_task",
    isEnabled: true,
    config: { title: "متابعة صفقة مكسوبة", type: "call", dueDays: 1, priority: "high" },
  },
  {
    name: "تذكير تجديد تأمين",
    triggerType: "insurance_expiring",
    actionType: "create_task",
    isEnabled: true,
    config: { title: "تذكير تجديد تأمين", type: "follow-up", dueDays: 0, priority: "medium" },
  },
];

function parseConfig(value: unknown) {
  if (!value) return {};
  if (typeof value === "object") return value as Record<string, unknown>;
  try {
    return JSON.parse(String(value)) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function mapRow(row: Record<string, unknown>): AutomationRuleRecord {
  return {
    id: Number(row.id),
    name: String(row.name || ""),
    triggerType: String(row.triggerType || ""),
    actionType: String(row.actionType || ""),
    config: parseConfig(row.config),
    isEnabled: Boolean(row.isEnabled),
  };
}

export async function ensureAutomationRules() {
  for (const rule of builtInRules) {
    const existing = await queryOne<{ id: number }>(
      "SELECT id FROM AutomationRule WHERE name = ? LIMIT 1",
      [rule.name]
    );
    if (existing) continue;

    await execute(
      `INSERT INTO AutomationRule (name, triggerType, actionType, config, isEnabled, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, NOW(), NOW())`,
      [rule.name, rule.triggerType, rule.actionType, JSON.stringify(rule.config), rule.isEnabled ? 1 : 0]
    );
  }
}

export async function listAutomationRules() {
  await ensureAutomationRules();
  const rows = await query<Record<string, unknown>>("SELECT * FROM AutomationRule ORDER BY id ASC");
  return rows.map(mapRow);
}

export async function updateAutomationRule(id: number, input: { isEnabled?: boolean; config?: Record<string, unknown> }) {
  const fields: string[] = [];
  const values: unknown[] = [];

  if (input.isEnabled !== undefined) {
    fields.push("isEnabled = ?");
    values.push(input.isEnabled ? 1 : 0);
  }
  if (input.config) {
    fields.push("config = ?");
    values.push(JSON.stringify(input.config));
  }

  if (!fields.length) return null;

  fields.push("updatedAt = NOW()");
  values.push(id);
  await execute(`UPDATE AutomationRule SET ${fields.join(", ")} WHERE id = ?`, values);

  const row = await queryOne<Record<string, unknown>>("SELECT * FROM AutomationRule WHERE id = ? LIMIT 1", [id]);
  return row ? mapRow(row) : null;
}

function addDays(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date;
}

async function runAction(rule: AutomationRuleRecord, context: AutomationContext) {
  const config = rule.config;

  if (rule.actionType === "create_task") {
    const dueDays = Number(config.dueDays || 1);
    const title = String(config.title || "مهمة آلية");
    const suffix = context.entityLabel ? ` — ${context.entityLabel}` : "";

    await execute(
      `INSERT INTO CrmTask (customerId, assignedUserId, createdByUserId, title, type, description, dueDate, priority, status, createdAt, updatedAt)
       VALUES (?, NULL, ?, ?, ?, ?, ?, ?, 'pending', NOW(), NOW())`,
      [
        context.customerId || null,
        context.userId || null,
        `${title}${suffix}`,
        String(config.type || "follow-up"),
        `أُنشئت تلقائياً بواسطة: ${rule.name}`,
        addDays(dueDays),
        String(config.priority || "medium"),
      ]
    );
    return;
  }

  if (rule.actionType === "create_communication") {
    await execute(
      `INSERT INTO CustomerCommunication (customerId, userId, username, type, occurredAt, summary, createdAt)
       VALUES (?, ?, ?, 'note', NOW(), ?, NOW())`,
      [
        context.customerId,
        context.userId || null,
        context.username || "system",
        String(config.summary || `تنبيه آلي: ${rule.name}`),
      ]
    );
  }
}

export async function runAutomations(trigger: AutomationTrigger, context: AutomationContext) {
  await ensureAutomationRules();

  const rows = await query<Record<string, unknown>>(
    "SELECT * FROM AutomationRule WHERE triggerType = ? AND isEnabled = 1",
    [trigger]
  );

  const rules = rows.map(mapRow);
  for (const rule of rules) {
    try {
      await runAction(rule, context);
    } catch (error) {
      console.error(`Automation rule ${rule.id} failed:`, error);
    }
  }

  return rules.length;
}

export async function runExpiringInsuranceAutomations() {
  const expiring = await query<Record<string, unknown>>(
    `SELECT i.id, i.customerId, c.name AS customerName, car.carNumber, i.endDate
     FROM Insurance i
     INNER JOIN Customer c ON c.id = i.customerId
     INNER JOIN Car car ON car.id = i.carId
     WHERE i.status = 'فعال'
       AND DATE(i.endDate) BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 14 DAY)`
  );

  let count = 0;
  for (const row of expiring) {
    await runAutomations("insurance_expiring", {
      customerId: Number(row.customerId),
      entityId: Number(row.id),
      entityLabel: `${row.customerName} — ${row.carNumber}`,
    });
    count += 1;
  }

  return count;
}

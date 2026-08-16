import { execute, query, queryOne, withTransaction } from "@/lib/db";
import { safeIso } from "@/lib/dental/format";
import { addTimelineEvent } from "@/lib/dental/services/timeline";
import { writeDentalAudit } from "@/lib/dental/services/audit";

type Ctx = { companyId: number; userId: number; username: string };

const toCents = (v: unknown) => Math.round(Number(v || 0) * 100);

export async function listCatalog(companyId: number, includeInactive = false) {
  const rows = await query<Record<string, unknown>>(
    `SELECT * FROM DentalTreatmentCatalog WHERE companyId = ?${includeInactive ? "" : " AND active = 1"} ORDER BY category, name`,
    [companyId]
  );
  return rows.map((c) => ({
    id: Number(c.id),
    code: String(c.code),
    name: String(c.name),
    category: String(c.category),
    defaultPrice: Number(c.defaultPriceCents || 0) / 100,
    estimatedDurationMin: Number(c.estimatedDurationMin || 30),
    requiresTooth: Boolean(c.requiresTooth),
    requiresSurface: Boolean(c.requiresSurface),
    requiresLab: Boolean(c.requiresLab),
    expectedSessions: Number(c.expectedSessions || 1),
    chartCondition: c.chartCondition ? String(c.chartCondition) : null,
    active: Boolean(c.active),
  }));
}

export async function createCatalog(ctx: Ctx, input: Record<string, unknown>) {
  const code = String(input.code || "").trim().toUpperCase().replace(/[^A-Z0-9_]/g, "_").slice(0, 40);
  const name = String(input.name || "").trim().slice(0, 180);
  if (!code || !name) throw new Error("الرمز والاسم مطلوبان");
  const dup = await queryOne<{ id: number }>("SELECT id FROM DentalTreatmentCatalog WHERE companyId = ? AND code = ? LIMIT 1", [ctx.companyId, code]);
  if (dup) throw new Error("الرمز مستخدم مسبقاً");
  const result = await execute(
    `INSERT INTO DentalTreatmentCatalog
      (companyId, code, name, category, defaultPriceCents, estimatedDurationMin, requiresTooth, requiresSurface, requiresLab, expectedSessions, chartCondition, active, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, NOW(), NOW())`,
    [
      ctx.companyId, code, name,
      String(input.category || "general"),
      toCents(input.defaultPrice),
      Number(input.estimatedDurationMin) || 30,
      input.requiresTooth ? 1 : 0,
      input.requiresSurface ? 1 : 0,
      input.requiresLab ? 1 : 0,
      Number(input.expectedSessions) || 1,
      input.chartCondition ? String(input.chartCondition) : null,
    ]
  );
  await writeDentalAudit({ companyId: ctx.companyId, userId: ctx.userId, username: ctx.username, action: "create", entityType: "treatmentCatalog", entityId: Number(result.insertId), newValues: { code, name } });
  return Number(result.insertId);
}

export async function updateCatalog(ctx: Ctx, id: number, input: Record<string, unknown>) {
  const fields: string[] = [];
  const values: unknown[] = [];
  const map: [string, (v: unknown) => unknown][] = [
    ["name", (v) => String(v).slice(0, 180)],
    ["category", (v) => String(v)],
    ["defaultPriceCents", (v) => toCents(v)],
    ["estimatedDurationMin", (v) => Number(v) || 30],
    ["expectedSessions", (v) => Number(v) || 1],
    ["active", (v) => (v ? 1 : 0)],
  ];
  const bodyKeys: Record<string, string> = { name: "name", category: "category", defaultPrice: "defaultPriceCents", estimatedDurationMin: "estimatedDurationMin", expectedSessions: "expectedSessions", active: "active" };
  for (const [bodyKey, col] of Object.entries(bodyKeys)) {
    if (input[bodyKey] !== undefined) {
      const conv = map.find(([c]) => c === col)![1];
      fields.push(`${col} = ?`);
      values.push(conv(input[bodyKey]));
    }
  }
  if (!fields.length) return;
  fields.push("updatedAt = NOW()");
  values.push(id, ctx.companyId);
  await execute(`UPDATE DentalTreatmentCatalog SET ${fields.join(", ")} WHERE id = ? AND companyId = ?`, values);
  await writeDentalAudit({ companyId: ctx.companyId, userId: ctx.userId, username: ctx.username, action: "update", entityType: "treatmentCatalog", entityId: id, newValues: input });
}

export async function listSessions(companyId: number, itemId: number) {
  const rows = await query<Record<string, unknown>>(
    "SELECT * FROM DentalTreatmentSession WHERE companyId = ? AND itemId = ? ORDER BY sessionNumber ASC",
    [companyId, itemId]
  );
  return rows.map((s) => ({
    id: Number(s.id),
    sessionNumber: Number(s.sessionNumber),
    date: safeIso(s.date),
    doctorName: s.doctorName ? String(s.doctorName) : null,
    procedures: s.procedures ? String(s.procedures) : null,
    notes: s.notes ? String(s.notes) : null,
    nextSessionRecommendation: s.nextSessionRecommendation ? String(s.nextSessionRecommendation) : null,
    status: String(s.status),
  }));
}

export async function addSession(ctx: Ctx, itemId: number, input: Record<string, unknown>) {
  const item = await queryOne<{ patientId: number; treatment: string }>(
    "SELECT patientId, treatment FROM DentalTreatmentItem WHERE id = ? AND companyId = ? LIMIT 1",
    [itemId, ctx.companyId]
  );
  if (!item) throw new Error("العلاج غير موجود");
  const countRow = await queryOne<{ c: number }>("SELECT COUNT(*) AS c FROM DentalTreatmentSession WHERE itemId = ?", [itemId]);
  const sessionNumber = Number(countRow?.c || 0) + 1;
  await withTransaction(async (tx) => {
    await tx.execute(
      `INSERT INTO DentalTreatmentSession (companyId, patientId, itemId, sessionNumber, date, doctorName, procedures, notes, nextSessionRecommendation, status, createdByUserId, createdAt)
       VALUES (?, ?, ?, ?, NOW(), ?, ?, ?, ?, 'completed', ?, NOW())`,
      [
        ctx.companyId, item.patientId, itemId, sessionNumber,
        input.doctorName ? String(input.doctorName) : null,
        input.procedures ? String(input.procedures) : null,
        input.notes ? String(input.notes) : null,
        input.nextSessionRecommendation ? String(input.nextSessionRecommendation) : null,
        ctx.userId,
      ]
    );
    // mark treatment in progress if still proposed/accepted
    await tx.execute(
      "UPDATE DentalTreatmentItem SET status = 'in_progress' WHERE id = ? AND status IN ('proposed','accepted')",
      [itemId]
    );
    await addTimelineEvent({ companyId: ctx.companyId, patientId: Number(item.patientId), type: "treatment", title: `جلسة ${sessionNumber}: ${item.treatment}`, refType: "treatmentItem", refId: itemId, actorName: ctx.username }, tx);
    await writeDentalAudit({ companyId: ctx.companyId, userId: ctx.userId, username: ctx.username, action: "session", entityType: "treatmentItem", entityId: itemId, newValues: { sessionNumber } }, tx);
  });
  return sessionNumber;
}

export async function setPlanItemStatus(ctx: Ctx, itemId: number, status: string) {
  const item = await queryOne<{ patientId: number; treatment: string; status: string }>(
    "SELECT patientId, treatment, status FROM DentalTreatmentItem WHERE id = ? AND companyId = ? LIMIT 1",
    [itemId, ctx.companyId]
  );
  if (!item) throw new Error("البند غير موجود");
  const acceptedClause = status === "accepted" ? ", acceptedAt = NOW()" : "";
  await execute(`UPDATE DentalTreatmentItem SET status = ?${acceptedClause} WHERE id = ? AND companyId = ?`, [status, itemId, ctx.companyId]);
  await addTimelineEvent({ companyId: ctx.companyId, patientId: Number(item.patientId), type: "treatment", title: `حالة علاج «${item.treatment}»: ${status}`, refType: "treatmentItem", refId: itemId, actorName: ctx.username });
  await writeDentalAudit({ companyId: ctx.companyId, userId: ctx.userId, username: ctx.username, action: "update", entityType: "treatmentItem", entityId: itemId, oldValues: { status: item.status }, newValues: { status } });
}

/**
 * Explicitly complete a treatment: sets status, updates the dental chart from the
 * catalog's chartCondition, appends tooth history, and records timeline + audit — atomically.
 */
export async function completeTreatment(ctx: Ctx, itemId: number) {
  const item = await queryOne<Record<string, unknown>>(
    `SELECT i.id, i.patientId, i.toothNumber, i.treatment, i.status, c.chartCondition
     FROM DentalTreatmentItem i LEFT JOIN DentalTreatmentCatalog c ON c.id = i.catalogId
     WHERE i.id = ? AND i.companyId = ? LIMIT 1`,
    [itemId, ctx.companyId]
  );
  if (!item) throw new Error("العلاج غير موجود");
  if (String(item.status) === "completed") return; // idempotent: avoid duplicate chart history/timeline
  const patientId = Number(item.patientId);
  const toothNumber = item.toothNumber != null ? Number(item.toothNumber) : null;
  const chartCondition = item.chartCondition ? String(item.chartCondition) : null;

  await withTransaction(async (tx) => {
    // Conditional flip guards concurrent double-complete; only the winner runs side-effects.
    const flip = await tx.execute("UPDATE DentalTreatmentItem SET status = 'completed', completedAt = NOW() WHERE id = ? AND companyId = ? AND status <> 'completed'", [itemId, ctx.companyId]);
    if (flip.affectedRows === 0) return;

    if (toothNumber != null && chartCondition) {
      await tx.execute(
        `INSERT INTO DentalToothCondition (companyId, patientId, toothNumber, \`condition\`, updatedAt)
         VALUES (?, ?, ?, ?, NOW())
         ON DUPLICATE KEY UPDATE \`condition\` = VALUES(\`condition\`), updatedAt = NOW()`,
        [ctx.companyId, patientId, toothNumber, chartCondition]
      );
      await tx.execute(
        `INSERT INTO DentalToothHistory (companyId, patientId, toothNumber, action, \`condition\`, treatment, doctorName, createdByUserId, createdAt)
         VALUES (?, ?, ?, 'treatment', ?, ?, ?, ?, NOW())`,
        [ctx.companyId, patientId, toothNumber, chartCondition, `${String(item.treatment)} - اكتمل`, ctx.username, ctx.userId]
      );
    }

    await addTimelineEvent({ companyId: ctx.companyId, patientId, type: "treatment", title: `اكتمل العلاج: ${String(item.treatment)}${toothNumber != null ? ` (سن ${toothNumber})` : ""}`, refType: "treatmentItem", refId: itemId, actorName: ctx.username }, tx);
    await writeDentalAudit({ companyId: ctx.companyId, userId: ctx.userId, username: ctx.username, action: "complete", entityType: "treatmentItem", entityId: itemId, oldValues: { status: item.status }, newValues: { status: "completed", chartCondition } }, tx);
  });
}

export async function updatePlanFinance(ctx: Ctx, patientId: number, input: { discount?: number; insurance?: number }) {
  const plan = await queryOne<{ id: number }>(
    "SELECT id FROM DentalTreatmentPlan WHERE patientId = ? AND companyId = ? ORDER BY createdAt DESC LIMIT 1",
    [patientId, ctx.companyId]
  );
  if (!plan) throw new Error("لا توجد خطة علاج");
  const fields: string[] = [];
  const values: unknown[] = [];
  if (input.discount !== undefined) {
    fields.push("discount = ?", "discountCents = ?");
    values.push(Number(input.discount) || 0, toCents(input.discount));
  }
  if (input.insurance !== undefined) {
    fields.push("insuranceCents = ?");
    values.push(toCents(input.insurance));
  }
  if (!fields.length) return;
  fields.push("updatedAt = NOW()");
  values.push(plan.id);
  await execute(`UPDATE DentalTreatmentPlan SET ${fields.join(", ")} WHERE id = ?`, values);
  await writeDentalAudit({ companyId: ctx.companyId, userId: ctx.userId, username: ctx.username, action: "update", entityType: "treatmentPlan", entityId: plan.id, newValues: input });
}

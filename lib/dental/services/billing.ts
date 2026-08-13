import { execute, query, queryOne, withTransaction } from "@/lib/db";
import { addTimelineEvent } from "@/lib/dental/services/timeline";
import { writeDentalAudit } from "@/lib/dental/services/audit";
import { CHARGEABLE_STATUSES } from "@/lib/dental/constants";
import { toCents, toMoney } from "@/lib/dental/money";

type Ctx = { companyId: number; userId: number; username: string };

const CHARGE_LIST = CHARGEABLE_STATUSES.map((s) => `'${s}'`).join(",");

export type LedgerEntry = { date: string; type: string; label: string; amount: number; balance: number };

/** Builds a chronological financial ledger with running balance (owed by patient). */
export async function getLedger(companyId: number, patientId: number) {
  const [items, plan, payments, adjustments] = await Promise.all([
    query<Record<string, unknown>>(`SELECT treatment, toothNumber, priceCents, createdAt FROM DentalTreatmentItem WHERE patientId = ? AND status IN (${CHARGE_LIST}) ORDER BY createdAt ASC`, [patientId]),
    queryOne<Record<string, unknown>>("SELECT discountCents, insuranceCents, updatedAt FROM DentalTreatmentPlan WHERE patientId = ? ORDER BY createdAt DESC LIMIT 1", [patientId]),
    query<Record<string, unknown>>("SELECT amountCents, method, reference, createdAt FROM DentalPayment WHERE patientId = ? AND voidedAt IS NULL ORDER BY createdAt ASC", [patientId]),
    query<Record<string, unknown>>("SELECT type, amountCents, reason, createdAt FROM DentalLedgerEntry WHERE patientId = ? AND voidedAt IS NULL ORDER BY createdAt ASC", [patientId]),
  ]);

  const raw: { date: string; type: string; label: string; amount: number }[] = [];
  for (const i of items) raw.push({ date: new Date(i.createdAt as string | Date).toISOString(), type: "charge", label: `علاج: ${String(i.treatment)}${i.toothNumber != null ? ` (سن ${i.toothNumber})` : ""}`, amount: Number(i.priceCents || 0) });
  const discountCents = Number(plan?.discountCents || 0);
  const insuranceCents = Number(plan?.insuranceCents || 0);
  const planDate = plan?.updatedAt ? new Date(plan.updatedAt as string | Date).toISOString() : new Date().toISOString();
  if (discountCents > 0) raw.push({ date: planDate, type: "discount", label: "خصم", amount: -discountCents });
  if (insuranceCents > 0) raw.push({ date: planDate, type: "insurance", label: "تغطية تأمين", amount: -insuranceCents });
  for (const p of payments) raw.push({ date: new Date(p.createdAt as string | Date).toISOString(), type: "payment", label: `دفعة (${String(p.method)})${p.reference ? ` - ${String(p.reference)}` : ""}`, amount: -Number(p.amountCents || 0) });
  for (const a of adjustments) raw.push({ date: new Date(a.createdAt as string | Date).toISOString(), type: String(a.type), label: adjLabel(String(a.type), a.reason ? String(a.reason) : null), amount: Number(a.amountCents || 0) });

  raw.sort((x, y) => x.date.localeCompare(y.date));
  let running = 0;
  const entries: LedgerEntry[] = raw.map((e) => { running += e.amount; return { date: e.date, type: e.type, label: e.label, amount: toMoney(e.amount), balance: toMoney(running) }; });

  const chargesCents = items.reduce((s, i) => s + Number(i.priceCents || 0), 0);
  const paidCents = payments.reduce((s, p) => s + Number(p.amountCents || 0), 0);
  const adjustCents = adjustments.reduce((s, a) => s + Number(a.amountCents || 0), 0);

  return {
    entries: entries.reverse(),
    summary: {
      charges: toMoney(chargesCents),
      discount: toMoney(discountCents),
      insurance: toMoney(insuranceCents),
      adjustments: toMoney(adjustCents),
      paid: toMoney(paidCents),
      balance: toMoney(running),
    },
  };
}

function adjLabel(type: string, reason: string | null) {
  const base = type === "refund" ? "استرجاع مبلغ" : type === "credit" ? "رصيد دائن" : "تعديل مالي";
  return reason ? `${base}: ${reason}` : base;
}

export async function addAdjustment(ctx: Ctx, patientId: number, input: { type: string; amount: number; reason?: string | null }) {
  const type = ["refund", "credit", "charge"].includes(String(input.type)) ? String(input.type) : "charge";
  let cents = Math.abs(toCents(input.amount));
  if (!Number.isFinite(cents) || cents <= 0) throw new Error("المبلغ يجب أن يكون أكبر من صفر");
  // credit reduces balance; refund & extra charge increase balance
  if (type === "credit") cents = -cents;
  const result = await execute(
    "INSERT INTO DentalLedgerEntry (companyId, patientId, type, amountCents, reason, createdByUserId, createdAt) VALUES (?, ?, ?, ?, ?, ?, NOW())",
    [ctx.companyId, patientId, type, cents, input.reason ? String(input.reason).slice(0, 240) : null, ctx.userId]
  );
  const id = Number(result.insertId);
  await addTimelineEvent({ companyId: ctx.companyId, patientId, type: "payment", title: adjLabel(type, input.reason ? String(input.reason) : null), refType: "ledger", refId: id, actorName: ctx.username });
  await writeDentalAudit({ companyId: ctx.companyId, userId: ctx.userId, username: ctx.username, action: "adjust", entityType: "ledger", entityId: id, newValues: { type, amountCents: cents } });
  return id;
}

export async function voidLedgerEntry(ctx: Ctx, id: number, reason: string) {
  // Conditional update is the source of truth (race-safe): only one caller can flip voidedAt.
  const res = await execute(
    "UPDATE DentalLedgerEntry SET voidedAt = NOW(), voidReason = ? WHERE id = ? AND companyId = ? AND voidedAt IS NULL",
    [reason || null, id, ctx.companyId]
  );
  if (res.affectedRows === 0) throw new Error("القيد غير موجود أو ملغى مسبقاً");
  await writeDentalAudit({ companyId: ctx.companyId, userId: ctx.userId, username: ctx.username, action: "void", entityType: "ledger", entityId: id, newValues: { reason } });
}

export async function createInstallments(ctx: Ctx, patientId: number, input: { count: number; amountEach: number; startDate: string; note?: string | null }) {
  const count = Math.min(Math.max(Number(input.count) || 0, 1), 60);
  const cents = toCents(input.amountEach);
  if (cents <= 0) throw new Error("قيمة الدفعة غير صحيحة");
  const start = new Date(input.startDate);
  if (isNaN(start.getTime())) throw new Error("تاريخ البدء غير صحيح");
  await withTransaction(async (tx) => {
    for (let i = 0; i < count; i++) {
      const due = new Date(start);
      due.setMonth(start.getMonth() + i);
      await tx.execute(
        "INSERT INTO DentalInstallment (companyId, patientId, dueDate, amountCents, status, note, createdByUserId, createdAt) VALUES (?, ?, ?, ?, 'upcoming', ?, ?, NOW())",
        [ctx.companyId, patientId, due.toISOString().slice(0, 10), cents, input.note ? String(input.note).slice(0, 240) : null, ctx.userId]
      );
    }
    await writeDentalAudit({ companyId: ctx.companyId, userId: ctx.userId, username: ctx.username, action: "create", entityType: "installmentPlan", entityId: patientId, newValues: { count, amountCents: cents } }, tx);
  });
}

export async function listInstallments(companyId: number, patientId: number) {
  const rows = await query<Record<string, unknown>>("SELECT * FROM DentalInstallment WHERE patientId = ? AND companyId = ? ORDER BY dueDate ASC", [patientId, companyId]);
  const today = new Date().toISOString().slice(0, 10);
  return rows.map((r) => {
    let status = String(r.status);
    const due = new Date(r.dueDate as string | Date).toISOString().slice(0, 10);
    if (status === "upcoming" && due < today) status = "overdue";
    return { id: Number(r.id), dueDate: due, amount: toMoney(r.amountCents), status, note: r.note ? String(r.note) : null };
  });
}

export async function payInstallment(ctx: Ctx, id: number, method: string) {
  const inst = await queryOne<{ patientId: number; amountCents: number; status: string }>("SELECT patientId, amountCents, status FROM DentalInstallment WHERE id = ? AND companyId = ? LIMIT 1", [id, ctx.companyId]);
  if (!inst) throw new Error("القسط غير موجود");
  if (inst.status === "paid") throw new Error("القسط مدفوع مسبقاً");
  await withTransaction(async (tx) => {
    // Flip status first with a conditional update; the row lock serializes concurrent clicks,
    // so only the winner inserts a payment (prevents double payment on double-submit/race).
    const flip = await tx.execute("UPDATE DentalInstallment SET status = 'paid', paidAt = NOW() WHERE id = ? AND companyId = ? AND status <> 'paid'", [id, ctx.companyId]);
    if (flip.affectedRows === 0) throw new Error("القسط مدفوع مسبقاً");
    const pay = await tx.execute(
      "INSERT INTO DentalPayment (companyId, patientId, amount, amountCents, method, reference, notes, createdByUserId, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())",
      [ctx.companyId, inst.patientId, toMoney(inst.amountCents), inst.amountCents, method || "cash", `قسط #${id}`, null, ctx.userId]
    );
    await addTimelineEvent({ companyId: ctx.companyId, patientId: Number(inst.patientId), type: "payment", title: `سداد قسط ₪ ${toMoney(inst.amountCents).toLocaleString()}`, refType: "payment", refId: Number(pay.insertId), actorName: ctx.username }, tx);
    await writeDentalAudit({ companyId: ctx.companyId, userId: ctx.userId, username: ctx.username, action: "payment", entityType: "installment", entityId: id, newValues: { amountCents: inst.amountCents } }, tx);
  });
}

async function nextInvoiceNumber(companyId: number, prefix: string) {
  const row = await queryOne<{ c: number }>("SELECT COUNT(*) AS c FROM DentalInvoice WHERE companyId = ?", [companyId]);
  return `${prefix}-${String(1001 + Number(row?.c || 0))}`;
}

export async function createInvoice(ctx: Ctx, patientId: number, input: { type?: string; notes?: string | null; taxCents?: number }) {
  const type = ["invoice", "estimate", "receipt", "credit_note"].includes(String(input.type)) ? String(input.type) : "invoice";
  let items: { label: string; amount: number }[] = [];
  let subtotalCents = 0;
  let discountCents = 0;
  let insuranceCents = 0;

  if (type === "receipt") {
    const payments = await query<Record<string, unknown>>("SELECT amountCents, method, createdAt FROM DentalPayment WHERE patientId = ? AND companyId = ? AND voidedAt IS NULL ORDER BY createdAt ASC", [patientId, ctx.companyId]);
    items = payments.map((p) => ({ label: `دفعة (${String(p.method)}) ${new Date(p.createdAt as string | Date).toLocaleDateString("ar")}`, amount: toMoney(p.amountCents) }));
    subtotalCents = payments.reduce((s, p) => s + Number(p.amountCents || 0), 0);
  } else {
    const rows = await query<Record<string, unknown>>(`SELECT treatment, toothNumber, priceCents FROM DentalTreatmentItem WHERE patientId = ? AND companyId = ? AND status IN (${CHARGE_LIST}) ORDER BY createdAt ASC`, [patientId, ctx.companyId]);
    items = rows.map((r) => ({ label: `${String(r.treatment)}${r.toothNumber != null ? ` (سن ${r.toothNumber})` : ""}`, amount: toMoney(r.priceCents) }));
    subtotalCents = rows.reduce((s, r) => s + Number(r.priceCents || 0), 0);
    const plan = await queryOne<Record<string, unknown>>("SELECT discountCents, insuranceCents FROM DentalTreatmentPlan WHERE patientId = ? ORDER BY createdAt DESC LIMIT 1", [patientId]);
    discountCents = Number(plan?.discountCents || 0);
    insuranceCents = Number(plan?.insuranceCents || 0);
  }
  const taxCents = Math.max(0, toCents(input.taxCents ? Number(input.taxCents) / 100 : 0));
  const totalCents = Math.max(0, subtotalCents - discountCents - insuranceCents + taxCents);
  const number = await nextInvoiceNumber(ctx.companyId, type === "receipt" ? "REC" : type === "estimate" ? "EST" : "INV");

  const result = await execute(
    "INSERT INTO DentalInvoice (companyId, patientId, number, type, items, subtotalCents, discountCents, taxCents, totalCents, status, notes, createdByUserId, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())",
    [ctx.companyId, patientId, number, type, JSON.stringify({ items, insuranceCents }), subtotalCents, discountCents, taxCents, totalCents, type === "receipt" ? "paid" : "issued", input.notes ? String(input.notes).slice(0, 480) : null, ctx.userId]
  );
  const id = Number(result.insertId);
  await addTimelineEvent({ companyId: ctx.companyId, patientId, type: "payment", title: `إصدار مستند: ${number}`, refType: "invoice", refId: id, actorName: ctx.username });
  await writeDentalAudit({ companyId: ctx.companyId, userId: ctx.userId, username: ctx.username, action: "create", entityType: "invoice", entityId: id, newValues: { number, type, totalCents } });
  return { id, number };
}

export async function listInvoices(companyId: number, patientId: number) {
  const rows = await query<Record<string, unknown>>("SELECT id, number, type, totalCents, status, createdAt FROM DentalInvoice WHERE patientId = ? AND companyId = ? ORDER BY createdAt DESC", [patientId, companyId]);
  return rows.map((r) => ({ id: Number(r.id), number: String(r.number), type: String(r.type), total: toMoney(r.totalCents), status: String(r.status), createdAt: new Date(r.createdAt as string | Date).toISOString() }));
}

export async function getInvoice(companyId: number, id: number) {
  const r = await queryOne<Record<string, unknown>>("SELECT * FROM DentalInvoice WHERE id = ? AND companyId = ? LIMIT 1", [id, companyId]);
  if (!r) return null;
  let parsed: { items: { label: string; amount: number }[]; insuranceCents?: number } = { items: [] };
  try { parsed = JSON.parse(String(r.items || "{}")); } catch { parsed = { items: [] }; }
  const patient = await queryOne<Record<string, unknown>>("SELECT fullName, patientNumber, phone FROM DentalPatient WHERE id = ? LIMIT 1", [Number(r.patientId)]);
  return {
    id: Number(r.id),
    number: String(r.number),
    type: String(r.type),
    items: parsed.items || [],
    subtotal: toMoney(r.subtotalCents),
    discount: toMoney(r.discountCents),
    insurance: toMoney(parsed.insuranceCents || 0),
    tax: toMoney(r.taxCents),
    total: toMoney(r.totalCents),
    status: String(r.status),
    notes: r.notes ? String(r.notes) : null,
    createdAt: new Date(r.createdAt as string | Date).toISOString(),
    patient: patient ? { fullName: String(patient.fullName || ""), patientNumber: String(patient.patientNumber || ""), phone: patient.phone ? String(patient.phone) : null } : null,
  };
}

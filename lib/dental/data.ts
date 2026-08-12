import { NextResponse } from "next/server";
import { execute, query, queryOne, withTransaction } from "@/lib/db";
import { requireUser, isErrorResponse } from "@/lib/permissions";
import { resolveCompanyId } from "@/lib/tenant";
import { addTimelineEvent, getTimeline } from "@/lib/dental/services/timeline";
import { writeDentalAudit } from "@/lib/dental/services/audit";
import { resolveDentalRole, roleCan, type DentalPermission, type DentalRole } from "@/lib/dental/rbac";

const CHARGEABLE = ["approved", "in_progress", "completed"];

export type DentalContext = {
  userId: number;
  username: string;
  companyId: number;
  clinicName: string;
  role: DentalRole;
  can: (permission: DentalPermission) => boolean;
};

/** Ensures the caller is an authenticated user of a dental-type company, with resolved role. */
export async function requireDental(): Promise<DentalContext | NextResponse> {
  const auth = await requireUser();
  if (isErrorResponse(auth)) return auth;
  const companyId = resolveCompanyId(auth.user);
  if (!companyId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const company = await queryOne<{ type: string; name: string }>(
    "SELECT type, name FROM Company WHERE id = ? LIMIT 1",
    [companyId]
  );
  if (!company || company.type !== "dental") {
    return NextResponse.json({ error: "Not a dental clinic" }, { status: 403 });
  }
  const dentalRole = (auth.user as { dentalRole?: string | null }).dentalRole ?? null;
  const role = resolveDentalRole(auth.user.role, dentalRole);
  return {
    userId: auth.user.id,
    username: auth.user.username,
    companyId,
    clinicName: company.name,
    role,
    can: (permission: DentalPermission) => roleCan(role, permission),
  };
}

/** Returns a 403 NextResponse if the context lacks the permission, else null. */
export function ensure(ctx: DentalContext, permission: DentalPermission): NextResponse | null {
  if (!ctx.can(permission)) {
    return NextResponse.json({ error: "ليس لديك صلاحية لهذه العملية" }, { status: 403 });
  }
  return null;
}

const toCents = (value: unknown) => Math.round(Number(value || 0) * 100);
const toMoney = (cents: unknown) => Number(cents || 0) / 100;

function parseJsonArray(value: unknown): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(String(value));
    return Array.isArray(parsed) ? parsed.map((v) => String(v)) : [];
  } catch {
    return [];
  }
}

export async function listPatients(companyId: number, search: string) {
  const term = `%${search.trim()}%`;
  const hasSearch = search.trim().length > 0;
  const rows = await query<Record<string, unknown>>(
    `SELECT p.id, p.patientNumber, p.fullName, p.phone, p.gender, p.createdAt,
       (SELECT MAX(v.visitDate) FROM DentalVisit v WHERE v.patientId = p.id) AS lastVisit
     FROM DentalPatient p
     WHERE p.companyId = ? AND p.deletedAt IS NULL
       ${hasSearch ? "AND (p.fullName LIKE ? OR p.phone LIKE ? OR p.patientNumber LIKE ? OR p.nationalId LIKE ?)" : ""}
     ORDER BY p.createdAt DESC
     LIMIT 300`,
    hasSearch ? [companyId, term, term, term, term] : [companyId]
  );
  return rows.map((r) => ({
    id: Number(r.id),
    patientNumber: String(r.patientNumber || ""),
    fullName: String(r.fullName || ""),
    phone: r.phone ? String(r.phone) : null,
    gender: r.gender ? String(r.gender) : null,
    lastVisit: r.lastVisit ? new Date(r.lastVisit as string | Date).toISOString() : null,
    createdAt: new Date(r.createdAt as string | Date).toISOString(),
  }));
}

export async function nextPatientNumber(companyId: number) {
  const row = await queryOne<{ count: number }>(
    "SELECT COUNT(*) AS count FROM DentalPatient WHERE companyId = ?",
    [companyId]
  );
  return `P-${1001 + Number(row?.count || 0)}`;
}

export async function createPatient(ctx: DentalContext, input: Record<string, unknown>) {
  const patientNumber = await nextPatientNumber(ctx.companyId);
  const result = await execute(
    `INSERT INTO DentalPatient
      (companyId, patientNumber, fullName, nationalId, birthDate, gender, phone, whatsapp, email, address, emergencyContact, notes, medicalHistory, allergies, medications, createdByUserId, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
    [
      ctx.companyId,
      patientNumber,
      String(input.fullName || "").trim().slice(0, 180),
      input.nationalId ? String(input.nationalId).slice(0, 60) : null,
      input.birthDate ? String(input.birthDate).slice(0, 10) : null,
      input.gender ? String(input.gender).slice(0, 20) : null,
      input.phone ? String(input.phone).slice(0, 40) : null,
      input.whatsapp ? String(input.whatsapp).slice(0, 40) : null,
      input.email ? String(input.email).slice(0, 180) : null,
      input.address ? String(input.address).slice(0, 240) : null,
      input.emergencyContact ? String(input.emergencyContact).slice(0, 180) : null,
      input.notes ? String(input.notes).slice(0, 2000) : null,
      JSON.stringify(Array.isArray(input.medicalHistory) ? input.medicalHistory : []),
      JSON.stringify(Array.isArray(input.allergies) ? input.allergies : []),
      JSON.stringify(Array.isArray(input.medications) ? input.medications : []),
      ctx.userId,
    ]
  );
  const id = Number(result.insertId);
  await addTimelineEvent({ companyId: ctx.companyId, patientId: id, type: "patient", title: "تم إنشاء ملف المريض", actorName: ctx.username });
  await writeDentalAudit({ companyId: ctx.companyId, userId: ctx.userId, username: ctx.username, action: "create", entityType: "patient", entityId: id, newValues: { patientNumber, fullName: input.fullName } });
  return { id, patientNumber };
}

export async function getPatientProfile(companyId: number, patientId: number) {
  const patient = await queryOne<Record<string, unknown>>(
    "SELECT * FROM DentalPatient WHERE id = ? AND companyId = ? AND deletedAt IS NULL LIMIT 1",
    [patientId, companyId]
  );
  if (!patient) return null;

  const [teeth, visits, planItems, payments, prescriptions, appts, timeline] = await Promise.all([
    query<Record<string, unknown>>("SELECT toothNumber, condition, notes FROM DentalToothCondition WHERE patientId = ?", [patientId]),
    query<Record<string, unknown>>("SELECT * FROM DentalVisit WHERE patientId = ? ORDER BY visitDate DESC", [patientId]),
    query<Record<string, unknown>>("SELECT * FROM DentalTreatmentItem WHERE patientId = ? ORDER BY createdAt ASC", [patientId]),
    query<Record<string, unknown>>("SELECT * FROM DentalPayment WHERE patientId = ? ORDER BY createdAt DESC", [patientId]),
    query<Record<string, unknown>>("SELECT * FROM DentalPrescription WHERE patientId = ? ORDER BY createdAt DESC", [patientId]),
    query<Record<string, unknown>>("SELECT * FROM DentalAppointment WHERE patientId = ? ORDER BY startAt DESC LIMIT 20", [patientId]),
    getTimeline(companyId, patientId),
  ]);
  const plan = await queryOne<Record<string, unknown>>(
    "SELECT * FROM DentalTreatmentPlan WHERE patientId = ? ORDER BY createdAt DESC LIMIT 1",
    [patientId]
  );

  const discountCents = Number(plan?.discountCents || 0);
  const chargeableCents = planItems
    .filter((i) => CHARGEABLE.includes(String(i.status)))
    .reduce((sum, i) => sum + Number(i.priceCents || 0), 0);
  const paidCents = payments
    .filter((p) => !p.voidedAt)
    .reduce((sum, p) => sum + Number(p.amountCents || 0), 0);
  const dueCents = Math.max(chargeableCents - discountCents, 0);
  const balanceCents = dueCents - paidCents;

  return {
    patient: {
      id: Number(patient.id),
      patientNumber: String(patient.patientNumber || ""),
      fullName: String(patient.fullName || ""),
      nationalId: patient.nationalId ? String(patient.nationalId) : null,
      birthDate: patient.birthDate ? new Date(patient.birthDate as string | Date).toISOString().slice(0, 10) : null,
      gender: patient.gender ? String(patient.gender) : null,
      phone: patient.phone ? String(patient.phone) : null,
      whatsapp: patient.whatsapp ? String(patient.whatsapp) : null,
      email: patient.email ? String(patient.email) : null,
      address: patient.address ? String(patient.address) : null,
      emergencyContact: patient.emergencyContact ? String(patient.emergencyContact) : null,
      notes: patient.notes ? String(patient.notes) : null,
      medicalHistory: parseJsonArray(patient.medicalHistory),
      allergies: parseJsonArray(patient.allergies),
      medications: parseJsonArray(patient.medications),
    },
    teeth: teeth.map((t) => ({ toothNumber: Number(t.toothNumber), condition: String(t.condition), notes: t.notes ? String(t.notes) : null })),
    visits: visits.map((v) => ({
      id: Number(v.id),
      visitDate: new Date(v.visitDate as string | Date).toISOString(),
      doctorName: v.doctorName ? String(v.doctorName) : null,
      chiefComplaint: v.chiefComplaint ? String(v.chiefComplaint) : null,
      diagnosis: v.diagnosis ? String(v.diagnosis) : null,
      teeth: v.teeth ? String(v.teeth) : null,
      procedures: v.procedures ? String(v.procedures) : null,
      notes: v.notes ? String(v.notes) : null,
    })),
    plan: plan ? { id: Number(plan.id), title: String(plan.title), discount: toMoney(discountCents), status: String(plan.status) } : null,
    planItems: planItems.map((i) => ({
      id: Number(i.id),
      toothNumber: i.toothNumber != null ? Number(i.toothNumber) : null,
      treatment: String(i.treatment),
      price: toMoney(i.priceCents),
      status: String(i.status),
    })),
    payments: payments.map((p) => ({
      id: Number(p.id),
      amount: toMoney(p.amountCents),
      method: String(p.method),
      notes: p.notes ? String(p.notes) : null,
      voided: Boolean(p.voidedAt),
      createdAt: new Date(p.createdAt as string | Date).toISOString(),
    })),
    prescriptions: prescriptions.map((p) => ({ id: Number(p.id), items: parseJsonArray(p.items), notes: p.notes ? String(p.notes) : null, createdAt: new Date(p.createdAt as string | Date).toISOString() })),
    appointments: appts.map((a) => ({ id: Number(a.id), startAt: new Date(a.startAt as string | Date).toISOString(), treatmentType: a.treatmentType ? String(a.treatmentType) : null, doctorName: a.doctorName ? String(a.doctorName) : null, status: String(a.status) })),
    timeline,
    finance: {
      chargeable: toMoney(chargeableCents),
      discount: toMoney(discountCents),
      due: toMoney(dueCents),
      paid: toMoney(paidCents),
      balance: toMoney(balanceCents),
    },
  };
}

export async function patientBelongs(companyId: number, patientId: number) {
  const row = await queryOne<{ id: number }>(
    "SELECT id FROM DentalPatient WHERE id = ? AND companyId = ? AND deletedAt IS NULL LIMIT 1",
    [patientId, companyId]
  );
  return Boolean(row);
}

export async function upsertToothCondition(ctx: DentalContext, patientId: number, toothNumber: number, condition: string, notes?: string | null) {
  await execute(
    `INSERT INTO DentalToothCondition (companyId, patientId, toothNumber, condition, notes, updatedAt)
     VALUES (?, ?, ?, ?, ?, NOW())
     ON DUPLICATE KEY UPDATE condition = VALUES(condition), notes = VALUES(notes), updatedAt = NOW()`,
    [ctx.companyId, patientId, toothNumber, condition, notes || null]
  );
  await addTimelineEvent({ companyId: ctx.companyId, patientId, type: "chart", title: `تحديث حالة السن ${toothNumber}`, actorName: ctx.username });
  await writeDentalAudit({ companyId: ctx.companyId, userId: ctx.userId, username: ctx.username, action: "update", entityType: "tooth", entityId: `${patientId}:${toothNumber}`, newValues: { condition } });
}

export async function addVisit(ctx: DentalContext, patientId: number, input: Record<string, unknown>) {
  const result = await execute(
    `INSERT INTO DentalVisit (companyId, patientId, visitDate, doctorName, chiefComplaint, diagnosis, teeth, procedures, anesthesia, medications, notes, recommendations, createdByUserId, createdAt)
     VALUES (?, ?, NOW(), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
    [
      ctx.companyId, patientId,
      input.doctorName ? String(input.doctorName) : null,
      input.chiefComplaint ? String(input.chiefComplaint) : null,
      input.diagnosis ? String(input.diagnosis) : null,
      input.teeth ? String(input.teeth) : null,
      input.procedures ? String(input.procedures) : null,
      input.anesthesia ? String(input.anesthesia) : null,
      input.medications ? String(input.medications) : null,
      input.notes ? String(input.notes) : null,
      input.recommendations ? String(input.recommendations) : null,
      ctx.userId,
    ]
  );
  const id = Number(result.insertId);
  await addTimelineEvent({ companyId: ctx.companyId, patientId, type: "visit", title: "زيارة سريرية", refType: "visit", refId: id, actorName: ctx.username });
  await writeDentalAudit({ companyId: ctx.companyId, userId: ctx.userId, username: ctx.username, action: "create", entityType: "visit", entityId: id });
}

export async function addPayment(ctx: DentalContext, patientId: number, amount: number, method: string, notes?: string | null) {
  const cents = toCents(amount);
  await withTransaction(async (tx) => {
    const result = await tx.execute(
      "INSERT INTO DentalPayment (companyId, patientId, amount, amountCents, method, notes, createdByUserId, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, NOW())",
      [ctx.companyId, patientId, amount, cents, method, notes || null, ctx.userId]
    );
    const id = Number(result.insertId);
    await addTimelineEvent({ companyId: ctx.companyId, patientId, type: "payment", title: `دفعة ₪ ${amount.toLocaleString()}`, refType: "payment", refId: id, actorName: ctx.username }, tx);
    await writeDentalAudit({ companyId: ctx.companyId, userId: ctx.userId, username: ctx.username, action: "payment", entityType: "payment", entityId: id, newValues: { amountCents: cents, method } }, tx);
  });
}

export async function voidPayment(ctx: DentalContext, paymentId: number, reason: string) {
  const payment = await queryOne<{ patientId: number; amountCents: number }>(
    "SELECT patientId, amountCents FROM DentalPayment WHERE id = ? AND companyId = ? AND voidedAt IS NULL LIMIT 1",
    [paymentId, ctx.companyId]
  );
  if (!payment) throw new Error("الدفعة غير موجودة أو ملغاة مسبقاً");
  await withTransaction(async (tx) => {
    await tx.execute("UPDATE DentalPayment SET voidedAt = NOW(), voidReason = ? WHERE id = ?", [reason || null, paymentId]);
    await addTimelineEvent({ companyId: ctx.companyId, patientId: Number(payment.patientId), type: "payment", title: "إلغاء دفعة (Void)", refType: "payment", refId: paymentId, actorName: ctx.username }, tx);
    await writeDentalAudit({ companyId: ctx.companyId, userId: ctx.userId, username: ctx.username, action: "void", entityType: "payment", entityId: paymentId, oldValues: { amountCents: payment.amountCents }, newValues: { reason } }, tx);
  });
}

export async function addPrescription(ctx: DentalContext, patientId: number, items: unknown[], notes?: string | null) {
  const result = await execute(
    "INSERT INTO DentalPrescription (companyId, patientId, items, notes, createdByUserId, createdAt) VALUES (?, ?, ?, ?, ?, NOW())",
    [ctx.companyId, patientId, JSON.stringify(items || []), notes || null, ctx.userId]
  );
  const id = Number(result.insertId);
  await addTimelineEvent({ companyId: ctx.companyId, patientId, type: "prescription", title: "وصفة طبية", refType: "prescription", refId: id, actorName: ctx.username });
  await writeDentalAudit({ companyId: ctx.companyId, userId: ctx.userId, username: ctx.username, action: "create", entityType: "prescription", entityId: id });
}

export async function ensurePlan(companyId: number, patientId: number, userId: number) {
  const existing = await queryOne<{ id: number }>(
    "SELECT id FROM DentalTreatmentPlan WHERE patientId = ? ORDER BY createdAt DESC LIMIT 1",
    [patientId]
  );
  if (existing) return existing.id;
  const result = await execute(
    "INSERT INTO DentalTreatmentPlan (companyId, patientId, title, discount, discountCents, status, createdByUserId, createdAt, updatedAt) VALUES (?, ?, 'خطة علاج', 0, 0, 'active', ?, NOW(), NOW())",
    [companyId, patientId, userId]
  );
  return Number(result.insertId);
}

export async function addPlanItem(ctx: DentalContext, patientId: number, input: Record<string, unknown>) {
  const planId = await ensurePlan(ctx.companyId, patientId, ctx.userId);
  const price = Number(input.price) || 0;
  const result = await execute(
    "INSERT INTO DentalTreatmentItem (planId, companyId, patientId, toothNumber, treatment, price, priceCents, status, createdByUserId, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, 'proposed', ?, NOW())",
    [
      planId, ctx.companyId, patientId,
      input.toothNumber != null && input.toothNumber !== "" ? Number(input.toothNumber) : null,
      String(input.treatment || "").slice(0, 180),
      price,
      toCents(price),
      ctx.userId,
    ]
  );
  const id = Number(result.insertId);
  await addTimelineEvent({ companyId: ctx.companyId, patientId, type: "treatment", title: `إضافة علاج للخطة: ${String(input.treatment || "")}`, refType: "treatmentItem", refId: id, actorName: ctx.username });
  await writeDentalAudit({ companyId: ctx.companyId, userId: ctx.userId, username: ctx.username, action: "create", entityType: "treatmentItem", entityId: id, newValues: { treatment: input.treatment, priceCents: toCents(price) } });
}

export async function updatePlanItemStatus(ctx: DentalContext, itemId: number, status: string) {
  const item = await queryOne<{ patientId: number; treatment: string; status: string }>(
    "SELECT patientId, treatment, status FROM DentalTreatmentItem WHERE id = ? AND companyId = ? LIMIT 1",
    [itemId, ctx.companyId]
  );
  if (!item) throw new Error("البند غير موجود");
  await execute("UPDATE DentalTreatmentItem SET status = ? WHERE id = ? AND companyId = ?", [status, itemId, ctx.companyId]);
  const label = status === "completed" ? "اكتمل علاج" : "تحديث حالة علاج";
  await addTimelineEvent({ companyId: ctx.companyId, patientId: Number(item.patientId), type: "treatment", title: `${label}: ${item.treatment}`, refType: "treatmentItem", refId: itemId, actorName: ctx.username });
  await writeDentalAudit({ companyId: ctx.companyId, userId: ctx.userId, username: ctx.username, action: "update", entityType: "treatmentItem", entityId: itemId, oldValues: { status: item.status }, newValues: { status } });
}

export async function listAppointments(companyId: number, date: string) {
  const rows = await query<Record<string, unknown>>(
    `SELECT a.*, p.fullName, p.phone, p.patientNumber
     FROM DentalAppointment a
     INNER JOIN DentalPatient p ON p.id = a.patientId
     WHERE a.companyId = ? AND DATE(a.startAt) = ?
     ORDER BY a.startAt ASC`,
    [companyId, date]
  );
  return rows.map((a) => ({
    id: Number(a.id),
    patientId: Number(a.patientId),
    patientName: String(a.fullName || ""),
    phone: a.phone ? String(a.phone) : null,
    doctorName: a.doctorName ? String(a.doctorName) : null,
    treatmentType: a.treatmentType ? String(a.treatmentType) : null,
    startAt: new Date(a.startAt as string | Date).toISOString(),
    durationMin: Number(a.durationMin || 30),
    room: a.room ? String(a.room) : null,
    status: String(a.status),
  }));
}

export async function createAppointment(ctx: DentalContext, input: Record<string, unknown>) {
  const patientId = Number(input.patientId);
  const result = await execute(
    `INSERT INTO DentalAppointment (companyId, patientId, doctorName, treatmentType, startAt, durationMin, room, status, notes, createdByUserId, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'scheduled', ?, ?, NOW(), NOW())`,
    [
      ctx.companyId,
      patientId,
      input.doctorName ? String(input.doctorName) : null,
      input.treatmentType ? String(input.treatmentType) : null,
      new Date(String(input.startAt)),
      Number(input.durationMin) || 30,
      input.room ? String(input.room) : null,
      input.notes ? String(input.notes) : null,
      ctx.userId,
    ]
  );
  const id = Number(result.insertId);
  await addTimelineEvent({ companyId: ctx.companyId, patientId, type: "appointment", title: "تم حجز موعد", refType: "appointment", refId: id, actorName: ctx.username });
  await writeDentalAudit({ companyId: ctx.companyId, userId: ctx.userId, username: ctx.username, action: "create", entityType: "appointment", entityId: id });
}

export async function updateAppointmentStatus(ctx: DentalContext, id: number, status: string) {
  const appt = await queryOne<{ patientId: number; status: string }>(
    "SELECT patientId, status FROM DentalAppointment WHERE id = ? AND companyId = ? LIMIT 1",
    [id, ctx.companyId]
  );
  if (!appt) throw new Error("الموعد غير موجود");
  await execute("UPDATE DentalAppointment SET status = ? WHERE id = ? AND companyId = ?", [status, id, ctx.companyId]);
  await addTimelineEvent({ companyId: ctx.companyId, patientId: Number(appt.patientId), type: "appointment", title: `حالة الموعد: ${status}`, refType: "appointment", refId: id, actorName: ctx.username });
  await writeDentalAudit({ companyId: ctx.companyId, userId: ctx.userId, username: ctx.username, action: "update", entityType: "appointment", entityId: id, oldValues: { status: appt.status }, newValues: { status } });
}

export async function getDashboard(companyId: number) {
  const today = new Date().toISOString().slice(0, 10);

  const [apptStatus, newPatients, todayIncome, monthIncome, totals, byMethod] = await Promise.all([
    query<{ status: string; count: number }>(
      "SELECT status, COUNT(*) AS count FROM DentalAppointment WHERE companyId = ? AND DATE(startAt) = ? GROUP BY status",
      [companyId, today]
    ),
    queryOne<{ count: number }>("SELECT COUNT(*) AS count FROM DentalPatient WHERE companyId = ? AND deletedAt IS NULL AND DATE(createdAt) = ?", [companyId, today]),
    queryOne<{ total: number }>("SELECT COALESCE(SUM(amountCents),0) AS total FROM DentalPayment WHERE companyId = ? AND voidedAt IS NULL AND DATE(createdAt) = ?", [companyId, today]),
    queryOne<{ total: number }>("SELECT COALESCE(SUM(amountCents),0) AS total FROM DentalPayment WHERE companyId = ? AND voidedAt IS NULL AND YEAR(createdAt)=YEAR(CURDATE()) AND MONTH(createdAt)=MONTH(CURDATE())", [companyId]),
    queryOne<{ chargeable: number; discounts: number; paid: number }>(
      `SELECT
        (SELECT COALESCE(SUM(priceCents),0) FROM DentalTreatmentItem WHERE companyId = ? AND status IN ('approved','in_progress','completed')) AS chargeable,
        (SELECT COALESCE(SUM(discountCents),0) FROM DentalTreatmentPlan WHERE companyId = ?) AS discounts,
        (SELECT COALESCE(SUM(amountCents),0) FROM DentalPayment WHERE companyId = ? AND voidedAt IS NULL) AS paid`,
      [companyId, companyId, companyId]
    ),
    query<{ method: string; total: number }>(
      "SELECT method, COALESCE(SUM(amountCents),0) AS total FROM DentalPayment WHERE companyId = ? AND voidedAt IS NULL GROUP BY method",
      [companyId]
    ),
  ]);

  const statusMap: Record<string, number> = {};
  let totalToday = 0;
  for (const row of apptStatus) {
    statusMap[String(row.status)] = Number(row.count);
    totalToday += Number(row.count);
  }

  const methodMap: Record<string, number> = { cash: 0, card: 0, transfer: 0, check: 0, insurance: 0 };
  for (const row of byMethod) methodMap[String(row.method)] = toMoney(row.total);

  const chargeableCents = Number(totals?.chargeable || 0);
  const discountCents = Number(totals?.discounts || 0);
  const paidCents = Number(totals?.paid || 0);
  const remainingCents = Math.max(chargeableCents - discountCents - paidCents, 0);

  const alerts: { type: string; text: string }[] = [];
  const upcoming = await query<Record<string, unknown>>(
    `SELECT a.startAt, p.fullName FROM DentalAppointment a INNER JOIN DentalPatient p ON p.id=a.patientId
     WHERE a.companyId = ? AND a.startAt >= NOW() AND a.startAt <= DATE_ADD(NOW(), INTERVAL 2 HOUR) AND a.status NOT IN ('cancelled','no_show','completed')
     ORDER BY a.startAt ASC LIMIT 5`,
    [companyId]
  );
  for (const u of upcoming) {
    const t = new Date(u.startAt as string | Date);
    alerts.push({ type: "appointment", text: `موعد قريب: ${String(u.fullName)} الساعة ${t.toLocaleTimeString("ar", { hour: "2-digit", minute: "2-digit" })}` });
  }
  if (remainingCents > 0) alerts.push({ type: "balance", text: `مبالغ متبقية على المرضى: ₪ ${toMoney(remainingCents).toLocaleString()}` });

  return {
    today: {
      total: totalToday,
      arrived: (statusMap.arrived || 0) + (statusMap.in_treatment || 0) + (statusMap.waiting || 0),
      upcoming: (statusMap.scheduled || 0) + (statusMap.confirmed || 0),
      cancelled: statusMap.cancelled || 0,
      noShow: statusMap.no_show || 0,
      newPatients: Number(newPatients?.count || 0),
    },
    finance: {
      todayIncome: toMoney(todayIncome?.total),
      monthIncome: toMoney(monthIncome?.total),
      paid: toMoney(paidCents),
      remaining: toMoney(remainingCents),
      byMethod: methodMap,
    },
    alerts,
  };
}

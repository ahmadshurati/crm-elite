import { NextResponse } from "next/server";
import { execute, query, queryOne, withTransaction } from "@/lib/db";
import { requireUser, isErrorResponse } from "@/lib/permissions";
import { resolveCompanyId } from "@/lib/tenant";
import { addTimelineEvent, getTimeline } from "@/lib/dental/services/timeline";
import { writeDentalAudit } from "@/lib/dental/services/audit";
import { resolveDentalRole, roleCan, type DentalPermission, type DentalRole } from "@/lib/dental/rbac";
import { clampDurationMin, computeBalance, computeResponsibility, toCents as toCentsPure, toMoney as toMoneyPure } from "@/lib/dental/money";
import { safeIso } from "@/lib/dental/format";

const CHARGEABLE = ["accepted", "in_progress", "completed"];

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

const toCents = toCentsPure;
const toMoney = toMoneyPure;

const clampDuration = clampDurationMin;

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
    lastVisit: safeIso(r.lastVisit),
    createdAt: safeIso(r.createdAt),
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

/** Run a profile sub-query; on failure log which section broke and return a fallback (graceful degradation). */
async function section<T>(label: string, patientId: number, promise: Promise<T>, fallback: T): Promise<T> {
  try {
    return await promise;
  } catch (error) {
    console.error(`getPatientProfile section "${label}" failed (patient ${patientId}):`, error);
    return fallback;
  }
}

export async function getPatientProfile(companyId: number, patientId: number) {
  const patient = await queryOne<Record<string, unknown>>(
    "SELECT * FROM DentalPatient WHERE id = ? AND companyId = ? AND deletedAt IS NULL LIMIT 1",
    [patientId, companyId]
  );
  if (!patient) return null;

  const [teeth, surfaces, visits, planItems, payments, prescriptions, appts, timeline] = await Promise.all([
    section("teeth", patientId, query<Record<string, unknown>>("SELECT toothNumber, condition, notes FROM DentalToothCondition WHERE patientId = ?", [patientId]), []),
    section("surfaces", patientId, query<Record<string, unknown>>("SELECT toothNumber, surface, condition FROM DentalToothSurface WHERE patientId = ?", [patientId]), []),
    section("visits", patientId, query<Record<string, unknown>>("SELECT * FROM DentalVisit WHERE patientId = ? ORDER BY visitDate DESC", [patientId]), []),
    section(
      "planItems",
      patientId,
      query<Record<string, unknown>>(
        `SELECT i.*, c.code AS catalogCode, c.expectedSessions AS expectedSessions,
          (SELECT COUNT(*) FROM DentalTreatmentSession s WHERE s.itemId = i.id) AS sessionsDone
         FROM DentalTreatmentItem i
         LEFT JOIN DentalTreatmentCatalog c ON c.id = i.catalogId
         WHERE i.patientId = ? ORDER BY i.createdAt ASC`,
        [patientId]
      ),
      []
    ),
    section("payments", patientId, query<Record<string, unknown>>("SELECT * FROM DentalPayment WHERE patientId = ? ORDER BY createdAt DESC", [patientId]), []),
    section("prescriptions", patientId, query<Record<string, unknown>>("SELECT * FROM DentalPrescription WHERE patientId = ? ORDER BY createdAt DESC", [patientId]), []),
    section("appointments", patientId, query<Record<string, unknown>>("SELECT * FROM DentalAppointment WHERE patientId = ? ORDER BY startAt DESC LIMIT 20", [patientId]), []),
    section("timeline", patientId, getTimeline(companyId, patientId), [] as Awaited<ReturnType<typeof getTimeline>>),
  ]);
  const [plan, adjustRow] = await Promise.all([
    section("plan", patientId, queryOne<Record<string, unknown>>("SELECT * FROM DentalTreatmentPlan WHERE patientId = ? ORDER BY createdAt DESC LIMIT 1", [patientId]), null),
    section("adjustments", patientId, queryOne<{ total: number }>("SELECT COALESCE(SUM(amountCents),0) AS total FROM DentalLedgerEntry WHERE patientId = ? AND voidedAt IS NULL", [patientId]), null),
  ]);

  const discountCents = Number(plan?.discountCents || 0);
  const insuranceCents = Number(plan?.insuranceCents || 0);
  const adjustmentsCents = Number(adjustRow?.total || 0);
  const subtotalCents = planItems
    .filter((i) => CHARGEABLE.includes(String(i.status)))
    .reduce((sum, i) => sum + Number(i.priceCents || 0), 0);
  const paidCents = payments
    .filter((p) => !p.voidedAt)
    .reduce((sum, p) => sum + Number(p.amountCents || 0), 0);
  const responsibilityCents = computeResponsibility(subtotalCents, discountCents, insuranceCents);
  const balanceCents = computeBalance(responsibilityCents, paidCents, adjustmentsCents);

  const allergies = parseJsonArray(patient.allergies);
  const medical = {
    diabetes: Boolean(patient.medDiabetes),
    hypertension: Boolean(patient.medHypertension),
    heartDisease: Boolean(patient.medHeartDisease),
    bloodThinners: Boolean(patient.medBloodThinners),
    pregnancy: String(patient.medPregnancy || "na"),
  };
  const alerts: string[] = [];
  for (const a of allergies) alerts.push(`حساسية: ${a}`);
  if (medical.diabetes) alerts.push("سكري");
  if (medical.hypertension) alerts.push("ضغط الدم");
  if (medical.heartDisease) alerts.push("أمراض قلب");
  if (medical.bloodThinners) alerts.push("مميّعات دم");
  if (medical.pregnancy === "yes") alerts.push("حامل");

  const birth = patient.birthDate ? new Date(patient.birthDate as string | Date) : null;
  const age = birth ? Math.max(0, Math.floor((Date.now() - birth.getTime()) / (365.25 * 24 * 3600 * 1000))) : null;

  const planCounts = { proposed: 0, accepted: 0, declined: 0, in_progress: 0, completed: 0, cancelled: 0 } as Record<string, number>;
  for (const i of planItems) planCounts[String(i.status)] = (planCounts[String(i.status)] || 0) + 1;

  const nextAppointment = await section("nextAppointment", patientId, queryOne<Record<string, unknown>>(
    `SELECT id, startAt, treatmentType, doctorName, status FROM DentalAppointment
     WHERE companyId = ? AND patientId = ? AND startAt >= NOW() AND status NOT IN ('cancelled','no_show','completed')
     ORDER BY startAt ASC LIMIT 1`,
    [companyId, patientId]
  ), null);
  const lastVisitRow = await section("lastVisit", patientId, queryOne<{ visitDate: string | Date }>(
    "SELECT visitDate FROM DentalVisit WHERE patientId = ? ORDER BY visitDate DESC LIMIT 1",
    [patientId]
  ), null);

  return {
    patient: {
      id: Number(patient.id),
      patientNumber: String(patient.patientNumber || ""),
      fullName: String(patient.fullName || ""),
      nationalId: patient.nationalId ? String(patient.nationalId) : null,
      birthDate: safeIso(patient.birthDate)?.slice(0, 10) ?? null,
      age,
      gender: patient.gender ? String(patient.gender) : null,
      phone: patient.phone ? String(patient.phone) : null,
      whatsapp: patient.whatsapp ? String(patient.whatsapp) : null,
      email: patient.email ? String(patient.email) : null,
      address: patient.address ? String(patient.address) : null,
      emergencyContact: patient.emergencyContact ? String(patient.emergencyContact) : null,
      notes: patient.notes ? String(patient.notes) : null,
      medicalHistory: parseJsonArray(patient.medicalHistory),
      allergies,
      medications: parseJsonArray(patient.medications),
      otherConditions: parseJsonArray(patient.otherConditions),
      medical,
      medicalReviewedAt: safeIso(patient.medicalReviewedAt),
      medicalReviewedBy: patient.medicalReviewedBy ? String(patient.medicalReviewedBy) : null,
      alerts,
    },
    planCounts,
    nextAppointment: nextAppointment
      ? {
          id: Number(nextAppointment.id),
          startAt: safeIso(nextAppointment.startAt),
          treatmentType: nextAppointment.treatmentType ? String(nextAppointment.treatmentType) : null,
          doctorName: nextAppointment.doctorName ? String(nextAppointment.doctorName) : null,
        }
      : null,
    lastVisit: safeIso(lastVisitRow?.visitDate),
    teeth: teeth.map((t) => ({ toothNumber: Number(t.toothNumber), condition: String(t.condition), notes: t.notes ? String(t.notes) : null })),
    toothSurfaces: surfaces.map((s) => ({ toothNumber: Number(s.toothNumber), surface: String(s.surface), condition: String(s.condition) })),
    visits: visits.map((v) => ({
      id: Number(v.id),
      visitDate: safeIso(v.visitDate),
      status: String(v.status || "completed"),
      doctorName: v.doctorName ? String(v.doctorName) : null,
      chiefComplaint: v.chiefComplaint ? String(v.chiefComplaint) : null,
      diagnosis: v.diagnosis ? String(v.diagnosis) : null,
      teeth: v.teeth ? String(v.teeth) : null,
      procedures: v.procedures ? String(v.procedures) : null,
      notes: v.notes ? String(v.notes) : null,
      nextVisitAt: safeIso(v.nextVisitAt),
    })),
    plan: plan ? { id: Number(plan.id), title: String(plan.title), discount: toMoney(discountCents), insurance: toMoney(insuranceCents), status: String(plan.status) } : null,
    planItems: planItems.map((i) => ({
      id: Number(i.id),
      catalogId: i.catalogId != null ? Number(i.catalogId) : null,
      toothNumber: i.toothNumber != null ? Number(i.toothNumber) : null,
      treatment: String(i.treatment),
      price: toMoney(i.priceCents),
      status: String(i.status),
      expectedSessions: i.expectedSessions != null ? Number(i.expectedSessions) : null,
      sessionsDone: Number(i.sessionsDone || 0),
      acceptedAt: safeIso(i.acceptedAt),
      completedAt: safeIso(i.completedAt),
    })),
    payments: payments.map((p) => ({
      id: Number(p.id),
      amount: toMoney(p.amountCents),
      method: String(p.method),
      notes: p.notes ? String(p.notes) : null,
      voided: Boolean(p.voidedAt),
      createdAt: safeIso(p.createdAt),
    })),
    prescriptions: prescriptions.map((p) => ({ id: Number(p.id), items: parseJsonArray(p.items), notes: p.notes ? String(p.notes) : null, doctorName: p.doctorName ? String(p.doctorName) : null, diagnosis: p.diagnosis ? String(p.diagnosis) : null, createdAt: safeIso(p.createdAt) })),
    appointments: appts.map((a) => ({ id: Number(a.id), startAt: safeIso(a.startAt), treatmentType: a.treatmentType ? String(a.treatmentType) : null, doctorName: a.doctorName ? String(a.doctorName) : null, status: String(a.status) })),
    timeline,
    finance: {
      subtotal: toMoney(subtotalCents),
      chargeable: toMoney(subtotalCents),
      discount: toMoney(discountCents),
      insurance: toMoney(insuranceCents),
      responsibility: toMoney(responsibilityCents),
      due: toMoney(responsibilityCents),
      adjustments: toMoney(adjustmentsCents),
      paid: toMoney(paidCents),
      balance: toMoney(balanceCents),
    },
  };
}

export async function updatePatientPersonal(ctx: DentalContext, patientId: number, input: Record<string, unknown>) {
  const fields: string[] = [];
  const values: unknown[] = [];
  const allowed: [string, number][] = [
    ["fullName", 180], ["nationalId", 60], ["gender", 20], ["phone", 40],
    ["whatsapp", 40], ["email", 180], ["address", 240], ["emergencyContact", 180], ["notes", 2000],
  ];
  for (const [key, max] of allowed) {
    if (input[key] !== undefined) {
      fields.push(`${key} = ?`);
      values.push(input[key] ? String(input[key]).slice(0, max) : null);
    }
  }
  if (input.birthDate !== undefined) {
    fields.push("birthDate = ?");
    values.push(input.birthDate ? String(input.birthDate).slice(0, 10) : null);
  }
  if (!fields.length) return;
  fields.push("updatedAt = NOW()");
  values.push(patientId, ctx.companyId);
  await execute(`UPDATE DentalPatient SET ${fields.join(", ")} WHERE id = ? AND companyId = ?`, values);
  await addTimelineEvent({ companyId: ctx.companyId, patientId, type: "patient", title: "تحديث بيانات المريض", actorName: ctx.username });
  await writeDentalAudit({ companyId: ctx.companyId, userId: ctx.userId, username: ctx.username, action: "update", entityType: "patient", entityId: patientId, newValues: input });
}

export async function updateMedicalHistory(ctx: DentalContext, patientId: number, input: Record<string, unknown>) {
  const pregnancy = ["na", "yes", "no"].includes(String(input.pregnancy)) ? String(input.pregnancy) : "na";
  await execute(
    `UPDATE DentalPatient SET
       medDiabetes = ?, medHypertension = ?, medHeartDisease = ?, medBloodThinners = ?, medPregnancy = ?,
       allergies = ?, medications = ?, otherConditions = ?,
       medicalReviewedAt = NOW(), medicalReviewedBy = ?, updatedAt = NOW()
     WHERE id = ? AND companyId = ?`,
    [
      input.diabetes ? 1 : 0,
      input.hypertension ? 1 : 0,
      input.heartDisease ? 1 : 0,
      input.bloodThinners ? 1 : 0,
      pregnancy,
      JSON.stringify(Array.isArray(input.allergies) ? input.allergies : []),
      JSON.stringify(Array.isArray(input.medications) ? input.medications : []),
      JSON.stringify(Array.isArray(input.otherConditions) ? input.otherConditions : []),
      ctx.username,
      patientId,
      ctx.companyId,
    ]
  );
  await addTimelineEvent({ companyId: ctx.companyId, patientId, type: "medical", title: "تحديث التاريخ الطبي", actorName: ctx.username });
  await writeDentalAudit({ companyId: ctx.companyId, userId: ctx.userId, username: ctx.username, action: "update", entityType: "medicalHistory", entityId: patientId, newValues: { pregnancy, diabetes: !!input.diabetes, hypertension: !!input.hypertension, heartDisease: !!input.heartDisease, bloodThinners: !!input.bloodThinners } });
}

export async function patientBelongs(companyId: number, patientId: number) {
  const row = await queryOne<{ id: number }>(
    "SELECT id FROM DentalPatient WHERE id = ? AND companyId = ? AND deletedAt IS NULL LIMIT 1",
    [patientId, companyId]
  );
  return Boolean(row);
}

/** Run a non-critical side-effect (history/timeline/audit) without failing the primary save. */
async function bestEffort(label: string, fn: () => Promise<unknown>) {
  try {
    await fn();
  } catch (error) {
    console.error(`dental side-effect "${label}" failed:`, error);
  }
}

export async function setToothCondition(ctx: DentalContext, patientId: number, toothNumber: number, condition: string, notes?: string | null, visitId?: number | null) {
  // Primary save (must succeed).
  await execute(
    `INSERT INTO DentalToothCondition (companyId, patientId, toothNumber, condition, notes, updatedAt)
     VALUES (?, ?, ?, ?, ?, NOW())
     ON DUPLICATE KEY UPDATE condition = VALUES(condition), notes = VALUES(notes), updatedAt = NOW()`,
    [ctx.companyId, patientId, toothNumber, condition, notes || null]
  );
  // Secondary (best-effort: history/timeline/audit must never block the chart update).
  await bestEffort("toothCondition.history", () => execute(
    `INSERT INTO DentalToothHistory (companyId, patientId, toothNumber, surface, action, condition, notes, visitId, createdByUserId, createdAt)
     VALUES (?, ?, ?, NULL, 'condition', ?, ?, ?, ?, NOW())`,
    [ctx.companyId, patientId, toothNumber, condition, notes || null, visitId != null ? Number(visitId) : null, ctx.userId]
  ));
  await bestEffort("toothCondition.timeline", () => addTimelineEvent({ companyId: ctx.companyId, patientId, type: "chart", title: `تحديث حالة السن ${toothNumber}`, actorName: ctx.username }));
  await bestEffort("toothCondition.audit", () => writeDentalAudit({ companyId: ctx.companyId, userId: ctx.userId, username: ctx.username, action: "update", entityType: "tooth", entityId: `${patientId}:${toothNumber}`, newValues: { condition } }));
}

export async function setToothSurface(ctx: DentalContext, patientId: number, toothNumber: number, surface: string, condition: string, visitId?: number | null) {
  // Primary save (must succeed).
  await execute(
    `INSERT INTO DentalToothSurface (companyId, patientId, toothNumber, surface, condition, updatedAt)
     VALUES (?, ?, ?, ?, ?, NOW())
     ON DUPLICATE KEY UPDATE condition = VALUES(condition), updatedAt = NOW()`,
    [ctx.companyId, patientId, toothNumber, surface, condition]
  );
  // Secondary (best-effort).
  await bestEffort("toothSurface.history", () => execute(
    `INSERT INTO DentalToothHistory (companyId, patientId, toothNumber, surface, action, condition, visitId, createdByUserId, createdAt)
     VALUES (?, ?, ?, ?, 'surface', ?, ?, ?, NOW())`,
    [ctx.companyId, patientId, toothNumber, surface, condition, visitId != null ? Number(visitId) : null, ctx.userId]
  ));
  await bestEffort("toothSurface.timeline", () => addTimelineEvent({ companyId: ctx.companyId, patientId, type: "chart", title: `سطح ${surface} للسن ${toothNumber}: ${condition}`, actorName: ctx.username }));
  await bestEffort("toothSurface.audit", () => writeDentalAudit({ companyId: ctx.companyId, userId: ctx.userId, username: ctx.username, action: "update", entityType: "toothSurface", entityId: `${patientId}:${toothNumber}:${surface}`, newValues: { condition } }));
}

export async function getToothPanel(companyId: number, patientId: number, toothNumber: number) {
  const [condRow, surfaces, history, treatments, files] = await Promise.all([
    section("tooth.condition", patientId, queryOne<{ condition: string; notes: string | null }>(
      "SELECT condition, notes FROM DentalToothCondition WHERE patientId = ? AND toothNumber = ? LIMIT 1",
      [patientId, toothNumber]
    ), null),
    section("tooth.surfaces", patientId, query<Record<string, unknown>>("SELECT surface, condition FROM DentalToothSurface WHERE patientId = ? AND toothNumber = ?", [patientId, toothNumber]), []),
    section("tooth.history", patientId, query<Record<string, unknown>>(
      "SELECT action, surface, `condition`, treatment, doctorName, notes, createdAt FROM DentalToothHistory WHERE patientId = ? AND toothNumber = ? ORDER BY createdAt DESC LIMIT 100",
      [patientId, toothNumber]
    ), []),
    section("tooth.treatments", patientId, query<Record<string, unknown>>(
      "SELECT treatment, status, priceCents FROM DentalTreatmentItem WHERE patientId = ? AND toothNumber = ? ORDER BY createdAt DESC",
      [patientId, toothNumber]
    ), []),
    section("tooth.files", patientId, query<Record<string, unknown>>(
      "SELECT id, category, fileUrl, fileName FROM DentalFile WHERE patientId = ? AND toothNumber = ? AND deletedAt IS NULL ORDER BY createdAt DESC LIMIT 20",
      [patientId, toothNumber]
    ), []),
  ]);
  return {
    toothNumber,
    condition: condRow ? String(condRow.condition) : "healthy",
    notes: condRow?.notes ? String(condRow.notes) : null,
    surfaces: surfaces.map((s) => ({ surface: String(s.surface), condition: String(s.condition) })),
    files: files.map((f) => ({ id: Number(f.id), category: String(f.category), fileUrl: String(f.fileUrl), fileName: String(f.fileName) })),
    history: history.map((h) => ({
      action: String(h.action),
      surface: h.surface ? String(h.surface) : null,
      condition: h.condition ? String(h.condition) : null,
      treatment: h.treatment ? String(h.treatment) : null,
      doctorName: h.doctorName ? String(h.doctorName) : null,
      notes: h.notes ? String(h.notes) : null,
      createdAt: safeIso(h.createdAt),
    })),
    treatments: treatments.map((t) => ({ treatment: String(t.treatment), status: String(t.status), price: Number(t.priceCents || 0) / 100 })),
  };
}

export async function addDentalFile(ctx: DentalContext, patientId: number, meta: { category: string; fileUrl: string; fileName: string; mimeType?: string | null; sizeBytes?: number | null; description?: string | null; toothNumber?: number | null; visitId?: number | null; treatmentId?: number | null }) {
  const result = await execute(
    `INSERT INTO DentalFile (companyId, patientId, toothNumber, visitId, treatmentId, category, fileUrl, fileName, mimeType, sizeBytes, description, uploadedByUserId, createdAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
    [
      ctx.companyId, patientId,
      meta.toothNumber != null ? Number(meta.toothNumber) : null,
      meta.visitId != null ? Number(meta.visitId) : null,
      meta.treatmentId != null ? Number(meta.treatmentId) : null,
      String(meta.category || "other"),
      String(meta.fileUrl).slice(0, 1000),
      String(meta.fileName).slice(0, 255),
      meta.mimeType ? String(meta.mimeType).slice(0, 180) : null,
      meta.sizeBytes != null ? Number(meta.sizeBytes) : null,
      meta.description ? String(meta.description).slice(0, 480) : null,
      ctx.userId,
    ]
  );
  const id = Number(result.insertId);
  await addTimelineEvent({ companyId: ctx.companyId, patientId, type: "file", title: `رفع ملف: ${meta.fileName}`, refType: "file", refId: id, actorName: ctx.username });
  await writeDentalAudit({ companyId: ctx.companyId, userId: ctx.userId, username: ctx.username, action: "upload", entityType: "file", entityId: id, newValues: { category: meta.category, fileName: meta.fileName } });
  return id;
}

export async function listFiles(companyId: number, patientId: number, opts: { toothNumber?: number | null; kinds?: string[] } = {}) {
  const params: (string | number)[] = [companyId, patientId];
  let sql = "SELECT * FROM DentalFile WHERE companyId = ? AND patientId = ? AND deletedAt IS NULL";
  if (opts.toothNumber != null) { sql += " AND toothNumber = ?"; params.push(Number(opts.toothNumber)); }
  if (opts.kinds && opts.kinds.length) { sql += ` AND category IN (${opts.kinds.map(() => "?").join(",")})`; params.push(...opts.kinds); }
  sql += " ORDER BY createdAt DESC";
  const rows = await query<Record<string, unknown>>(sql, params);
  return rows.map((f) => ({
    id: Number(f.id),
    category: String(f.category),
    fileUrl: String(f.fileUrl),
    fileName: String(f.fileName),
    mimeType: f.mimeType ? String(f.mimeType) : null,
    toothNumber: f.toothNumber != null ? Number(f.toothNumber) : null,
    description: f.description ? String(f.description) : null,
    createdAt: safeIso(f.createdAt),
  }));
}

export async function softDeleteFile(ctx: DentalContext, fileId: number) {
  const row = await queryOne<{ patientId: number; fileName: string }>("SELECT patientId, fileName FROM DentalFile WHERE id = ? AND companyId = ? AND deletedAt IS NULL LIMIT 1", [fileId, ctx.companyId]);
  if (!row) throw new Error("الملف غير موجود");
  await execute("UPDATE DentalFile SET deletedAt = NOW() WHERE id = ?", [fileId]);
  await writeDentalAudit({ companyId: ctx.companyId, userId: ctx.userId, username: ctx.username, action: "delete", entityType: "file", entityId: fileId, oldValues: { fileName: row.fileName } });
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

export async function addPayment(ctx: DentalContext, patientId: number, amount: number, method: string, notes?: string | null, reference?: string | null) {
  const cents = toCents(amount);
  await withTransaction(async (tx) => {
    const result = await tx.execute(
      "INSERT INTO DentalPayment (companyId, patientId, amount, amountCents, method, reference, notes, createdByUserId, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())",
      [ctx.companyId, patientId, amount, cents, method, reference || null, notes || null, ctx.userId]
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
    // Conditional update guards against a double-void race (two concurrent requests).
    const res = await tx.execute("UPDATE DentalPayment SET voidedAt = NOW(), voidReason = ? WHERE id = ? AND companyId = ? AND voidedAt IS NULL", [reason || null, paymentId, ctx.companyId]);
    if (res.affectedRows === 0) throw new Error("الدفعة ملغاة مسبقاً");
    await addTimelineEvent({ companyId: ctx.companyId, patientId: Number(payment.patientId), type: "payment", title: "إلغاء دفعة (Void)", refType: "payment", refId: paymentId, actorName: ctx.username }, tx);
    await writeDentalAudit({ companyId: ctx.companyId, userId: ctx.userId, username: ctx.username, action: "void", entityType: "payment", entityId: paymentId, oldValues: { amountCents: payment.amountCents }, newValues: { reason } }, tx);
  });
}

export async function addPrescription(ctx: DentalContext, patientId: number, input: { items: unknown[]; notes?: string | null; visitId?: number | null; doctorName?: string | null; diagnosis?: string | null }) {
  const result = await execute(
    "INSERT INTO DentalPrescription (companyId, patientId, visitId, doctorName, diagnosis, items, notes, createdByUserId, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())",
    [
      ctx.companyId, patientId,
      input.visitId != null ? Number(input.visitId) : null,
      input.doctorName ? String(input.doctorName) : null,
      input.diagnosis ? String(input.diagnosis) : null,
      JSON.stringify(input.items || []),
      input.notes || null,
      ctx.userId,
    ]
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
  let catalogId: number | null = null;
  let treatment = String(input.treatment || "").slice(0, 180);
  let price = Number(input.price) || 0;

  if (input.catalogId != null && input.catalogId !== "") {
    const cat = await queryOne<{ id: number; name: string; defaultPriceCents: number }>(
      "SELECT id, name, defaultPriceCents FROM DentalTreatmentCatalog WHERE id = ? AND companyId = ? AND active = 1 LIMIT 1",
      [Number(input.catalogId), ctx.companyId]
    );
    if (cat) {
      catalogId = Number(cat.id);
      if (!treatment) treatment = String(cat.name);
      if (input.price === undefined || input.price === "") price = Number(cat.defaultPriceCents || 0) / 100;
    }
  }
  if (!treatment) throw new Error("اسم العلاج مطلوب");

  const result = await execute(
    "INSERT INTO DentalTreatmentItem (planId, companyId, patientId, catalogId, visitId, toothNumber, treatment, price, priceCents, status, createdByUserId, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'proposed', ?, NOW())",
    [
      planId, ctx.companyId, patientId, catalogId,
      input.visitId != null && input.visitId !== "" ? Number(input.visitId) : null,
      input.toothNumber != null && input.toothNumber !== "" ? Number(input.toothNumber) : null,
      treatment,
      price,
      toCents(price),
      ctx.userId,
    ]
  );
  const id = Number(result.insertId);
  await addTimelineEvent({ companyId: ctx.companyId, patientId, type: "treatment", title: `إضافة علاج للخطة: ${treatment}`, refType: "treatmentItem", refId: id, actorName: ctx.username });
  await writeDentalAudit({ companyId: ctx.companyId, userId: ctx.userId, username: ctx.username, action: "create", entityType: "treatmentItem", entityId: id, newValues: { treatment, priceCents: toCents(price), catalogId } });
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
    startAt: safeIso(a.startAt),
    durationMin: Number(a.durationMin || 30),
    room: a.room ? String(a.room) : null,
    status: String(a.status),
  }));
}

export async function listAppointmentsRange(companyId: number, from: string, to: string) {
  const rows = await query<Record<string, unknown>>(
    `SELECT a.*, p.fullName, p.phone, p.patientNumber
     FROM DentalAppointment a
     INNER JOIN DentalPatient p ON p.id = a.patientId
     WHERE a.companyId = ? AND DATE(a.startAt) >= ? AND DATE(a.startAt) <= ?
     ORDER BY a.startAt ASC`,
    [companyId, from, to]
  );
  return rows.map((a) => ({
    id: Number(a.id),
    patientId: Number(a.patientId),
    patientName: String(a.fullName || ""),
    phone: a.phone ? String(a.phone) : null,
    doctorName: a.doctorName ? String(a.doctorName) : null,
    treatmentType: a.treatmentType ? String(a.treatmentType) : null,
    startAt: safeIso(a.startAt),
    durationMin: Number(a.durationMin || 30),
    room: a.room ? String(a.room) : null,
    status: String(a.status),
  }));
}

export async function createAppointment(ctx: DentalContext, input: Record<string, unknown>) {
  const patientId = Number(input.patientId);
  const startAt = new Date(String(input.startAt));
  if (isNaN(startAt.getTime())) throw new Error("وقت الموعد غير صحيح");
  const durationMin = clampDuration(input.durationMin);
  const result = await execute(
    `INSERT INTO DentalAppointment (companyId, patientId, doctorName, treatmentType, startAt, durationMin, room, status, notes, createdByUserId, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'scheduled', ?, ?, NOW(), NOW())`,
    [
      ctx.companyId,
      patientId,
      input.doctorName ? String(input.doctorName) : null,
      input.treatmentType ? String(input.treatmentType) : null,
      startAt,
      durationMin,
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
    queryOne<{ chargeable: number; discounts: number; insurance: number; paid: number }>(
      `SELECT
        (SELECT COALESCE(SUM(priceCents),0) FROM DentalTreatmentItem WHERE companyId = ? AND status IN ('accepted','in_progress','completed')) AS chargeable,
        (SELECT COALESCE(SUM(discountCents),0) FROM DentalTreatmentPlan WHERE companyId = ?) AS discounts,
        (SELECT COALESCE(SUM(insuranceCents),0) FROM DentalTreatmentPlan WHERE companyId = ?) AS insurance,
        (SELECT COALESCE(SUM(amountCents),0) FROM DentalPayment WHERE companyId = ? AND voidedAt IS NULL) AS paid`,
      [companyId, companyId, companyId, companyId]
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
  const insuranceCents = Number(totals?.insurance || 0);
  const paidCents = Number(totals?.paid || 0);
  const remainingCents = Math.max(chargeableCents - discountCents - insuranceCents - paidCents, 0);

  const alerts: { type: string; text: string }[] = [];
  const [upcoming, ops, recent] = await Promise.all([
    query<Record<string, unknown>>(
      `SELECT a.startAt, a.doctorName, a.status, p.fullName FROM DentalAppointment a INNER JOIN DentalPatient p ON p.id=a.patientId
       WHERE a.companyId = ? AND a.startAt >= NOW() AND a.status NOT IN ('cancelled','no_show','completed')
       ORDER BY a.startAt ASC LIMIT 6`,
      [companyId]
    ),
    queryOne<{ labsDue: number; lowStock: number; recallsDue: number; installmentsDue: number }>(
      `SELECT
        (SELECT COUNT(*) FROM DentalLabOrder WHERE companyId = ? AND expectedDate < CURDATE() AND status NOT IN ('received','fitted')) AS labsDue,
        (SELECT COUNT(*) FROM DentalInventoryItem WHERE companyId = ? AND quantity <= minQuantity) AS lowStock,
        (SELECT COUNT(*) FROM DentalRecall WHERE companyId = ? AND dueDate <= CURDATE() AND status = 'upcoming') AS recallsDue,
        (SELECT COUNT(*) FROM DentalInstallment WHERE companyId = ? AND dueDate <= CURDATE() AND status = 'upcoming') AS installmentsDue`,
      [companyId, companyId, companyId, companyId]
    ),
    query<Record<string, unknown>>(
      "SELECT type, title, actorName, createdAt FROM DentalTimelineEvent WHERE companyId = ? ORDER BY createdAt DESC LIMIT 10",
      [companyId]
    ),
  ]);
  for (const u of upcoming.slice(0, 3)) {
    const t = new Date(u.startAt as string | Date);
    if (t.getTime() <= Date.now() + 2 * 3600 * 1000) alerts.push({ type: "appointment", text: `موعد قريب: ${String(u.fullName)} الساعة ${t.toLocaleTimeString("ar", { hour: "2-digit", minute: "2-digit" })}` });
  }
  if (Number(ops?.labsDue || 0) > 0) alerts.push({ type: "lab", text: `${Number(ops?.labsDue)} طلب مختبر متأخر` });
  if (Number(ops?.lowStock || 0) > 0) alerts.push({ type: "inventory", text: `${Number(ops?.lowStock)} صنف تحت الحد الأدنى` });
  if (Number(ops?.recallsDue || 0) > 0) alerts.push({ type: "recall", text: `${Number(ops?.recallsDue)} تذكير مستحق` });
  if (remainingCents > 0) alerts.push({ type: "balance", text: `مبالغ متبقية على المرضى: ₪ ${toMoney(remainingCents).toLocaleString()}` });

  return {
    today: {
      total: totalToday,
      waiting: (statusMap.arrived || 0) + (statusMap.waiting || 0),
      withDoctor: statusMap.in_treatment || 0,
      arrived: (statusMap.arrived || 0) + (statusMap.in_treatment || 0) + (statusMap.waiting || 0),
      upcoming: (statusMap.scheduled || 0) + (statusMap.confirmed || 0),
      completed: statusMap.completed || 0,
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
    ops: {
      labsDue: Number(ops?.labsDue || 0),
      lowStock: Number(ops?.lowStock || 0),
      recallsDue: Number(ops?.recallsDue || 0),
      installmentsDue: Number(ops?.installmentsDue || 0),
    },
    upcoming: upcoming.map((u) => ({ startAt: safeIso(u.startAt), fullName: String(u.fullName || ""), doctorName: u.doctorName ? String(u.doctorName) : null, status: String(u.status) })),
    recent: recent.map((r) => ({ type: String(r.type), title: String(r.title), actorName: r.actorName ? String(r.actorName) : null, createdAt: safeIso(r.createdAt) })),
    alerts,
  };
}

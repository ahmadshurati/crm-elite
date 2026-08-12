import { execute, query, queryOne, withTransaction } from "@/lib/db";
import { addTimelineEvent } from "@/lib/dental/services/timeline";
import { writeDentalAudit } from "@/lib/dental/services/audit";

type Ctx = { companyId: number; userId: number; username: string };

const VISIT_FIELDS: [string, string][] = [
  ["doctorName", "doctorName"],
  ["chiefComplaint", "chiefComplaint"],
  ["examination", "examination"],
  ["diagnosis", "diagnosis"],
  ["teeth", "teeth"],
  ["procedures", "procedures"],
  ["anesthesia", "anesthesia"],
  ["medications", "medications"],
  ["notes", "notes"],
  ["recommendations", "recommendations"],
  ["postOp", "postOp"],
];

export async function startVisit(ctx: Ctx, patientId: number, input: Record<string, unknown> = {}) {
  const result = await execute(
    `INSERT INTO DentalVisit (companyId, patientId, appointmentId, visitDate, doctorName, chiefComplaint, status, createdByUserId, createdAt, updatedAt)
     VALUES (?, ?, ?, NOW(), ?, ?, 'in_progress', ?, NOW(), NOW())`,
    [
      ctx.companyId, patientId,
      input.appointmentId != null && input.appointmentId !== "" ? Number(input.appointmentId) : null,
      input.doctorName ? String(input.doctorName) : null,
      input.chiefComplaint ? String(input.chiefComplaint) : null,
      ctx.userId,
    ]
  );
  const id = Number(result.insertId);
  await addTimelineEvent({ companyId: ctx.companyId, patientId, type: "visit", title: "بدأت زيارة سريرية", refType: "visit", refId: id, actorName: ctx.username });
  await writeDentalAudit({ companyId: ctx.companyId, userId: ctx.userId, username: ctx.username, action: "create", entityType: "visit", entityId: id, newValues: { status: "in_progress" } });
  return id;
}

export async function startVisitFromAppointment(ctx: Ctx, appointmentId: number) {
  const appt = await queryOne<{ patientId: number; doctorName: string | null; treatmentType: string | null; status: string }>(
    "SELECT patientId, doctorName, treatmentType, status FROM DentalAppointment WHERE id = ? AND companyId = ? LIMIT 1",
    [appointmentId, ctx.companyId]
  );
  if (!appt) throw new Error("الموعد غير موجود");
  // Reuse an existing in-progress visit for this appointment if one exists
  const existing = await queryOne<{ id: number }>(
    "SELECT id FROM DentalVisit WHERE appointmentId = ? AND status = 'in_progress' ORDER BY createdAt DESC LIMIT 1",
    [appointmentId]
  );
  let visitId: number;
  if (existing) {
    visitId = Number(existing.id);
  } else {
    visitId = await startVisit(ctx, Number(appt.patientId), { appointmentId, doctorName: appt.doctorName, chiefComplaint: appt.treatmentType });
  }
  await execute("UPDATE DentalAppointment SET status = 'in_treatment' WHERE id = ? AND companyId = ? AND status NOT IN ('completed','cancelled')", [appointmentId, ctx.companyId]);
  return { visitId, patientId: Number(appt.patientId) };
}

export async function updateVisit(ctx: Ctx, visitId: number, input: Record<string, unknown>) {
  const visit = await queryOne<{ patientId: number }>("SELECT patientId FROM DentalVisit WHERE id = ? AND companyId = ? LIMIT 1", [visitId, ctx.companyId]);
  if (!visit) throw new Error("الزيارة غير موجودة");
  const fields: string[] = [];
  const values: unknown[] = [];
  for (const [key, col] of VISIT_FIELDS) {
    if (input[key] !== undefined) {
      fields.push(`${col} = ?`);
      values.push(input[key] ? String(input[key]) : null);
    }
  }
  if (input.nextVisitAt !== undefined) {
    fields.push("nextVisitAt = ?");
    values.push(input.nextVisitAt ? new Date(String(input.nextVisitAt)) : null);
  }
  if (!fields.length) return;
  fields.push("updatedAt = NOW()");
  values.push(visitId, ctx.companyId);
  await execute(`UPDATE DentalVisit SET ${fields.join(", ")} WHERE id = ? AND companyId = ?`, values);
  await writeDentalAudit({ companyId: ctx.companyId, userId: ctx.userId, username: ctx.username, action: "update", entityType: "visit", entityId: visitId, newValues: input });
}

export async function completeVisit(ctx: Ctx, visitId: number) {
  const visit = await queryOne<{ patientId: number; appointmentId: number | null; status: string }>(
    "SELECT patientId, appointmentId, status FROM DentalVisit WHERE id = ? AND companyId = ? LIMIT 1",
    [visitId, ctx.companyId]
  );
  if (!visit) throw new Error("الزيارة غير موجودة");
  await withTransaction(async (tx) => {
    await tx.execute("UPDATE DentalVisit SET status = 'completed', updatedAt = NOW() WHERE id = ?", [visitId]);
    if (visit.appointmentId) {
      await tx.execute("UPDATE DentalAppointment SET status = 'completed' WHERE id = ? AND companyId = ? AND status NOT IN ('cancelled')", [visit.appointmentId, ctx.companyId]);
    }
    await addTimelineEvent({ companyId: ctx.companyId, patientId: Number(visit.patientId), type: "visit", title: "اكتملت الزيارة السريرية", refType: "visit", refId: visitId, actorName: ctx.username }, tx);
    await writeDentalAudit({ companyId: ctx.companyId, userId: ctx.userId, username: ctx.username, action: "complete", entityType: "visit", entityId: visitId, oldValues: { status: visit.status }, newValues: { status: "completed" } }, tx);
  });
}

export async function getVisitDetail(companyId: number, visitId: number) {
  const v = await queryOne<Record<string, unknown>>("SELECT * FROM DentalVisit WHERE id = ? AND companyId = ? LIMIT 1", [visitId, companyId]);
  if (!v) return null;
  const [treatments, prescriptions, toothHistory] = await Promise.all([
    query<Record<string, unknown>>("SELECT id, treatment, toothNumber, status, priceCents FROM DentalTreatmentItem WHERE visitId = ? ORDER BY createdAt ASC", [visitId]),
    query<Record<string, unknown>>("SELECT id, items, notes, diagnosis, doctorName, createdAt FROM DentalPrescription WHERE visitId = ? ORDER BY createdAt DESC", [visitId]),
    query<Record<string, unknown>>("SELECT toothNumber, surface, action, `condition`, treatment, createdAt FROM DentalToothHistory WHERE visitId = ? ORDER BY createdAt DESC", [visitId]),
  ]);
  return {
    id: Number(v.id),
    patientId: Number(v.patientId),
    appointmentId: v.appointmentId != null ? Number(v.appointmentId) : null,
    visitDate: new Date(v.visitDate as string | Date).toISOString(),
    status: String(v.status),
    doctorName: v.doctorName ? String(v.doctorName) : null,
    chiefComplaint: v.chiefComplaint ? String(v.chiefComplaint) : null,
    examination: v.examination ? String(v.examination) : null,
    diagnosis: v.diagnosis ? String(v.diagnosis) : null,
    teeth: v.teeth ? String(v.teeth) : null,
    procedures: v.procedures ? String(v.procedures) : null,
    anesthesia: v.anesthesia ? String(v.anesthesia) : null,
    medications: v.medications ? String(v.medications) : null,
    notes: v.notes ? String(v.notes) : null,
    recommendations: v.recommendations ? String(v.recommendations) : null,
    postOp: v.postOp ? String(v.postOp) : null,
    nextVisitAt: v.nextVisitAt ? new Date(v.nextVisitAt as string | Date).toISOString() : null,
    treatments: treatments.map((t) => ({ id: Number(t.id), treatment: String(t.treatment), toothNumber: t.toothNumber != null ? Number(t.toothNumber) : null, status: String(t.status), price: Number(t.priceCents || 0) / 100 })),
    prescriptions: prescriptions.map((p) => ({ id: Number(p.id), items: safeArr(p.items), notes: p.notes ? String(p.notes) : null, diagnosis: p.diagnosis ? String(p.diagnosis) : null, doctorName: p.doctorName ? String(p.doctorName) : null, createdAt: new Date(p.createdAt as string | Date).toISOString() })),
    toothHistory: toothHistory.map((h) => ({ toothNumber: Number(h.toothNumber), surface: h.surface ? String(h.surface) : null, action: String(h.action), condition: h.condition ? String(h.condition) : null, treatment: h.treatment ? String(h.treatment) : null, createdAt: new Date(h.createdAt as string | Date).toISOString() })),
  };
}

function safeArr(value: unknown): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(String(value));
    return Array.isArray(parsed) ? parsed.map((x) => String(x)) : [];
  } catch {
    return [];
  }
}

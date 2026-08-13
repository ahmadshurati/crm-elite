import { execute, query, queryOne } from "@/lib/db";
import { clampDurationMin } from "@/lib/dental/money";
import { addTimelineEvent } from "@/lib/dental/services/timeline";
import { writeDentalAudit } from "@/lib/dental/services/audit";

type Ctx = { companyId: number; userId: number; username: string };

export type ConflictInput = {
  startAt: Date;
  durationMin: number;
  doctorName?: string | null;
  room?: string | null;
  excludeId?: number | null;
};

/** Returns overlapping appointments for the same doctor or room (excluding cancelled/no-show). */
export async function findConflicts(companyId: number, input: ConflictInput) {
  const doctor = input.doctorName?.trim() || null;
  const room = input.room?.trim() || null;
  if (!doctor && !room) return [];

  const newEnd = new Date(input.startAt.getTime() + (Number(input.durationMin) || 30) * 60000);
  const resourceClauses: string[] = [];
  const params: (string | number | Date)[] = [companyId];
  if (doctor) { resourceClauses.push("a.doctorName = ?"); params.push(doctor); }
  if (room) { resourceClauses.push("a.room = ?"); params.push(room); }

  params.push(newEnd, input.startAt);
  let sql =
    `SELECT a.id, a.startAt, a.durationMin, a.doctorName, a.room, p.fullName
     FROM DentalAppointment a INNER JOIN DentalPatient p ON p.id = a.patientId
     WHERE a.companyId = ? AND a.status NOT IN ('cancelled','no_show')
       AND (${resourceClauses.join(" OR ")})
       AND a.startAt < ?
       AND DATE_ADD(a.startAt, INTERVAL a.durationMin MINUTE) > ?`;
  if (input.excludeId) { sql += " AND a.id <> ?"; params.push(input.excludeId); }
  sql += " ORDER BY a.startAt ASC LIMIT 10";

  const rows = await query<Record<string, unknown>>(sql, params);
  return rows.map((r) => ({
    id: Number(r.id),
    patientName: String(r.fullName || ""),
    doctorName: r.doctorName ? String(r.doctorName) : null,
    room: r.room ? String(r.room) : null,
    startAt: new Date(r.startAt as string | Date).toISOString(),
    durationMin: Number(r.durationMin || 30),
  }));
}

export async function rescheduleAppointment(ctx: Ctx, id: number, input: { startAt: string; durationMin?: number; doctorName?: string | null; room?: string | null }) {
  const appt = await queryOne<{ patientId: number; startAt: string | Date; doctorName: string | null; room: string | null; durationMin: number }>(
    "SELECT patientId, startAt, doctorName, room, durationMin FROM DentalAppointment WHERE id = ? AND companyId = ? LIMIT 1",
    [id, ctx.companyId]
  );
  if (!appt) throw new Error("الموعد غير موجود");
  const startAt = new Date(input.startAt);
  if (isNaN(startAt.getTime())) throw new Error("وقت الموعد غير صحيح");
  const durationMin = clampDurationMin(input.durationMin != null ? input.durationMin : appt.durationMin);
  const doctorName = input.doctorName !== undefined ? (input.doctorName || null) : appt.doctorName;
  const room = input.room !== undefined ? (input.room || null) : appt.room;

  await execute(
    "UPDATE DentalAppointment SET startAt = ?, durationMin = ?, doctorName = ?, room = ?, updatedAt = NOW() WHERE id = ? AND companyId = ?",
    [startAt, durationMin, doctorName, room, id, ctx.companyId]
  );
  await addTimelineEvent({ companyId: ctx.companyId, patientId: Number(appt.patientId), type: "appointment", title: `أُعيد جدولة الموعد إلى ${startAt.toLocaleString("ar")}`, refType: "appointment", refId: id, actorName: ctx.username });
  await writeDentalAudit({
    companyId: ctx.companyId, userId: ctx.userId, username: ctx.username, action: "reschedule", entityType: "appointment", entityId: id,
    oldValues: { startAt: new Date(appt.startAt as string | Date).toISOString(), doctorName: appt.doctorName, room: appt.room },
    newValues: { startAt: startAt.toISOString(), doctorName, room, durationMin },
  });
}

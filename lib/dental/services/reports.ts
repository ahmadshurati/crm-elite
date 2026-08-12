import { query, queryOne } from "@/lib/db";

const toMoney = (c: unknown) => Number(c || 0) / 100;

export async function getReports(companyId: number, from: string, to: string) {
  const [revenue, byMethod, byDoctorVisits, daily, patients, visits, appts, treatments, outstanding] = await Promise.all([
    queryOne<{ total: number; count: number }>(
      "SELECT COALESCE(SUM(amountCents),0) AS total, COUNT(*) AS count FROM DentalPayment WHERE companyId = ? AND voidedAt IS NULL AND DATE(createdAt) BETWEEN ? AND ?",
      [companyId, from, to]
    ),
    query<{ method: string; total: number }>(
      "SELECT method, COALESCE(SUM(amountCents),0) AS total FROM DentalPayment WHERE companyId = ? AND voidedAt IS NULL AND DATE(createdAt) BETWEEN ? AND ? GROUP BY method",
      [companyId, from, to]
    ),
    query<{ doctorName: string | null; c: number }>(
      "SELECT doctorName, COUNT(*) AS c FROM DentalVisit WHERE companyId = ? AND DATE(visitDate) BETWEEN ? AND ? GROUP BY doctorName ORDER BY c DESC",
      [companyId, from, to]
    ),
    query<{ d: string; total: number }>(
      "SELECT DATE(createdAt) AS d, COALESCE(SUM(amountCents),0) AS total FROM DentalPayment WHERE companyId = ? AND voidedAt IS NULL AND DATE(createdAt) BETWEEN ? AND ? GROUP BY DATE(createdAt) ORDER BY d ASC",
      [companyId, from, to]
    ),
    queryOne<{ c: number }>("SELECT COUNT(*) AS c FROM DentalPatient WHERE companyId = ? AND deletedAt IS NULL AND DATE(createdAt) BETWEEN ? AND ?", [companyId, from, to]),
    queryOne<{ c: number }>("SELECT COUNT(*) AS c FROM DentalVisit WHERE companyId = ? AND DATE(visitDate) BETWEEN ? AND ?", [companyId, from, to]),
    query<{ status: string; c: number }>("SELECT status, COUNT(*) AS c FROM DentalAppointment WHERE companyId = ? AND DATE(startAt) BETWEEN ? AND ? GROUP BY status", [companyId, from, to]),
    query<{ treatment: string; c: number; total: number }>(
      "SELECT treatment, COUNT(*) AS c, COALESCE(SUM(priceCents),0) AS total FROM DentalTreatmentItem WHERE companyId = ? AND DATE(createdAt) BETWEEN ? AND ? GROUP BY treatment ORDER BY c DESC LIMIT 10",
      [companyId, from, to]
    ),
    queryOne<{ chargeable: number; discounts: number; insurance: number; paid: number }>(
      `SELECT
        (SELECT COALESCE(SUM(priceCents),0) FROM DentalTreatmentItem WHERE companyId = ? AND status IN ('accepted','in_progress','completed')) AS chargeable,
        (SELECT COALESCE(SUM(discountCents),0) FROM DentalTreatmentPlan WHERE companyId = ?) AS discounts,
        (SELECT COALESCE(SUM(insuranceCents),0) FROM DentalTreatmentPlan WHERE companyId = ?) AS insurance,
        (SELECT COALESCE(SUM(amountCents),0) FROM DentalPayment WHERE companyId = ? AND voidedAt IS NULL) AS paid`,
      [companyId, companyId, companyId, companyId]
    ),
  ]);

  const apptMap: Record<string, number> = {};
  let apptTotal = 0;
  for (const a of appts) { apptMap[String(a.status)] = Number(a.c); apptTotal += Number(a.c); }
  const cancelled = apptMap.cancelled || 0;
  const noShow = apptMap.no_show || 0;

  const method: Record<string, number> = {};
  for (const m of byMethod) method[String(m.method)] = toMoney(m.total);

  const outstandingCents = Math.max(Number(outstanding?.chargeable || 0) - Number(outstanding?.discounts || 0) - Number(outstanding?.insurance || 0) - Number(outstanding?.paid || 0), 0);

  return {
    financial: {
      revenue: toMoney(revenue?.total),
      paymentsCount: Number(revenue?.count || 0),
      byMethod: method,
      daily: daily.map((d) => ({ date: new Date(d.d as unknown as string).toISOString().slice(0, 10), total: toMoney(d.total) })),
      outstanding: toMoney(outstandingCents),
    },
    clinic: {
      newPatients: Number(patients?.c || 0),
      visits: Number(visits?.c || 0),
      appointments: apptTotal,
      cancellationRate: apptTotal ? Math.round((cancelled / apptTotal) * 100) : 0,
      noShowRate: apptTotal ? Math.round((noShow / apptTotal) * 100) : 0,
      treatmentDistribution: treatments.map((t) => ({ treatment: String(t.treatment), count: Number(t.c), revenue: toMoney(t.total) })),
    },
    doctors: byDoctorVisits.map((d) => ({ doctorName: d.doctorName ? String(d.doctorName) : "غير محدد", visits: Number(d.c) })),
  };
}

export async function globalSearch(companyId: number, q: string) {
  const term = `%${q.trim()}%`;
  const digits = q.replace(/\D/g, "");
  const [patients, invoices, appts] = await Promise.all([
    query<Record<string, unknown>>(
      `SELECT id, patientNumber, fullName, phone FROM DentalPatient
       WHERE companyId = ? AND deletedAt IS NULL AND (fullName LIKE ? OR phone LIKE ? OR nationalId LIKE ? OR patientNumber LIKE ?)
       ORDER BY fullName ASC LIMIT 12`,
      [companyId, term, digits ? `%${digits}%` : term, term, term]
    ),
    query<Record<string, unknown>>(
      "SELECT id, number, type, totalCents FROM DentalInvoice WHERE companyId = ? AND number LIKE ? ORDER BY createdAt DESC LIMIT 8",
      [companyId, term]
    ),
    query<Record<string, unknown>>(
      `SELECT a.id, a.startAt, a.patientId, p.fullName FROM DentalAppointment a INNER JOIN DentalPatient p ON p.id = a.patientId
       WHERE a.companyId = ? AND (p.fullName LIKE ? OR a.doctorName LIKE ?) ORDER BY a.startAt DESC LIMIT 8`,
      [companyId, term, term]
    ),
  ]);
  return {
    patients: patients.map((p) => ({ id: Number(p.id), patientNumber: String(p.patientNumber || ""), fullName: String(p.fullName || ""), phone: p.phone ? String(p.phone) : null })),
    invoices: invoices.map((i) => ({ id: Number(i.id), number: String(i.number), type: String(i.type), total: toMoney(i.totalCents) })),
    appointments: appts.map((a) => ({ id: Number(a.id), patientId: Number(a.patientId), fullName: String(a.fullName || ""), startAt: new Date(a.startAt as string | Date).toISOString() })),
  };
}

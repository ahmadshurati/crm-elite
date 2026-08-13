import { execute, query, queryOne } from "@/lib/db";
import { safeDate } from "@/lib/dental/format";
import { addTimelineEvent } from "@/lib/dental/services/timeline";
import { writeDentalAudit } from "@/lib/dental/services/audit";

type Ctx = { companyId: number; userId: number; username: string };

const toCents = (v: unknown) => Math.round(Number(v || 0) * 100);
const toMoney = (c: unknown) => Number(c || 0) / 100;
const dateOrNull = (v: unknown) => (v ? String(v).slice(0, 10) : null);

/* ---------------- Clinic options (doctors & rooms dropdowns) ---------------- */
export async function listClinicOptions(companyId: number) {
  const [defined, apptRows] = await Promise.all([
    query<{ kind: string; name: string }>("SELECT kind, name FROM DentalClinicOption WHERE companyId = ? AND active = 1 ORDER BY name ASC", [companyId]),
    // Include any names already used on appointments so nothing silently disappears from the dropdowns.
    query<{ doctorName: string | null; room: string | null }>("SELECT DISTINCT doctorName, room FROM DentalAppointment WHERE companyId = ?", [companyId]),
  ]);
  const doctors = new Set<string>();
  const rooms = new Set<string>();
  for (const o of defined) {
    if (o.kind === "doctor" && o.name) doctors.add(String(o.name));
    if (o.kind === "room" && o.name) rooms.add(String(o.name));
  }
  for (const a of apptRows) {
    if (a.doctorName) doctors.add(String(a.doctorName));
    if (a.room) rooms.add(String(a.room));
  }
  return { doctors: [...doctors], rooms: [...rooms] };
}

export async function listClinicOptionsManage(companyId: number) {
  const rows = await query<Record<string, unknown>>("SELECT id, kind, name, active FROM DentalClinicOption WHERE companyId = ? ORDER BY kind, name ASC", [companyId]);
  return rows.map((r) => ({ id: Number(r.id), kind: String(r.kind), name: String(r.name), active: Boolean(r.active) }));
}

export async function createClinicOption(ctx: Ctx, kind: string, name: string) {
  const k = kind === "doctor" || kind === "room" ? kind : null;
  const nm = String(name || "").trim().slice(0, 180);
  if (!k) throw new Error("نوع غير صحيح");
  if (!nm) throw new Error("الاسم مطلوب");
  const dup = await queryOne<{ id: number }>("SELECT id FROM DentalClinicOption WHERE companyId = ? AND kind = ? AND name = ? LIMIT 1", [ctx.companyId, k, nm]);
  if (dup) throw new Error("موجود مسبقاً");
  const result = await execute("INSERT INTO DentalClinicOption (companyId, kind, name, active, createdByUserId, createdAt) VALUES (?, ?, ?, 1, ?, NOW())", [ctx.companyId, k, nm, ctx.userId]);
  await writeDentalAudit({ companyId: ctx.companyId, userId: ctx.userId, username: ctx.username, action: "create", entityType: "clinicOption", entityId: Number(result.insertId), newValues: { kind: k, name: nm } });
  return Number(result.insertId);
}

export async function deleteClinicOption(ctx: Ctx, id: number) {
  const res = await execute("DELETE FROM DentalClinicOption WHERE id = ? AND companyId = ?", [id, ctx.companyId]);
  if (res.affectedRows === 0) throw new Error("العنصر غير موجود");
  await writeDentalAudit({ companyId: ctx.companyId, userId: ctx.userId, username: ctx.username, action: "delete", entityType: "clinicOption", entityId: id });
}

/* ---------------- Lab orders ---------------- */
export async function listLabOrders(companyId: number) {
  const rows = await query<Record<string, unknown>>(
    `SELECT l.*, p.fullName FROM DentalLabOrder l INNER JOIN DentalPatient p ON p.id = l.patientId
     WHERE l.companyId = ? ORDER BY l.createdAt DESC LIMIT 300`,
    [companyId]
  );
  const today = new Date().toISOString().slice(0, 10);
  return rows.map((l) => {
    const expected = safeDate(l.expectedDate);
    const overdue = !!expected && expected < today && !["received", "fitted"].includes(String(l.status));
    return {
      id: Number(l.id), patientId: Number(l.patientId), patientName: String(l.fullName || ""),
      doctorName: l.doctorName ? String(l.doctorName) : null, toothNumber: l.toothNumber != null ? Number(l.toothNumber) : null,
      labName: String(l.labName), workType: String(l.workType), shade: l.shade ? String(l.shade) : null,
      sentDate: dateOrNull(l.sentDate), expectedDate: expected, cost: toMoney(l.costCents), status: String(l.status), overdue,
      notes: l.notes ? String(l.notes) : null,
    };
  });
}

export async function createLabOrder(ctx: Ctx, input: Record<string, unknown>) {
  if (!input.patientId) throw new Error("المريض مطلوب");
  if (!String(input.labName || "").trim()) throw new Error("اسم المختبر مطلوب");
  const result = await execute(
    `INSERT INTO DentalLabOrder (companyId, patientId, doctorName, toothNumber, labName, workType, shade, sentDate, expectedDate, costCents, status, notes, createdByUserId, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ordered', ?, ?, NOW(), NOW())`,
    [
      ctx.companyId, Number(input.patientId),
      input.doctorName ? String(input.doctorName) : null,
      input.toothNumber ? Number(input.toothNumber) : null,
      String(input.labName).slice(0, 180), String(input.workType || "crown"),
      input.shade ? String(input.shade) : null,
      dateOrNull(input.sentDate), dateOrNull(input.expectedDate),
      toCents(input.cost), input.notes ? String(input.notes).slice(0, 480) : null, ctx.userId,
    ]
  );
  const id = Number(result.insertId);
  await addTimelineEvent({ companyId: ctx.companyId, patientId: Number(input.patientId), type: "lab", title: `طلب مختبر: ${String(input.labName)}`, refType: "lab", refId: id, actorName: ctx.username });
  await writeDentalAudit({ companyId: ctx.companyId, userId: ctx.userId, username: ctx.username, action: "create", entityType: "labOrder", entityId: id, newValues: { labName: input.labName, workType: input.workType } });
  return id;
}

export async function updateLabOrder(ctx: Ctx, id: number, input: Record<string, unknown>) {
  const order = await queryOne<{ patientId: number; status: string }>("SELECT patientId, status FROM DentalLabOrder WHERE id = ? AND companyId = ? LIMIT 1", [id, ctx.companyId]);
  if (!order) throw new Error("الطلب غير موجود");
  const fields: string[] = [];
  const values: unknown[] = [];
  if (input.status !== undefined) { fields.push("status = ?"); values.push(String(input.status)); }
  if (input.expectedDate !== undefined) { fields.push("expectedDate = ?"); values.push(dateOrNull(input.expectedDate)); }
  if (input.shade !== undefined) { fields.push("shade = ?"); values.push(input.shade ? String(input.shade) : null); }
  if (input.notes !== undefined) { fields.push("notes = ?"); values.push(input.notes ? String(input.notes).slice(0, 480) : null); }
  if (!fields.length) return;
  fields.push("updatedAt = NOW()");
  values.push(id, ctx.companyId);
  await execute(`UPDATE DentalLabOrder SET ${fields.join(", ")} WHERE id = ? AND companyId = ?`, values);
  if (input.status !== undefined) {
    await addTimelineEvent({ companyId: ctx.companyId, patientId: Number(order.patientId), type: "lab", title: `حالة المختبر: ${String(input.status)}`, refType: "lab", refId: id, actorName: ctx.username });
  }
  await writeDentalAudit({ companyId: ctx.companyId, userId: ctx.userId, username: ctx.username, action: "update", entityType: "labOrder", entityId: id, oldValues: { status: order.status }, newValues: input });
}

/* ---------------- Inventory ---------------- */
export async function listInventory(companyId: number) {
  const rows = await query<Record<string, unknown>>("SELECT * FROM DentalInventoryItem WHERE companyId = ? ORDER BY name ASC", [companyId]);
  const in60 = new Date(Date.now() + 60 * 24 * 3600 * 1000).toISOString().slice(0, 10);
  const today = new Date().toISOString().slice(0, 10);
  return rows.map((r) => {
    const expiry = safeDate(r.expiryDate);
    return {
      id: Number(r.id), name: String(r.name), sku: r.sku ? String(r.sku) : null, brand: r.brand ? String(r.brand) : null,
      quantity: Number(r.quantity), minQuantity: Number(r.minQuantity), purchasePrice: toMoney(r.purchasePriceCents),
      supplier: r.supplier ? String(r.supplier) : null, batchNumber: r.batchNumber ? String(r.batchNumber) : null,
      expiryDate: expiry, lowStock: Number(r.quantity) <= Number(r.minQuantity),
      expiringSoon: !!expiry && expiry <= in60, expired: !!expiry && expiry < today,
    };
  });
}

export async function createInventoryItem(ctx: Ctx, input: Record<string, unknown>) {
  if (!String(input.name || "").trim()) throw new Error("اسم الصنف مطلوب");
  const result = await execute(
    `INSERT INTO DentalInventoryItem (companyId, name, sku, brand, quantity, minQuantity, purchasePriceCents, supplier, batchNumber, expiryDate, createdByUserId, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
    [
      ctx.companyId, String(input.name).slice(0, 180),
      input.sku ? String(input.sku) : null, input.brand ? String(input.brand) : null,
      Number(input.quantity) || 0, Number(input.minQuantity) || 0, toCents(input.purchasePrice),
      input.supplier ? String(input.supplier) : null, input.batchNumber ? String(input.batchNumber) : null,
      dateOrNull(input.expiryDate), ctx.userId,
    ]
  );
  await writeDentalAudit({ companyId: ctx.companyId, userId: ctx.userId, username: ctx.username, action: "create", entityType: "inventory", entityId: Number(result.insertId), newValues: { name: input.name } });
  return Number(result.insertId);
}

export async function updateInventoryItem(ctx: Ctx, id: number, input: Record<string, unknown>) {
  const fields: string[] = [];
  const values: unknown[] = [];
  const simple: [string, string][] = [["name", "name"], ["sku", "sku"], ["brand", "brand"], ["supplier", "supplier"], ["batchNumber", "batchNumber"]];
  for (const [k, col] of simple) if (input[k] !== undefined) { fields.push(`${col} = ?`); values.push(input[k] ? String(input[k]) : null); }
  if (input.quantity !== undefined) { fields.push("quantity = ?"); values.push(Number(input.quantity) || 0); }
  if (input.minQuantity !== undefined) { fields.push("minQuantity = ?"); values.push(Number(input.minQuantity) || 0); }
  if (input.purchasePrice !== undefined) { fields.push("purchasePriceCents = ?"); values.push(toCents(input.purchasePrice)); }
  if (input.expiryDate !== undefined) { fields.push("expiryDate = ?"); values.push(dateOrNull(input.expiryDate)); }
  if (input.adjust !== undefined) { fields.push("quantity = GREATEST(quantity + ?, 0)"); values.push(Number(input.adjust) || 0); }
  if (!fields.length) return;
  fields.push("updatedAt = NOW()");
  values.push(id, ctx.companyId);
  await execute(`UPDATE DentalInventoryItem SET ${fields.join(", ")} WHERE id = ? AND companyId = ?`, values);
  await writeDentalAudit({ companyId: ctx.companyId, userId: ctx.userId, username: ctx.username, action: "update", entityType: "inventory", entityId: id, newValues: input });
}

/* ---------------- Recall ---------------- */
export async function listRecalls(companyId: number, patientId?: number) {
  const params: number[] = [companyId];
  let sql = `SELECT r.*, p.fullName, p.phone FROM DentalRecall r INNER JOIN DentalPatient p ON p.id = r.patientId WHERE r.companyId = ?`;
  if (patientId) { sql += " AND r.patientId = ?"; params.push(patientId); }
  sql += " ORDER BY r.dueDate ASC LIMIT 300";
  const rows = await query<Record<string, unknown>>(sql, params);
  const today = new Date().toISOString().slice(0, 10);
  return rows.map((r) => {
    let status = String(r.status);
    const due = safeDate(r.dueDate) ?? "";
    if (status === "upcoming" && due) { if (due < today) status = "overdue"; else if (due === today) status = "due"; }
    return {
      id: Number(r.id), patientId: Number(r.patientId), patientName: String(r.fullName || ""), phone: r.phone ? String(r.phone) : null,
      type: String(r.type), dueDate: due, status, assignedTo: r.assignedTo ? String(r.assignedTo) : null,
      nextAction: r.nextAction ? String(r.nextAction) : null, note: r.note ? String(r.note) : null,
    };
  });
}

export async function createRecall(ctx: Ctx, input: Record<string, unknown>) {
  if (!input.patientId) throw new Error("المريض مطلوب");
  if (!input.dueDate) throw new Error("تاريخ الاستحقاق مطلوب");
  const result = await execute(
    `INSERT INTO DentalRecall (companyId, patientId, type, dueDate, status, assignedTo, nextAction, note, createdByUserId, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, 'upcoming', ?, ?, ?, ?, NOW(), NOW())`,
    [
      ctx.companyId, Number(input.patientId), String(input.type || "checkup"), dateOrNull(input.dueDate),
      input.assignedTo ? String(input.assignedTo) : null, input.nextAction ? String(input.nextAction) : null,
      input.note ? String(input.note).slice(0, 480) : null, ctx.userId,
    ]
  );
  await writeDentalAudit({ companyId: ctx.companyId, userId: ctx.userId, username: ctx.username, action: "create", entityType: "recall", entityId: Number(result.insertId), newValues: { type: input.type } });
  return Number(result.insertId);
}

export async function updateRecall(ctx: Ctx, id: number, input: Record<string, unknown>) {
  const row = await queryOne<{ patientId: number }>("SELECT patientId FROM DentalRecall WHERE id = ? AND companyId = ? LIMIT 1", [id, ctx.companyId]);
  if (!row) throw new Error("التذكير غير موجود");
  const fields: string[] = [];
  const values: unknown[] = [];
  if (input.status !== undefined) { fields.push("status = ?"); values.push(String(input.status)); if (String(input.status) === "contacted") { fields.push("lastContact = CURDATE()"); } }
  if (input.dueDate !== undefined) { fields.push("dueDate = ?"); values.push(dateOrNull(input.dueDate)); }
  if (input.nextAction !== undefined) { fields.push("nextAction = ?"); values.push(input.nextAction ? String(input.nextAction) : null); }
  if (input.assignedTo !== undefined) { fields.push("assignedTo = ?"); values.push(input.assignedTo ? String(input.assignedTo) : null); }
  if (!fields.length) return;
  fields.push("updatedAt = NOW()");
  values.push(id, ctx.companyId);
  await execute(`UPDATE DentalRecall SET ${fields.join(", ")} WHERE id = ? AND companyId = ?`, values);
  await writeDentalAudit({ companyId: ctx.companyId, userId: ctx.userId, username: ctx.username, action: "update", entityType: "recall", entityId: id, newValues: input });
}

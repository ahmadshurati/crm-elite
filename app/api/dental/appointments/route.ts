import { NextResponse } from "next/server";
import { createAppointment, ensure, listAppointments, listAppointmentsRange, patientBelongs, requireDental } from "@/lib/dental/data";
import { findConflicts } from "@/lib/dental/services/scheduling";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const ctx = await requireDental();
  if (ctx instanceof NextResponse) return ctx;
  const denied = ensure(ctx, "appointments.manage");
  if (denied) return denied;
  const url = new URL(req.url);
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  if (from && to) {
    const appointments = await listAppointmentsRange(ctx.companyId, from, to);
    return NextResponse.json({ appointments, from, to });
  }
  const date = url.searchParams.get("date") || new Date().toISOString().slice(0, 10);
  const appointments = await listAppointments(ctx.companyId, date);
  return NextResponse.json({ appointments, date });
}

export async function POST(req: Request) {
  const ctx = await requireDental();
  if (ctx instanceof NextResponse) return ctx;
  const denied = ensure(ctx, "appointments.manage");
  if (denied) return denied;
  const body = await req.json().catch(() => ({}));
  const patientId = Number(body.patientId);
  if (!patientId || !(await patientBelongs(ctx.companyId, patientId))) {
    return NextResponse.json({ error: "اختر مريضاً صحيحاً" }, { status: 400 });
  }
  if (!body.startAt) {
    return NextResponse.json({ error: "وقت الموعد مطلوب" }, { status: 400 });
  }
  if (!body.override) {
    const conflicts = await findConflicts(ctx.companyId, {
      startAt: new Date(String(body.startAt)),
      durationMin: Number(body.durationMin) || 30,
      doctorName: body.doctorName ? String(body.doctorName) : null,
      room: body.room ? String(body.room) : null,
    });
    if (conflicts.length) {
      return NextResponse.json({ error: "تعارض في الموعد", conflicts }, { status: 409 });
    }
  }
  await createAppointment(ctx, body);
  return NextResponse.json({ ok: true });
}

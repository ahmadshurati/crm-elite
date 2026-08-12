import { NextResponse } from "next/server";
import { createAppointment, listAppointments, patientBelongs, requireDental } from "@/lib/dental/data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const ctx = await requireDental();
  if (ctx instanceof NextResponse) return ctx;
  const url = new URL(req.url);
  const date = url.searchParams.get("date") || new Date().toISOString().slice(0, 10);
  const appointments = await listAppointments(ctx.companyId, date);
  return NextResponse.json({ appointments, date });
}

export async function POST(req: Request) {
  const ctx = await requireDental();
  if (ctx instanceof NextResponse) return ctx;
  const body = await req.json().catch(() => ({}));
  const patientId = Number(body.patientId);
  if (!patientId || !(await patientBelongs(ctx.companyId, patientId))) {
    return NextResponse.json({ error: "اختر مريضاً صحيحاً" }, { status: 400 });
  }
  if (!body.startAt) {
    return NextResponse.json({ error: "وقت الموعد مطلوب" }, { status: 400 });
  }
  await createAppointment(ctx.companyId, body);
  return NextResponse.json({ ok: true });
}

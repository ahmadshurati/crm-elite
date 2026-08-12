import { NextResponse } from "next/server";
import { ensure, requireDental, updateAppointmentStatus } from "@/lib/dental/data";
import { findConflicts, rescheduleAppointment } from "@/lib/dental/services/scheduling";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VALID = ["scheduled", "confirmed", "arrived", "waiting", "in_treatment", "completed", "cancelled", "no_show"];

export async function PATCH(req: Request, context: { params: Promise<{ id: string }> }) {
  const ctx = await requireDental();
  if (ctx instanceof NextResponse) return ctx;
  const denied = ensure(ctx, "appointments.manage");
  if (denied) return denied;
  const { id } = await context.params;
  const body = await req.json().catch(() => ({}));

  // Reschedule path
  if (body.startAt) {
    if (!body.override) {
      const conflicts = await findConflicts(ctx.companyId, {
        startAt: new Date(String(body.startAt)),
        durationMin: Number(body.durationMin) || 30,
        doctorName: body.doctorName ? String(body.doctorName) : null,
        room: body.room ? String(body.room) : null,
        excludeId: Number(id),
      });
      if (conflicts.length) {
        return NextResponse.json({ error: "تعارض في الموعد", conflicts }, { status: 409 });
      }
    }
    try {
      await rescheduleAppointment(ctx, Number(id), body);
      return NextResponse.json({ ok: true });
    } catch (error: unknown) {
      return NextResponse.json({ error: error instanceof Error ? error.message : "تعذّر التحديث" }, { status: 400 });
    }
  }

  // Status path
  const status = String(body.status || "");
  if (!VALID.includes(status)) {
    return NextResponse.json({ error: "حالة غير صحيحة" }, { status: 400 });
  }
  try {
    await updateAppointmentStatus(ctx, Number(id), status);
    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "تعذّر التحديث";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

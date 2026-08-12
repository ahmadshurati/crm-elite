import { NextResponse } from "next/server";
import { ensure, getPatientProfile, patientBelongs, requireDental, updatePatientPersonal } from "@/lib/dental/data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: Request, context: { params: Promise<{ id: string }> }) {
  const ctx = await requireDental();
  if (ctx instanceof NextResponse) return ctx;
  const denied = ensure(ctx, "patients.view");
  if (denied) return denied;
  const { id } = await context.params;
  const profile = await getPatientProfile(ctx.companyId, Number(id));
  if (!profile) return NextResponse.json({ error: "المريض غير موجود" }, { status: 404 });
  return NextResponse.json(profile);
}

export async function PATCH(req: Request, context: { params: Promise<{ id: string }> }) {
  const ctx = await requireDental();
  if (ctx instanceof NextResponse) return ctx;
  const denied = ensure(ctx, "patients.edit");
  if (denied) return denied;
  const { id } = await context.params;
  const patientId = Number(id);
  if (!(await patientBelongs(ctx.companyId, patientId))) {
    return NextResponse.json({ error: "المريض غير موجود" }, { status: 404 });
  }
  const body = await req.json().catch(() => ({}));
  await updatePatientPersonal(ctx, patientId, body);
  return NextResponse.json({ ok: true });
}

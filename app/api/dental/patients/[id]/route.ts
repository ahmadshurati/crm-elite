import { NextResponse } from "next/server";
import { ensure, getPatientProfile, requireDental } from "@/lib/dental/data";

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

import { NextResponse } from "next/server";
import { ensure, requireDental } from "@/lib/dental/data";
import { createRecall, listRecalls } from "@/lib/dental/services/clinic-ops";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const ctx = await requireDental();
  if (ctx instanceof NextResponse) return ctx;
  const denied = ensure(ctx, "patients.view");
  if (denied) return denied;
  const patientId = new URL(req.url).searchParams.get("patientId");
  const recalls = await listRecalls(ctx.companyId, patientId ? Number(patientId) : undefined);
  return NextResponse.json({ recalls });
}

export async function POST(req: Request) {
  const ctx = await requireDental();
  if (ctx instanceof NextResponse) return ctx;
  const denied = ensure(ctx, "appointments.manage");
  if (denied) return denied;
  const body = await req.json().catch(() => ({}));
  try {
    const id = await createRecall(ctx, body);
    return NextResponse.json({ ok: true, id });
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "تعذّرت العملية" }, { status: 400 });
  }
}

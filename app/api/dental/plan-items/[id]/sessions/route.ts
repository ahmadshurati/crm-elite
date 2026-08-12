import { NextResponse } from "next/server";
import { ensure, requireDental } from "@/lib/dental/data";
import { addSession, listSessions } from "@/lib/dental/services/treatments";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: Request, context: { params: Promise<{ id: string }> }) {
  const ctx = await requireDental();
  if (ctx instanceof NextResponse) return ctx;
  const denied = ensure(ctx, "patients.view");
  if (denied) return denied;
  const { id } = await context.params;
  const sessions = await listSessions(ctx.companyId, Number(id));
  return NextResponse.json({ sessions });
}

export async function POST(req: Request, context: { params: Promise<{ id: string }> }) {
  const ctx = await requireDental();
  if (ctx instanceof NextResponse) return ctx;
  const denied = ensure(ctx, "treatments.create");
  if (denied) return denied;
  const { id } = await context.params;
  const body = await req.json().catch(() => ({}));
  try {
    const sessionNumber = await addSession(ctx, Number(id), body);
    return NextResponse.json({ ok: true, sessionNumber });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "تعذّرت الإضافة";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

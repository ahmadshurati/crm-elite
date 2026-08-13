import { NextResponse } from "next/server";
import { ensure, requireDental } from "@/lib/dental/data";
import { createClinicOption, listClinicOptions, listClinicOptionsManage } from "@/lib/dental/services/clinic-ops";
import { listCatalog } from "@/lib/dental/services/treatments";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const ctx = await requireDental();
  if (ctx instanceof NextResponse) return ctx;
  const manage = new URL(req.url).searchParams.get("manage") === "1";
  if (manage) {
    const denied = ensure(ctx, "settings.manage");
    if (denied) return denied;
    return NextResponse.json({ options: await listClinicOptionsManage(ctx.companyId) });
  }
  const denied = ensure(ctx, "appointments.manage");
  if (denied) return denied;
  try {
    const [opts, catalog] = await Promise.all([listClinicOptions(ctx.companyId), listCatalog(ctx.companyId)]);
    return NextResponse.json({ doctors: opts.doctors, rooms: opts.rooms, treatments: catalog.map((c) => ({ id: c.id, name: c.name, defaultPrice: c.defaultPrice })) });
  } catch (error) {
    console.error("GET /api/dental/clinic-options error:", error);
    return NextResponse.json({ doctors: [], rooms: [], treatments: [] });
  }
}

export async function POST(req: Request) {
  const ctx = await requireDental();
  if (ctx instanceof NextResponse) return ctx;
  const denied = ensure(ctx, "settings.manage");
  if (denied) return denied;
  const body = await req.json().catch(() => ({}));
  try {
    const id = await createClinicOption(ctx, String(body.kind || ""), String(body.name || ""));
    return NextResponse.json({ ok: true, id });
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "تعذّرت الإضافة" }, { status: 400 });
  }
}

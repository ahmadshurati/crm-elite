import { NextResponse } from "next/server";
import { ensure, requireDental } from "@/lib/dental/data";
import { createCatalog, listCatalog } from "@/lib/dental/services/treatments";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const ctx = await requireDental();
  if (ctx instanceof NextResponse) return ctx;
  const includeInactive = new URL(req.url).searchParams.get("all") === "1" && ctx.can("settings.manage");
  const items = await listCatalog(ctx.companyId, includeInactive);
  return NextResponse.json({ items });
}

export async function POST(req: Request) {
  const ctx = await requireDental();
  if (ctx instanceof NextResponse) return ctx;
  const denied = ensure(ctx, "settings.manage");
  if (denied) return denied;
  const body = await req.json().catch(() => ({}));
  try {
    const id = await createCatalog(ctx, body);
    return NextResponse.json({ ok: true, id });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "تعذّرت الإضافة";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

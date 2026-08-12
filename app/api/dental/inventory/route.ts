import { NextResponse } from "next/server";
import { ensure, requireDental } from "@/lib/dental/data";
import { createInventoryItem, listInventory } from "@/lib/dental/services/clinic-ops";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const ctx = await requireDental();
  if (ctx instanceof NextResponse) return ctx;
  const denied = ensure(ctx, "patients.view");
  if (denied) return denied;
  const items = await listInventory(ctx.companyId);
  return NextResponse.json({ items });
}

export async function POST(req: Request) {
  const ctx = await requireDental();
  if (ctx instanceof NextResponse) return ctx;
  const denied = ensure(ctx, "inventory.manage");
  if (denied) return denied;
  const body = await req.json().catch(() => ({}));
  try {
    const id = await createInventoryItem(ctx, body);
    return NextResponse.json({ ok: true, id });
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "تعذّرت العملية" }, { status: 400 });
  }
}

import { NextResponse } from "next/server";
import { ensure, requireDental } from "@/lib/dental/data";
import { createStaff, listStaff } from "@/lib/dental/services/staff";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const ctx = await requireDental();
  if (ctx instanceof NextResponse) return ctx;
  const denied = ensure(ctx, "users.manage");
  if (denied) return denied;
  const staff = await listStaff(ctx.companyId);
  return NextResponse.json({ staff });
}

export async function POST(req: Request) {
  const ctx = await requireDental();
  if (ctx instanceof NextResponse) return ctx;
  const denied = ensure(ctx, "users.manage");
  if (denied) return denied;
  const body = await req.json().catch(() => ({}));
  try {
    const id = await createStaff(ctx, { username: String(body.username || ""), password: String(body.password || ""), dentalRole: String(body.dentalRole || "") });
    return NextResponse.json({ ok: true, id });
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "تعذّرت العملية" }, { status: 400 });
  }
}

import { NextResponse } from "next/server";
import { requireDental } from "@/lib/dental/data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const ctx = await requireDental();
  if (ctx instanceof NextResponse) return ctx;
  return NextResponse.json({ username: ctx.username, clinicName: ctx.clinicName, companyId: ctx.companyId });
}

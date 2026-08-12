import { NextResponse } from "next/server";
import { getDashboard, requireDental } from "@/lib/dental/data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const ctx = await requireDental();
  if (ctx instanceof NextResponse) return ctx;
  try {
    const data = await getDashboard(ctx.companyId);
    return NextResponse.json(data);
  } catch (error: unknown) {
    console.error("GET /api/dental/dashboard error:", error);
    return NextResponse.json({ error: "تعذّر تحميل اللوحة" }, { status: 500 });
  }
}

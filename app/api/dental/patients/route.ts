import { NextResponse } from "next/server";
import { createPatient, listPatients, requireDental } from "@/lib/dental/data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const ctx = await requireDental();
  if (ctx instanceof NextResponse) return ctx;
  const url = new URL(req.url);
  const patients = await listPatients(ctx.companyId, url.searchParams.get("q") || "");
  return NextResponse.json({ patients });
}

export async function POST(req: Request) {
  const ctx = await requireDental();
  if (ctx instanceof NextResponse) return ctx;
  try {
    const body = await req.json().catch(() => ({}));
    if (!String(body.fullName || "").trim()) {
      return NextResponse.json({ error: "اسم المريض مطلوب" }, { status: 400 });
    }
    const created = await createPatient(ctx.companyId, body);
    return NextResponse.json({ ok: true, ...created });
  } catch (error: unknown) {
    console.error("POST /api/dental/patients error:", error);
    return NextResponse.json({ error: "تعذّر إنشاء المريض" }, { status: 500 });
  }
}

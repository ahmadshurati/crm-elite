import { NextResponse } from "next/server";
import { createLead } from "@/lib/leads";
import { enforceApiRateLimit } from "@/lib/api-rate-limit";
import { getClientIp } from "@/lib/request-meta";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const limited = enforceApiRateLimit(req, "leads", 12, 60 * 1000);
  if (limited) return limited;

  try {
    const body = await req.json().catch(() => ({}));
    const name = String(body.name || "").trim();
    const phone = String(body.phone || "").trim();

    if (!name || name.length < 2) {
      return NextResponse.json({ error: "الاسم مطلوب" }, { status: 400 });
    }
    if (!phone || phone.replace(/\D/g, "").length < 6) {
      return NextResponse.json({ error: "رقم هاتف صحيح مطلوب" }, { status: 400 });
    }

    await createLead({
      name,
      phone,
      email: body.email ? String(body.email) : null,
      businessName: body.businessName ? String(body.businessName) : null,
      note: body.note ? String(body.note) : null,
      shopCode: body.ref ? String(body.ref) : null,
      ipAddress: getClientIp(req),
    });

    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    console.error("POST /api/leads error:", error);
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: "تعذّر إرسال البيانات", message }, { status: 500 });
  }
}

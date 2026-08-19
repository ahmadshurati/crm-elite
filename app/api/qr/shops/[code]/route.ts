import { NextResponse } from "next/server";
import { requirePlatformOwner, isPlatformErrorResponse } from "@/lib/platform-auth";
import { getOwnerShopLeads, getReferralStats } from "@/lib/leads";
import { updateShop } from "@/lib/referral-shops";
import { loggedRoute } from "@/lib/api-observability";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function handleGet(req: Request, context: { params: Promise<{ code: string }> }) {
  const auth = await requirePlatformOwner();
  if (isPlatformErrorResponse(auth)) return auth;

  try {
    const { code } = await context.params;
    const url = new URL(req.url);
    const range = { from: url.searchParams.get("from"), to: url.searchParams.get("to") };
    const [stats, leads] = await Promise.all([
      getReferralStats(code, range),
      getOwnerShopLeads(code, range),
    ]);
    // owner sees full (unmasked) lead details with ids for status management
    return NextResponse.json({ ...stats, items: leads });
  } catch (error: unknown) {
    console.error("GET /api/qr/shops/[code] error:", error);
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: "تعذّر تحميل بيانات الزبون", message }, { status: 500 });
  }
}

async function handlePatch(req: Request, context: { params: Promise<{ code: string }> }) {
  const auth = await requirePlatformOwner();
  if (isPlatformErrorResponse(auth)) return auth;

  const { code } = await context.params;
  const body = await req.json().catch(() => ({}));
  try {
    const result = await updateShop(code, {
      name: body.name,
      ownerName: body.ownerName,
      contactPhone: body.contactPhone,
      email: body.email,
      username: body.username,
      password: body.password,
      commissionAmount: body.commissionAmount,
    });
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    console.error("PATCH /api/qr/shops/[code] error:", error);
    return NextResponse.json({ error: "تعذّر حفظ التعديلات" }, { status: 500 });
  }
}

export const GET = loggedRoute("GET /api/qr/shops/[code]", handleGet);
export const PATCH = loggedRoute("PATCH /api/qr/shops/[code]", handlePatch);

import { NextResponse } from "next/server";
import { requirePlatformOwner, isPlatformErrorResponse } from "@/lib/platform-auth";
import { createShop, listShopsWithCounts, usernameExists } from "@/lib/referral-shops";
import { loggedRoute } from "@/lib/api-observability";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function handleGet() {
  const auth = await requirePlatformOwner();
  if (isPlatformErrorResponse(auth)) return auth;

  const shops = await listShopsWithCounts();
  return NextResponse.json({ shops });
}

async function handlePost(req: Request) {
  const auth = await requirePlatformOwner();
  if (isPlatformErrorResponse(auth)) return auth;

  try {
    const body = await req.json().catch(() => ({}));
    const name = String(body.name || "").trim();
    const username = String(body.username || "").trim().toLowerCase();
    const password = String(body.password || "").trim();

    if (!name) return NextResponse.json({ error: "اسم الزبون مطلوب" }, { status: 400 });
    if (!username || username.length < 3)
      return NextResponse.json({ error: "اسم مستخدم صحيح مطلوب (3 أحرف على الأقل)" }, { status: 400 });
    if (!password || password.length < 6)
      return NextResponse.json({ error: "كلمة مرور 6 أحرف على الأقل مطلوبة" }, { status: 400 });

    if (await usernameExists(username)) {
      return NextResponse.json({ error: "اسم المستخدم مستخدم مسبقاً" }, { status: 409 });
    }

    const shop = await createShop({
      name,
      ownerName: body.ownerName ? String(body.ownerName) : null,
      contactPhone: body.contactPhone ? String(body.contactPhone) : null,
      email: body.email ? String(body.email) : null,
      username,
      password,
      commissionAmount: Number(body.commissionAmount) || 0,
    });

    return NextResponse.json({ ok: true, code: shop.code });
  } catch (error: unknown) {
    console.error("POST /api/qr/shops error:", error);
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: "تعذّر إنشاء الزبون", message }, { status: 500 });
  }
}

export const GET = loggedRoute("GET /api/qr/shops", handleGet);
export const POST = loggedRoute("POST /api/qr/shops", handlePost);

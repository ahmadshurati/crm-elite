import { NextResponse } from "next/server";
import { getShopAccountByUsername } from "@/lib/referral-shops";
import { verifyPassword } from "@/lib/password";
import { createShopToken, SHOP_COOKIE, shopCookieOptions } from "@/lib/referral-auth";
import { enforceApiRateLimit } from "@/lib/api-rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const limited = enforceApiRateLimit(req, "referral-login", 10, 15 * 60 * 1000);
  if (limited) return limited;

  try {
    const body = await req.json().catch(() => ({}));
    const username = String(body.username || "").trim().toLowerCase();
    const password = String(body.password || "").trim();

    if (!username || !password) {
      return NextResponse.json({ error: "اسم المستخدم وكلمة المرور مطلوبان" }, { status: 400 });
    }

    const account = await getShopAccountByUsername(username);
    if (!account || !account.passwordHash || Number(account.isActive) !== 1) {
      return NextResponse.json({ error: "بيانات الدخول غير صحيحة" }, { status: 401 });
    }

    const ok = await verifyPassword(password, account.passwordHash);
    if (!ok) {
      return NextResponse.json({ error: "بيانات الدخول غير صحيحة" }, { status: 401 });
    }

    const token = await createShopToken(account.id, account.code);
    const res = NextResponse.json({ ok: true, code: account.code, name: account.name });
    res.cookies.set(SHOP_COOKIE, token, shopCookieOptions());
    return res;
  } catch (error: unknown) {
    console.error("POST /api/referral/login error:", error);
    return NextResponse.json({ error: "تعذّر تسجيل الدخول" }, { status: 500 });
  }
}

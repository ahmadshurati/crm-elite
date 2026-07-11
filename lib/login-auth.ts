import { NextResponse } from "next/server";
import { execute, queryOne } from "@/lib/db";
import { upgradePasswordIfNeeded, verifyPassword } from "@/lib/password";
import { checkRateLimit, resetRateLimit } from "@/lib/rate-limit";
import { getClientIp, getUserAgent } from "@/lib/request-meta";
import { verifyTotpCode } from "@/lib/totp";
import {
  clearLegacyAuthCookies,
  createSessionToken,
  SESSION_COOKIE,
  sessionCookieOptions,
} from "@/lib/session";
import { loggedRoute } from "@/lib/api-observability";
import { PLATFORM_OWNER_ROLE } from "@/lib/tenant";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type AuthUser = {
  id: number;
  username: string;
  password: string;
  role: string;
  isActive: boolean | number;
  companyId: number | null;
  companyIsActive: boolean | number | null;
  totpEnabled: boolean | number;
  totpSecret: string | null;
};

function clean(value: unknown) {
  return String(value || "").trim().toLowerCase();
}

async function loadUser(username: string) {
  return queryOne<AuthUser>(
    `SELECT u.id, u.username, u.password, u.role, u.isActive, u.companyId, u.totpEnabled, u.totpSecret,
            c.isActive AS companyIsActive
     FROM AppUser u
     LEFT JOIN Company c ON c.id = u.companyId
     WHERE u.username = ? LIMIT 1`,
    [username]
  );
}

async function authenticate(req: Request, expected: "tenant" | "platform_owner") {
  const body = await req.json();
  const username = clean(body.username);
  const password = String(body.password || "").trim();
  const ipAddress = getClientIp(req);
  const userAgent = getUserAgent(req);
  const rateKey = `login:${expected}:${ipAddress}:${username || "unknown"}`;
  const rate = checkRateLimit(rateKey, 8, 15 * 60 * 1000);

  if (!rate.allowed) {
    return NextResponse.json(
      { error: "Too many login attempts. Try again later.", retryAfterMs: rate.retryAfterMs },
      { status: 429 }
    );
  }

  const user = await loadUser(username);

  if (!user || Number(user.isActive) !== 1) {
    return NextResponse.json({ error: "Invalid login" }, { status: 401 });
  }

  if (expected === "tenant" && user.role === PLATFORM_OWNER_ROLE) {
    return NextResponse.json({ error: "Use the admin portal login at /admin/login" }, { status: 403 });
  }

  if (expected === "platform_owner" && user.role !== PLATFORM_OWNER_ROLE) {
    return NextResponse.json({ error: "Invalid admin login" }, { status: 401 });
  }

  if (expected === "tenant") {
    if (!user.companyId) {
      return NextResponse.json({ error: "Invalid login" }, { status: 401 });
    }
    if (Number(user.companyIsActive) !== 1) {
      return NextResponse.json({ error: "Company account is inactive" }, { status: 403 });
    }
  }

  const validPassword = await verifyPassword(password, user.password);
  if (!validPassword) {
    return NextResponse.json({ error: "Invalid login" }, { status: 401 });
  }

  await upgradePasswordIfNeeded(user.id, password, user.password);

  if (Number(user.totpEnabled) === 1 && user.totpSecret) {
    const totpCode = String(body.totpCode || "").trim();
    if (!totpCode) {
      return NextResponse.json({ requires2fa: true, error: "2FA code required" }, { status: 401 });
    }
    if (!verifyTotpCode(user.totpSecret, totpCode)) {
      return NextResponse.json({ error: "Invalid 2FA code" }, { status: 401 });
    }
  }

  resetRateLimit(rateKey);

  try {
    await execute(
      `INSERT INTO ActivityLog (userId, username, action, module, targetId, details, ipAddress, userAgent, createdAt)
       VALUES (?, ?, ?, ?, NULL, ?, ?, ?, NOW())`,
      [
        user.id,
        user.username,
        expected === "platform_owner" ? "تسجيل دخول المنصة" : "تسجيل دخول",
        expected === "platform_owner" ? "المنصة" : "النظام",
        expected === "platform_owner" ? "دخول لوحة إدارة Gosol" : "تم تسجيل الدخول للنظام",
        ipAddress,
        userAgent,
      ]
    );
  } catch (logError) {
    console.error("Login activity log failed:", logError);
  }

  const token = await createSessionToken(user.id, user.username, user.role);
  const res = NextResponse.json({
    ok: true,
    redirectTo: expected === "platform_owner" ? "/admin" : "/",
  });

  clearLegacyAuthCookies(res);
  res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions());
  return res;
}

export async function tenantLogin(req: Request) {
  return authenticate(req, "tenant");
}

export async function platformLogin(req: Request) {
  return authenticate(req, "platform_owner");
}

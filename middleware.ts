import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { logInfo } from "@/lib/logger";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/session";

export async function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname;

  const isPublic =
    path.startsWith("/login") ||
    path.startsWith("/admin/login") ||
    path.startsWith("/form") ||
    path.startsWith("/clientdashboard") ||
    path.startsWith("/api/login") ||
    path.startsWith("/api/admin/login") ||
    path.startsWith("/api/logout") ||
    path.startsWith("/api/ping") ||
    path.startsWith("/api/health") ||
    path.startsWith("/api/leads") ||
    path.startsWith("/api/referral/") ||
    path.startsWith("/api/cron/") ||
    path.startsWith("/api/webhooks/") ||
    path.startsWith("/api/dental/whatsapp/webhook") ||
    path.startsWith("/_next") ||
    path.startsWith("/favicon") ||
    path.startsWith("/logo") ||
    path.startsWith("/loag") ||
    path.startsWith("/gosol") ||
    path.startsWith("/uploads");

  if (isPublic) {
    return NextResponse.next();
  }

  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const session = token ? await verifySessionToken(token) : null;
  const isAdminArea = path === "/admin" || path.startsWith("/admin/");
  const isQrArea = path === "/qrdashboard" || path.startsWith("/qrdashboard") || path.startsWith("/api/qr/");
  const isOwnerArea = isAdminArea || isQrArea;
  const isPlatformOwner = session?.role === "platform_owner";

  if (!session && path.startsWith("/api/v1/")) {
    const hasApiKey = req.headers.get("x-api-key") || req.headers.get("authorization");
    if (hasApiKey) {
      return NextResponse.next();
    }
    return NextResponse.json({ error: "Valid API key required" }, { status: 401 });
  }

  if (!session) {
    if (path.startsWith("/api/")) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    if (isOwnerArea) {
      return NextResponse.redirect(new URL("/admin/login", req.url));
    }

    return NextResponse.redirect(new URL("/login", req.url));
  }

  if (isOwnerArea && !isPlatformOwner) {
    if (path.startsWith("/api/")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return NextResponse.redirect(new URL("/", req.url));
  }

  if (!isOwnerArea && isPlatformOwner && !path.startsWith("/api/platform/")) {
    if (path.startsWith("/api/")) {
      return NextResponse.json({ error: "Use the admin portal" }, { status: 403 });
    }
    return NextResponse.redirect(new URL("/admin", req.url));
  }

  if (path.startsWith("/api/")) {
    logInfo("api.access", {
      path,
      method: req.method,
      userId: session.userId,
      role: session.role,
    });
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!.*\\..*).*)"],
};

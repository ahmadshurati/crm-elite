import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { logInfo } from "@/lib/logger";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/session";

export async function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname;

  const isPublic =
    path.startsWith("/login") ||
    path.startsWith("/api/login") ||
    path.startsWith("/api/logout") ||
    path.startsWith("/api/ping") ||
    path.startsWith("/_next") ||
    path.startsWith("/favicon") ||
    path.startsWith("/logo") ||
    path.startsWith("/loag") ||
    path.startsWith("/uploads");

  if (isPublic) {
    return NextResponse.next();
  }

  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const session = token ? await verifySessionToken(token) : null;

  if (!session) {
    if (path.startsWith("/api/")) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    return NextResponse.redirect(new URL("/login", req.url));
  }

  if (path.startsWith("/api/")) {
    logInfo("api.access", {
      path,
      method: req.method,
      userId: session.userId,
    });
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!.*\\..*).*)"],
};

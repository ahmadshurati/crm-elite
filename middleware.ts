import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname;

  const isPublic =
    path.startsWith("/login") ||
    path.startsWith("/api/login") ||
    path.startsWith("/api/logout") ||
    path.startsWith("/api/debug-db") ||
    path.startsWith("/api/debug-users") ||
    path.startsWith("/api/ping") ||
    path.startsWith("/_next") ||
    path.startsWith("/favicon") ||
    path.startsWith("/logo") ||
    path.startsWith("/loag") ||
    path.startsWith("/uploads");

  if (isPublic) {
    return NextResponse.next();
  }

  const auth = req.cookies.get("elite_auth")?.value;
  const userId = req.cookies.get("elite_user_id")?.value;

  if (auth !== "yes" || !userId) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!.*\\..*).*)"],
};

import { NextResponse } from "next/server";
import { execute, queryOne } from "@/lib/db";
import { upgradePasswordIfNeeded, verifyPassword } from "@/lib/password";
import { ensureSeedUsersFromEnv } from "@/lib/seed-users";
import {
  clearLegacyAuthCookies,
  createSessionToken,
  SESSION_COOKIE,
  sessionCookieOptions,
} from "@/lib/session";
import { loggedRoute } from "@/lib/api-observability";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type LoginUser = {
  id: number;
  username: string;
  password: string;
  isActive: boolean | number;
};

function clean(value: unknown) {
  return String(value || "").trim().toLowerCase();
}

async function handleGet() {
  return NextResponse.json({ ok: true, route: "login" });
}

async function handlePost(req: Request) {
  try {
    try {
      await ensureSeedUsersFromEnv();
    } catch (seedError) {
      console.error("ensureSeedUsersFromEnv failed (login continues):", seedError);
    }

    const body = await req.json();
    const username = clean(body.username);
    const password = String(body.password || "").trim();

    const user = await queryOne<LoginUser>(
      "SELECT id, username, password, isActive FROM AppUser WHERE username = ? LIMIT 1",
      [username]
    );

    if (!user || Number(user.isActive) !== 1) {
      return NextResponse.json({ error: "Invalid login" }, { status: 401 });
    }

    const validPassword = await verifyPassword(password, user.password);

    if (!validPassword) {
      return NextResponse.json({ error: "Invalid login" }, { status: 401 });
    }

    await upgradePasswordIfNeeded(user.id, password, user.password);

    try {
      await execute(
        `INSERT INTO ActivityLog (userId, username, action, module, targetId, details, createdAt)
         VALUES (?, ?, ?, ?, NULL, ?, NOW())`,
        [user.id, user.username, "تسجيل دخول", "النظام", "تم تسجيل الدخول للنظام"]
      );
    } catch (logError) {
      console.error("Login activity log failed:", logError);
    }

    const token = await createSessionToken(user.id, user.username);
    const res = NextResponse.json({ ok: true });

    clearLegacyAuthCookies(res);
    res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions());

    return res;
  } catch (error: any) {
    console.error("POST /api/login error:", error);
    return NextResponse.json({ error: "Login failed" }, { status: 500 });
  }
}

export const GET = loggedRoute("GET /api/login", handleGet);
export const POST = loggedRoute("POST /api/login", handlePost);

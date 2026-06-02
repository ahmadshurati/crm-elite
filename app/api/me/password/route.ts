import { NextResponse } from "next/server";
import { writeActivityLog } from "@/lib/audit-log";
import { execute, queryOne } from "@/lib/db";
import { hashPassword, verifyPassword } from "@/lib/password";
import { isErrorResponse, requireUser } from "@/lib/permissions";
import {
  clearLegacyAuthCookies,
  createSessionToken,
  SESSION_COOKIE,
  sessionCookieOptions,
} from "@/lib/session";
import { loggedRoute } from "@/lib/api-observability";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function handlePatch(req: Request) {
  const auth = await requireUser();
  if (isErrorResponse(auth)) return auth;
  const { user: currentUser } = auth;

  try {
    const body = await req.json();
    const currentPassword = String(body.currentPassword || "");
    const newPassword = String(body.newPassword || "").trim();

    if (!currentPassword) {
      return NextResponse.json({ error: "Current password is required" }, { status: 400 });
    }

    if (newPassword.length < 8) {
      return NextResponse.json({ error: "New password must be at least 8 characters" }, { status: 400 });
    }

    const user = await queryOne<{ id: number; username: string; password: string }>(
      "SELECT id, username, password FROM AppUser WHERE id = ? LIMIT 1",
      [currentUser.id]
    );

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const validPassword = await verifyPassword(currentPassword, user.password);
    if (!validPassword) {
      return NextResponse.json({ error: "Current password is incorrect" }, { status: 401 });
    }

    const hashedPassword = await hashPassword(newPassword);
    await execute("UPDATE AppUser SET password = ?, updatedAt = NOW() WHERE id = ?", [
      hashedPassword,
      user.id,
    ]);

    await writeActivityLog(currentUser, "تغيير كلمة المرور", "النظام", "تم تغيير كلمة المرور");

    const token = await createSessionToken(user.id, user.username);
    const res = NextResponse.json({ ok: true });

    clearLegacyAuthCookies(res);
    res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions());

    return res;
  } catch (error: any) {
    console.error("PATCH /api/me/password error:", error);
    return NextResponse.json({ error: "Failed to change password", message: error?.message }, { status: 500 });
  }
}

export const PATCH = loggedRoute("PATCH /api/me/password", handlePatch);

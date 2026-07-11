import { NextResponse } from "next/server";
import { verifyPassword } from "@/lib/password";
import { execute, queryOne } from "@/lib/db";
import { isErrorResponse, requireUser } from "@/lib/permissions";
import { loggedRoute } from "@/lib/api-observability";
import { verifyTotpCode } from "@/lib/totp";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function handlePost(req: Request) {
  const auth = await requireUser();
  if (isErrorResponse(auth)) return auth;

  const body = await req.json();
  const password = String(body.password || "");
  const code = String(body.code || "").trim();

  const user = await queryOne<{ password: string; totpSecret: string | null }>(
    "SELECT password, totpSecret FROM AppUser WHERE id = ? LIMIT 1",
    [auth.user.id]
  );

  if (!user?.totpSecret) {
    return NextResponse.json({ error: "2FA is not enabled" }, { status: 400 });
  }

  const validPassword = await verifyPassword(password, user.password);
  if (!validPassword || !verifyTotpCode(user.totpSecret, code)) {
    return NextResponse.json({ error: "Invalid password or code" }, { status: 401 });
  }

  await execute(
    "UPDATE AppUser SET totpEnabled = false, totpSecret = NULL, updatedAt = NOW() WHERE id = ?",
    [auth.user.id]
  );

  return NextResponse.json({ ok: true, totpEnabled: false });
}

export const POST = loggedRoute("POST /api/me/2fa/disable", handlePost);

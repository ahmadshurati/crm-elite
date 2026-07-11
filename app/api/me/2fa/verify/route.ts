import { NextResponse } from "next/server";
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
  const code = String(body.code || "").trim();

  const user = await queryOne<{ totpSecret: string | null; totpEnabled: boolean | number }>(
    "SELECT totpSecret, totpEnabled FROM AppUser WHERE id = ? LIMIT 1",
    [auth.user.id]
  );

  if (!user?.totpSecret) {
    return NextResponse.json({ error: "Run setup first" }, { status: 400 });
  }

  if (!verifyTotpCode(user.totpSecret, code)) {
    return NextResponse.json({ error: "Invalid code" }, { status: 400 });
  }

  await execute("UPDATE AppUser SET totpEnabled = true, updatedAt = NOW() WHERE id = ?", [auth.user.id]);

  return NextResponse.json({ ok: true, totpEnabled: true });
}

export const POST = loggedRoute("POST /api/me/2fa/verify", handlePost);

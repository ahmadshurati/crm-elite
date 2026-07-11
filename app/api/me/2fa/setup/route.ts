import { NextResponse } from "next/server";
import { execute, queryOne } from "@/lib/db";
import { isErrorResponse, requireUser } from "@/lib/permissions";
import { loggedRoute } from "@/lib/api-observability";
import { buildTotpUri, generateTotpSecret } from "@/lib/totp";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function handlePost() {
  const auth = await requireUser();
  if (isErrorResponse(auth)) return auth;

  const user = await queryOne<{ totpEnabled: boolean | number }>(
    "SELECT totpEnabled FROM AppUser WHERE id = ? LIMIT 1",
    [auth.user.id]
  );

  if (user && Number(user.totpEnabled) === 1) {
    return NextResponse.json({ error: "2FA already enabled" }, { status: 400 });
  }

  const secret = generateTotpSecret();
  await execute("UPDATE AppUser SET totpSecret = ?, updatedAt = NOW() WHERE id = ?", [
    secret,
    auth.user.id,
  ]);

  return NextResponse.json({
    secret,
    otpauthUrl: buildTotpUri(auth.user.username, secret),
    message: "Scan the otpauth URL in Google Authenticator, then verify with a code.",
  });
}

export const POST = loggedRoute("POST /api/me/2fa/setup", handlePost);

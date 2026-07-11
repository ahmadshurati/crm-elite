import { SignJWT, jwtVerify } from "jose";
import { PLATFORM_OWNER_ROLE } from "@/lib/tenant";

export const SESSION_COOKIE = "elite_session";
export type SessionRole = "platform_owner" | "tenant";

export type SessionPayload = {
  userId: number;
  username: string;
  role: SessionRole;
};
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 2;

function getSessionSecret() {
  const secret = process.env.SESSION_SECRET;

  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("SESSION_SECRET is required in production");
    }

    return "dev-only-session-secret-change-me";
  }

  return secret;
}

function secretKey() {
  return new TextEncoder().encode(getSessionSecret());
}

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  };
}

export async function createSessionToken(userId: number, username: string, role: string) {
  const sessionRole: SessionRole = role === PLATFORM_OWNER_ROLE ? "platform_owner" : "tenant";

  return new SignJWT({ username, role: sessionRole })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(String(userId))
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE_SECONDS}s`)
    .sign(secretKey());
}

export async function verifySessionToken(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey());
    const userId = Number(payload.sub);

    if (!Number.isFinite(userId) || userId <= 0) {
      return null;
    }

    const role = payload.role === "platform_owner" ? "platform_owner" : "tenant";

    return {
      userId,
      username: String(payload.username || ""),
      role,
    };
  } catch {
    return null;
  }
}

export function clearLegacyAuthCookies(res: {
  cookies: {
    set: (name: string, value: string, options: { path: string; maxAge: number }) => void;
  };
}) {
  const clear = { path: "/", maxAge: 0 };

  res.cookies.set("elite_auth", "", clear);
  res.cookies.set("elite_user_id", "", clear);
  res.cookies.set("elite_username", "", clear);
  res.cookies.set(SESSION_COOKIE, "", clear);
}

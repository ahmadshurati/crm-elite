import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";

export const SHOP_COOKIE = "gosol_shop";
const MAX_AGE_SECONDS = 60 * 60 * 8;

export type ShopSession = {
  shopId: number;
  code: string;
};

function getSecret() {
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
  return new TextEncoder().encode(getSecret());
}

export function shopCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  };
}

export async function createShopToken(shopId: number, code: string) {
  return new SignJWT({ code })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(String(shopId))
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE_SECONDS}s`)
    .sign(secretKey());
}

export async function verifyShopToken(token: string): Promise<ShopSession | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey());
    const shopId = Number(payload.sub);
    if (!Number.isFinite(shopId) || shopId <= 0) return null;
    return { shopId, code: String(payload.code || "") };
  } catch {
    return null;
  }
}

export async function getShopSession(): Promise<ShopSession | null> {
  const store = await cookies();
  const token = store.get(SHOP_COOKIE)?.value;
  if (!token) return null;
  return verifyShopToken(token);
}

import { NextResponse } from "next/server";
import { checkRateLimit } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/request-meta";

export function enforceApiRateLimit(
  req: Request,
  routeKey: string,
  maxAttempts = 30,
  windowMs = 60 * 1000
) {
  const ip = getClientIp(req);
  const key = `api:${routeKey}:${ip}`;
  const rate = checkRateLimit(key, maxAttempts, windowMs);

  if (!rate.allowed) {
    return NextResponse.json(
      {
        error: "Too many requests",
        retryAfterMs: rate.retryAfterMs,
      },
      { status: 429 }
    );
  }

  return null;
}

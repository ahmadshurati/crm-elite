import { NextResponse } from "next/server";
import { clearLegacyAuthCookies } from "@/lib/session";
import { loggedRoute } from "@/lib/api-observability";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function handlePost() {
  const res = NextResponse.json({ ok: true });
  clearLegacyAuthCookies(res);
  return res;
}

export const POST = loggedRoute("POST /api/logout", handlePost);

import { NextResponse } from "next/server";
import { clearLegacyAuthCookies } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  const res = NextResponse.json({ ok: true });
  clearLegacyAuthCookies(res);
  return res;
}

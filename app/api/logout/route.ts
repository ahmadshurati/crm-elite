import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  const res = NextResponse.json({ ok: true });

  res.cookies.set("elite_auth", "", { path: "/", maxAge: 0 });
  res.cookies.set("elite_user_id", "", { path: "/", maxAge: 0 });
  res.cookies.set("elite_username", "", { path: "/", maxAge: 0 });

  return res;
}

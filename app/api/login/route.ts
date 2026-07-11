import { NextResponse } from "next/server";
import { ensureSeedUsersFromEnv } from "@/lib/seed-users";
import { tenantLogin, platformLogin } from "@/lib/login-auth";
import { loggedRoute } from "@/lib/api-observability";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function handleGet() {
  return NextResponse.json({ ok: true, route: "login" });
}

async function handlePost(req: Request) {
  try {
    try {
      await ensureSeedUsersFromEnv();
    } catch (seedError) {
      console.error("ensureSeedUsersFromEnv failed (login continues):", seedError);
    }
    return tenantLogin(req);
  } catch (error: unknown) {
    console.error("POST /api/login error:", error);
    return NextResponse.json({ error: "Login failed" }, { status: 500 });
  }
}

export const GET = loggedRoute("GET /api/login", handleGet);
export const POST = loggedRoute("POST /api/login", handlePost);

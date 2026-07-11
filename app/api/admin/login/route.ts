import { NextResponse } from "next/server";
import { platformLogin } from "@/lib/login-auth";
import { loggedRoute } from "@/lib/api-observability";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function handlePost(req: Request) {
  try {
    return platformLogin(req);
  } catch (error: unknown) {
    console.error("POST /api/admin/login error:", error);
    return NextResponse.json({ error: "Login failed" }, { status: 500 });
  }
}

export const POST = loggedRoute("POST /api/admin/login", handlePost);

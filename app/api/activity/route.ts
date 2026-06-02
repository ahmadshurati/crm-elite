import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { isErrorResponse, requirePermission } from "@/lib/permissions";
import { loggedRoute } from "@/lib/api-observability";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function handleGet() {
  try {
    const auth = await requirePermission("viewActivityLog");
    if (isErrorResponse(auth)) return auth;

    const logs = await query<any>("SELECT * FROM ActivityLog ORDER BY id DESC LIMIT 200");
    return NextResponse.json(logs);
  } catch (error: any) {
    console.error("GET /api/activity error:", error);
    return NextResponse.json({ error: "Failed to load activity logs", message: error?.message }, { status: 500 });
  }
}

async function handlePost() {
  return NextResponse.json({ error: "Activity logs are recorded server-side only" }, { status: 405 });
}

export const GET = loggedRoute("GET /api/activity", handleGet);
export const POST = loggedRoute("POST /api/activity", handlePost);

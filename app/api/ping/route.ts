import { NextResponse } from "next/server";
import { loggedRoute } from "@/lib/api-observability";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function handleGet() {
  return NextResponse.json({ ok: true, message: "API is working" });
}

export const GET = loggedRoute("GET /api/ping", handleGet);

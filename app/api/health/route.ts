import { NextResponse } from "next/server";
import { loggedRoute } from "@/lib/api-observability";
import { getRuntimeHealth } from "@/lib/runtime-health";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function handleGet() {
  const health = await getRuntimeHealth();
  return NextResponse.json(health, { status: health.ok ? 200 : 503 });
}

export const GET = loggedRoute("GET /api/health", handleGet);

import { NextResponse } from "next/server";
import { loggedRoute } from "@/lib/api-observability";
import { getRuntimeHealth } from "@/lib/runtime-health";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function handleGet(req: Request) {
  const diag = new URL(req.url).searchParams.get("diag") === "1";

  if (!diag) {
    return NextResponse.json({ ok: true, message: "API is working" });
  }

  const health = await getRuntimeHealth();
  return NextResponse.json(
    {
      message: health.ok ? "API is working" : "API misconfigured",
      ...health,
    },
    { status: health.ok ? 200 : 503 }
  );
}

export const GET = loggedRoute("GET /api/ping", handleGet);

import { NextResponse } from "next/server";
import { loggedRoute } from "@/lib/api-observability";
import { isAuthorizedCronRequest } from "@/lib/cron-auth";
import { expireInsurances } from "@/lib/expire-insurances";
import { logInfo } from "@/lib/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function handleGet(req: Request) {
  if (!isAuthorizedCronRequest(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const expiredCount = await expireInsurances();
    logInfo("cron.expire_insurances", { expiredCount });

    return NextResponse.json({ ok: true, expiredCount });
  } catch (error: any) {
    console.error("GET /api/cron/expire-insurances error:", error);
    return NextResponse.json(
      { error: "Failed to expire insurances", message: error?.message },
      { status: 500 }
    );
  }
}

export const GET = loggedRoute("GET /api/cron/expire-insurances", handleGet);

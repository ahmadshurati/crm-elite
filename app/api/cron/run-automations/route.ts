import { NextResponse } from "next/server";
import { loggedRoute } from "@/lib/api-observability";
import { isAuthorizedCronRequest } from "@/lib/cron-auth";
import { runExpiringInsuranceAutomations } from "@/lib/crm/automation";
import { logInfo } from "@/lib/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function handleGet(req: Request) {
  if (!isAuthorizedCronRequest(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const processedCount = await runExpiringInsuranceAutomations();
    logInfo("cron.run_automations", { processedCount });
    return NextResponse.json({ ok: true, processedCount });
  } catch (error: unknown) {
    console.error("GET /api/cron/run-automations error:", error);
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: "Failed to run automations", message }, { status: 500 });
  }
}

export const GET = loggedRoute("GET /api/cron/run-automations", handleGet);

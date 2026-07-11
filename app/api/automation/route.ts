import { NextResponse } from "next/server";
import { listAutomationRules, updateAutomationRule } from "@/lib/crm/automation";
import { isErrorResponse, requirePermission } from "@/lib/permissions";
import { loggedRoute } from "@/lib/api-observability";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function handleGet() {
  const auth = await requirePermission("editUsers");
  if (isErrorResponse(auth)) return auth;

  try {
    const rules = await listAutomationRules();
    return NextResponse.json(rules);
  } catch (error: unknown) {
    console.error("GET /api/automation error:", error);
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: "Failed to load automation rules", message }, { status: 500 });
  }
}

async function handlePatch(req: Request) {
  const auth = await requirePermission("editUsers");
  if (isErrorResponse(auth)) return auth;

  try {
    const body = await req.json();
    const id = Number(body.id);

    if (!Number.isFinite(id) || id <= 0) {
      return NextResponse.json({ error: "Invalid rule id" }, { status: 400 });
    }

    const rule = await updateAutomationRule(id, {
      isEnabled: body.isEnabled,
      config: body.config,
    });

    if (!rule) {
      return NextResponse.json({ error: "Rule not found" }, { status: 404 });
    }

    return NextResponse.json(rule);
  } catch (error: unknown) {
    console.error("PATCH /api/automation error:", error);
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: "Failed to update rule", message }, { status: 500 });
  }
}

export const GET = loggedRoute("GET /api/automation", handleGet);
export const PATCH = loggedRoute("PATCH /api/automation", handlePatch);

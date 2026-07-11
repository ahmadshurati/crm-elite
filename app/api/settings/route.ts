import { NextResponse } from "next/server";
import { writeActivityLog } from "@/lib/audit-log";
import { getSystemSettings, updateSystemSettings } from "@/lib/crm/settings";
import { isErrorResponse, requireAnyPermission, requirePermission } from "@/lib/permissions";
import { requireCompanyId } from "@/lib/tenant";
import { loggedRoute } from "@/lib/api-observability";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function handleGet() {
  const auth = await requireAnyPermission("viewUsers", "viewSubscribers");
  if (isErrorResponse(auth)) return auth;

  try {
    const companyId = requireCompanyId(auth.user);
    const settings = await getSystemSettings(companyId);
    return NextResponse.json(settings);
  } catch (error: unknown) {
    console.error("GET /api/settings error:", error);
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: "Failed to load settings", message }, { status: 500 });
  }
}

async function handlePatch(req: Request) {
  const auth = await requirePermission("editUsers");
  if (isErrorResponse(auth)) return auth;
  const { user: currentUser } = auth;

  try {
    const companyId = requireCompanyId(currentUser);
    const body = await req.json();
    const settings = await updateSystemSettings(companyId, {
      companyName: body.companyName,
      logoUrl: body.logoUrl,
      address: body.address,
      taxNumber: body.taxNumber,
      currency: body.currency,
      language: body.language,
      timezone: body.timezone,
      dateFormat: body.dateFormat,
      defaultTaxRate: body.defaultTaxRate,
    });

    await writeActivityLog(currentUser, "تحديث إعدادات الشركة", "النظام", settings.companyName, companyId);
    return NextResponse.json(settings);
  } catch (error: unknown) {
    console.error("PATCH /api/settings error:", error);
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: "Failed to update settings", message }, { status: 500 });
  }
}

export const GET = loggedRoute("GET /api/settings", handleGet);
export const PATCH = loggedRoute("PATCH /api/settings", handlePatch);

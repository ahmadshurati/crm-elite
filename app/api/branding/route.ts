import { NextResponse } from "next/server";
import { getSystemSettings } from "@/lib/crm/settings";
import { resolveBranding } from "@/lib/crm/vocabulary";
import { queryOne } from "@/lib/db";
import { isErrorResponse, requireUser } from "@/lib/permissions";
import { isDemoTenant, resolveCompanyId } from "@/lib/tenant";
import { loggedRoute } from "@/lib/api-observability";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function handleGet() {
  const auth = await requireUser();
  if (isErrorResponse(auth)) return auth;

  try {
    const companyId = resolveCompanyId(auth.user);
    if (!companyId) {
      return NextResponse.json(
        resolveBranding({ companyName: "Gosol Platform", isDemo: false })
      );
    }

    const [settings, company] = await Promise.all([
      getSystemSettings(companyId),
      queryOne<{ isDemo: boolean | number; name: string; slug: string }>(
        "SELECT isDemo, name, slug FROM Company WHERE id = ? LIMIT 1",
        [companyId]
      ),
    ]);

    return NextResponse.json(
      resolveBranding({
        companyName: settings.companyName || company?.name,
        logoUrl: settings.logoUrl,
        isDemo: isDemoTenant({
          companyId,
          isDemo: company?.isDemo,
          slug: company?.slug,
        }),
      })
    );
  } catch (error: unknown) {
    console.error("GET /api/branding error:", error);
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: "Failed to load branding", message }, { status: 500 });
  }
}

export const GET = loggedRoute("GET /api/branding", handleGet);

import { NextResponse } from "next/server";
import { writeActivityLog } from "@/lib/audit-log";
import { archiveDuplicateExtras, getDuplicateCarGroups } from "@/lib/customers-data";
import { isErrorResponse, requirePermission } from "@/lib/permissions";
import { requireCompanyId } from "@/lib/tenant";
import { loggedRoute } from "@/lib/api-observability";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function handleGet() {
  const auth = await requirePermission("viewSubscribers");
  if (isErrorResponse(auth)) return auth;

  const companyId = requireCompanyId(auth.user);
  const groups = await getDuplicateCarGroups(companyId);
  const duplicateCount = groups.reduce((sum, group) => sum + (group.entries.length - 1), 0);

  return NextResponse.json({ groups, groupCount: groups.length, duplicateCount });
}

async function handlePost() {
  // Removing records is destructive, so require delete permission.
  const auth = await requirePermission("deleteSubscribers");
  if (isErrorResponse(auth)) return auth;

  const companyId = requireCompanyId(auth.user);

  try {
    const result = await archiveDuplicateExtras(companyId);

    if (result.archived > 0) {
      await writeActivityLog(
        auth.user,
        "أرشفة مشتركين مكررين",
        "المشتركين",
        `تم أرشفة ${result.archived} مشترك مكرر (بحسب رقم السيارة)`,
        null
      );
    }

    return NextResponse.json({ ok: true, ...result });
  } catch (error: unknown) {
    console.error("POST /api/customers/duplicates error:", error);
    return NextResponse.json({ error: "تعذّر تنظيف المكررات" }, { status: 500 });
  }
}

export const GET = loggedRoute("GET /api/customers/duplicates", handleGet);
export const POST = loggedRoute("POST /api/customers/duplicates", handlePost);

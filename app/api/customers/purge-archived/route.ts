import { NextResponse } from "next/server";
import { writeActivityLog } from "@/lib/audit-log";
import { purgeArchivedCustomers } from "@/lib/customers-data";
import { isErrorResponse, requirePermission } from "@/lib/permissions";
import { requireCompanyId } from "@/lib/tenant";
import { loggedRoute } from "@/lib/api-observability";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Permanently deletes ALL archived customers in the caller's company. */
async function handlePost() {
  const auth = await requirePermission("deleteSubscribers");
  if (isErrorResponse(auth)) return auth;

  const companyId = requireCompanyId(auth.user);

  try {
    const result = await purgeArchivedCustomers(companyId);

    if (result.deleted > 0) {
      await writeActivityLog(
        auth.user,
        "حذف كل العملاء المؤرشفين",
        "المشتركين",
        `تم حذف ${result.deleted} عميل مؤرشف نهائيًا`,
        null
      );
    }

    return NextResponse.json({ ok: true, ...result });
  } catch (error: unknown) {
    console.error("POST /api/customers/purge-archived error:", error);
    return NextResponse.json({ error: "تعذّر حذف الكل" }, { status: 500 });
  }
}

export const POST = loggedRoute("POST /api/customers/purge-archived", handlePost);

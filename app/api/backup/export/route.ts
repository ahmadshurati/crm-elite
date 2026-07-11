import { NextResponse } from "next/server";
import { exportBackupSnapshot, getBackupSummary } from "@/lib/backup-export";
import { isErrorResponse, requireUser } from "@/lib/permissions";
import { loggedRoute } from "@/lib/api-observability";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function handleGet(req: Request) {
  const auth = await requireUser();
  if (isErrorResponse(auth)) return auth;

  if (auth.user.role !== "master" && !auth.user.viewUsers) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(req.url);
  const scope = url.searchParams.get("scope") || "summary";

  if (scope === "full") {
    const snapshot = await exportBackupSnapshot();
    return NextResponse.json(snapshot);
  }

  return NextResponse.json(await getBackupSummary());
}

export const GET = loggedRoute("GET /api/backup/export", handleGet);

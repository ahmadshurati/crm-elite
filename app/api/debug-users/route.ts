import { NextResponse } from "next/server";
import { assertDebugAccess } from "@/lib/debug-access";
import { queryOne } from "@/lib/db";
import { loggedRoute } from "@/lib/api-observability";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function handleGet(req: Request) {
  const denied = assertDebugAccess(req);
  if (denied) return denied;

  try {
    const users = await queryOne<{ count: number }>("SELECT COUNT(*) as count FROM AppUser");
    const logs = await queryOne<{ count: number }>("SELECT COUNT(*) as count FROM ActivityLog");

    return NextResponse.json({
      ok: true,
      usersCount: Number(users?.count || 0),
      logsCount: Number(logs?.count || 0),
    });
  } catch {
    return NextResponse.json({ ok: false, error: "Database check failed" }, { status: 500 });
  }
}

export const GET = loggedRoute("GET /api/debug-users", handleGet);

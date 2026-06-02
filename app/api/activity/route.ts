import { NextResponse } from "next/server";
import { execute, query } from "@/lib/db";
import { isErrorResponse, requirePermission, requireUser } from "@/lib/permissions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const auth = await requirePermission("viewActivityLog");
    if (isErrorResponse(auth)) return auth;

    const logs = await query<any>("SELECT * FROM ActivityLog ORDER BY id DESC LIMIT 200");
    return NextResponse.json(logs);
  } catch (error: any) {
    console.error("GET /api/activity error:", error);
    return NextResponse.json({ error: "Failed to load activity logs", message: error?.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const auth = await requireUser();
    if (isErrorResponse(auth)) return auth;
    const { user: currentUser } = auth;

    const body = await req.json();

    const result = await execute(
      "INSERT INTO ActivityLog (userId, username, action, module, targetId, details, createdAt) VALUES (?, ?, ?, ?, ?, ?, NOW())",
      [
        currentUser.id,
        currentUser.username,
        String(body.action || "عملية"),
        String(body.module || "النظام"),
        body.targetId ? String(body.targetId) : null,
        body.details ? String(body.details) : null,
      ]
    );

    return NextResponse.json({ id: result.insertId, ok: true });
  } catch (error: any) {
    console.error("POST /api/activity error:", error);
    return NextResponse.json({ error: "Failed to create activity log", message: error?.message }, { status: 500 });
  }
}

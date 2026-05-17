import { NextResponse } from "next/server";
import { execute, query } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const currentUser = await getCurrentUser();

    if (!currentUser || Number(currentUser.viewActivityLog) !== 1) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const logs = await query<any>("SELECT * FROM ActivityLog ORDER BY id DESC LIMIT 200");
    return NextResponse.json(logs);
  } catch (error: any) {
    console.error("GET /api/activity error:", error);
    return NextResponse.json({ error: "Failed to load activity logs", message: error?.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const currentUser = await getCurrentUser();

    if (!currentUser) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

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

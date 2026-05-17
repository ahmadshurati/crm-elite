import { NextResponse } from "next/server";
import { queryOne } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const users = await queryOne<{ count: number }>("SELECT COUNT(*) as count FROM AppUser");
    const logs = await queryOne<{ count: number }>("SELECT COUNT(*) as count FROM ActivityLog");

    return NextResponse.json({
      ok: true,
      usersCount: Number(users?.count || 0),
      logsCount: Number(logs?.count || 0),
    });
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, message: error?.message, code: error?.code, name: error?.name },
      { status: 500 }
    );
  }
}

import { NextResponse } from "next/server";
import { cleanUser, getCurrentUser } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await getCurrentUser();

    if (!user || Number(user.isActive) !== 1) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    return NextResponse.json(cleanUser(user));
  } catch (error: any) {
    console.error("GET /api/me error:", error);
    return NextResponse.json({ error: "Failed to load user", message: error?.message }, { status: 500 });
  }
}

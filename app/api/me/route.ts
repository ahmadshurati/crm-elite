import { NextResponse } from "next/server";
import { cleanUser } from "@/lib/auth";
import { isErrorResponse, requireUser } from "@/lib/permissions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const auth = await requireUser();
    if (isErrorResponse(auth)) return auth;

    return NextResponse.json(cleanUser(auth.user));
  } catch (error: any) {
    console.error("GET /api/me error:", error);
    return NextResponse.json({ error: "Failed to load user", message: error?.message }, { status: 500 });
  }
}

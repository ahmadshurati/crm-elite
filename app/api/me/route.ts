import { NextResponse } from "next/server";
import { cleanUser } from "@/lib/auth";
import { isErrorResponse, requireUser } from "@/lib/permissions";
import { loggedRoute } from "@/lib/api-observability";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function handleGet() {
  try {
    const auth = await requireUser();
    if (isErrorResponse(auth)) return auth;

    return NextResponse.json(cleanUser(auth.user));
  } catch (error: any) {
    console.error("GET /api/me error:", error);
    return NextResponse.json({ error: "Failed to load user", message: error?.message }, { status: 500 });
  }
}

export const GET = loggedRoute("GET /api/me", handleGet);

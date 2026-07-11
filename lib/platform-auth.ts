import { NextResponse } from "next/server";
import { getCurrentUser, type CurrentUser } from "@/lib/auth";
import { isPlatformOwner } from "@/lib/tenant";

export function isPlatformErrorResponse(value: unknown): value is NextResponse {
  return value instanceof NextResponse;
}

export async function requirePlatformOwner(): Promise<{ user: CurrentUser } | NextResponse> {
  const user = await getCurrentUser();

  if (!user || Number(user.isActive) !== 1) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  if (!isPlatformOwner(user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return { user };
}

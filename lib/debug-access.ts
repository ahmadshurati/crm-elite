import { NextResponse } from "next/server";

export function assertDebugAccess(req: Request) {
  if (process.env.NODE_ENV === "production" && process.env.DEBUG_API_ENABLED !== "true") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const expectedKey = process.env.DEBUG_API_KEY;

  if (expectedKey) {
    const providedKey = req.headers.get("x-debug-key");

    if (providedKey !== expectedKey) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  return null;
}

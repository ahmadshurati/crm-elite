import { NextResponse } from "next/server";
import { queryOne } from "@/lib/db";
import { loggedRoute } from "@/lib/api-observability";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function handleGet() {
  const hasDatabaseUrl = Boolean(process.env.DATABASE_URL?.trim());
  const hasSessionSecret = Boolean(process.env.SESSION_SECRET?.trim());

  let database = false;
  let databaseError = "";

  if (hasDatabaseUrl) {
    try {
      await queryOne<{ ok: number }>("SELECT 1 AS ok");
      database = true;
    } catch (error) {
      databaseError = error instanceof Error ? error.message : "Database connection failed";
    }
  } else {
    databaseError = "DATABASE_URL is not set";
  }

  const ok = hasDatabaseUrl && hasSessionSecret && database;

  return NextResponse.json(
    {
      ok,
      checks: {
        databaseUrl: hasDatabaseUrl,
        sessionSecret: hasSessionSecret,
        database,
      },
      ...(databaseError ? { databaseError } : {}),
    },
    { status: ok ? 200 : 503 }
  );
}

export const GET = loggedRoute("GET /api/health", handleGet);

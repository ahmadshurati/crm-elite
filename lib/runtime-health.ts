import { queryOne } from "@/lib/db";

export async function getRuntimeHealth() {
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

  return {
    ok,
    checks: {
      databaseUrl: hasDatabaseUrl,
      sessionSecret: hasSessionSecret,
      database,
    },
    ...(databaseError ? { databaseError } : {}),
  };
}

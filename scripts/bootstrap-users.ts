/**
 * One-time bootstrap for platform owner + demo tenant user.
 * Run: npm run bootstrap:users
 */
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";
import { ensureSeedUsersFromEnv } from "@/lib/seed-users";

function loadEnvFile() {
  const envPath = resolve(process.cwd(), ".env");
  if (!existsSync(envPath)) return;
  const content = readFileSync(envPath, "utf8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const index = trimmed.indexOf("=");
    if (index === -1) continue;
    const key = trimmed.slice(0, index).trim();
    let value = trimmed.slice(index + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}

async function main() {
  loadEnvFile();
  process.env.SEED_USERS = "true";
  process.env.SEED_OWNER_USERNAME = process.env.SEED_OWNER_USERNAME || "gosol";
  process.env.SEED_OWNER_PASSWORD = process.env.SEED_OWNER_PASSWORD || "GosolAdmin2026!";
  process.env.SEED_DEMO_USERNAME = process.env.SEED_DEMO_USERNAME || "demo";
  process.env.SEED_DEMO_PASSWORD = process.env.SEED_DEMO_PASSWORD || "demo1234";

  await ensureSeedUsersFromEnv();

  console.log("Bootstrap complete.");
  console.log("Admin login (/admin/login):", process.env.SEED_OWNER_USERNAME);
  console.log("Demo login (/login):", process.env.SEED_DEMO_USERNAME);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

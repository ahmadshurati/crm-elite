/**
 * Seeds rich fake CRM data for the demo tenant (companyId=2) only.
 * Elite data (companyId=1) is never modified.
 * Run: npm run seed:demo
 */
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";
import { resetDemoCompanyData } from "@/lib/seed-demo-data";

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
  const result = await resetDemoCompanyData();
  console.log("Demo seed complete (Elite data unchanged):");
  console.log(result);
  console.log("Login at /login with demo / demo1234");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

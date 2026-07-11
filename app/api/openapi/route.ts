import { NextResponse } from "next/server";
import { loggedRoute } from "@/lib/api-observability";
import { getIntegrationStatus } from "@/lib/integrations/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const paths = [
  "/api/customers",
  "/api/customers/{id}",
  "/api/customers/{id}/timeline",
  "/api/customers/{id}/communications",
  "/api/customers/{id}/summary",
  "/api/deals",
  "/api/tasks",
  "/api/quotes",
  "/api/invoices",
  "/api/contracts",
  "/api/products",
  "/api/integrations/status",
  "/api/integrations/email/send",
  "/api/integrations/sms/send",
  "/api/integrations/whatsapp/send",
  "/api/integrations/ai/summary",
  "/api/integrations/ai/draft-email",
  "/api/email-templates",
  "/api/field-audit",
  "/api/files",
  "/api/backup/export",
  "/api/v1/customers",
  "/api/v1/deals",
  "/api/v1/tasks",
  "/api/search",
  "/api/notifications",
  "/api/reports/summary",
];

async function handleGet() {
  const integration = getIntegrationStatus();

  return NextResponse.json({
    openapi: "3.0.3",
    info: {
      title: "Elite Insurance CRM API",
      version: "1.0.0",
      description:
        "REST API for CRM integrations. Use session cookie (browser) or X-API-Key header for external apps.",
    },
    servers: [{ url: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3007" }],
    components: {
      securitySchemes: {
        sessionCookie: { type: "apiKey", in: "cookie", name: "elite_session" },
        apiKeyHeader: { type: "apiKey", in: "header", name: "X-API-Key" },
      },
    },
    security: [{ sessionCookie: [] }, { apiKeyHeader: [] }],
    paths: Object.fromEntries(
      paths.map((path) => [
        path,
        {
          get: { summary: `GET ${path}`, responses: { "200": { description: "OK" } } },
          post: path.includes("{id}") ? undefined : { summary: `POST ${path}`, responses: { "200": { description: "OK" } } },
        },
      ])
    ),
    "x-integration-status": integration,
    "x-auth-notes": [
      "Create API keys via POST /api/api-keys (master or editUsers permission).",
      "Pass key as X-API-Key or Authorization: Bearer elite_...",
      "External messaging requires env vars documented in GET /api/integrations/status.",
    ],
  });
}

export const GET = loggedRoute("GET /api/openapi", handleGet);

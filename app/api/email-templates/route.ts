import { NextResponse } from "next/server";
import { execute, query } from "@/lib/db";
import { isErrorResponse, requirePermission } from "@/lib/permissions";
import { loggedRoute } from "@/lib/api-observability";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function mapRow(row: Record<string, unknown>) {
  return {
    id: Number(row.id),
    name: String(row.name || ""),
    subject: String(row.subject || ""),
    bodyHtml: String(row.bodyHtml || ""),
    bodyText: row.bodyText ? String(row.bodyText) : null,
    category: String(row.category || "general"),
    isActive: Boolean(row.isActive),
    createdAt: new Date(row.createdAt as string | Date).toISOString(),
    updatedAt: new Date(row.updatedAt as string | Date).toISOString(),
  };
}

async function handleGet() {
  const auth = await requirePermission("viewSubscribers");
  if (isErrorResponse(auth)) return auth;

  const rows = await query<Record<string, unknown>>(
    "SELECT * FROM EmailTemplate ORDER BY name ASC"
  );
  return NextResponse.json(rows.map(mapRow));
}

async function handlePost(req: Request) {
  const auth = await requirePermission("editUsers");
  if (isErrorResponse(auth)) return auth;

  const body = await req.json();
  const name = String(body.name || "").trim();
  const subject = String(body.subject || "").trim();
  const bodyHtml = String(body.bodyHtml || "").trim();

  if (!name || !subject || !bodyHtml) {
    return NextResponse.json({ error: "name, subject, bodyHtml required" }, { status: 400 });
  }

  const result = await execute(
    `INSERT INTO EmailTemplate (name, subject, bodyHtml, bodyText, category, isActive, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, ?, true, NOW(), NOW())`,
    [
      name,
      subject,
      bodyHtml,
      body.bodyText ? String(body.bodyText) : null,
      String(body.category || "general"),
    ]
  );

  const rows = await query<Record<string, unknown>>("SELECT * FROM EmailTemplate WHERE id = ? LIMIT 1", [
    result.insertId,
  ]);

  return NextResponse.json(mapRow(rows[0] || {}));
}

export const GET = loggedRoute("GET /api/email-templates", handleGet);
export const POST = loggedRoute("POST /api/email-templates", handlePost);

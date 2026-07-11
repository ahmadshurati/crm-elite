import { NextResponse } from "next/server";
import { writeActivityLog } from "@/lib/audit-log";
import {
  createRoleTemplate,
  listRoleTemplates,
  permissionsFromBody,
} from "@/lib/crm/role-templates-data";
import { isErrorResponse, requirePermission } from "@/lib/permissions";
import { loggedRoute } from "@/lib/api-observability";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function handleGet() {
  const auth = await requirePermission("viewUsers");
  if (isErrorResponse(auth)) return auth;

  try {
    const templates = await listRoleTemplates();
    return NextResponse.json(templates);
  } catch (error: unknown) {
    console.error("GET /api/roles error:", error);
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: "Failed to load roles", message }, { status: 500 });
  }
}

async function handlePost(req: Request) {
  const auth = await requirePermission("editUsers");
  if (isErrorResponse(auth)) return auth;
  const { user: currentUser } = auth;

  try {
    const body = await req.json();
    const name = String(body.name || "").trim();

    if (!name) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    const template = await createRoleTemplate({
      name,
      description: body.description ? String(body.description) : undefined,
      permissions: permissionsFromBody(body),
    });

    await writeActivityLog(currentUser, "إضافة قالب صلاحيات", "المستخدمين", name, template?.id);
    return NextResponse.json(template);
  } catch (error: unknown) {
    console.error("POST /api/roles error:", error);
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: "Failed to create role", message }, { status: 500 });
  }
}

export const GET = loggedRoute("GET /api/roles", handleGet);
export const POST = loggedRoute("POST /api/roles", handlePost);

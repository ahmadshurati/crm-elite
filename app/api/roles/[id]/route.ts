import { NextResponse } from "next/server";
import { writeActivityLog } from "@/lib/audit-log";
import {
  deleteRoleTemplate,
  getRoleTemplateById,
  permissionsFromBody,
  updateRoleTemplate,
} from "@/lib/crm/role-templates-data";
import { isErrorResponse, requirePermission } from "@/lib/permissions";
import { loggedRoute } from "@/lib/api-observability";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function handleGet(
  _req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requirePermission("viewUsers");
  if (isErrorResponse(auth)) return auth;

  try {
    const { id } = await context.params;
    const template = await getRoleTemplateById(Number(id));
    if (!template) return NextResponse.json({ error: "Role not found" }, { status: 404 });
    return NextResponse.json(template);
  } catch (error: unknown) {
    console.error("GET /api/roles/[id] error:", error);
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: "Failed to load role", message }, { status: 500 });
  }
}

async function handlePatch(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requirePermission("editUsers");
  if (isErrorResponse(auth)) return auth;
  const { user: currentUser } = auth;

  try {
    const { id } = await context.params;
    const body = await req.json();
    const template = await updateRoleTemplate(Number(id), {
      name: body.name != null ? String(body.name) : undefined,
      description: body.description !== undefined ? String(body.description || "") : undefined,
      permissions: body.viewSubscribers !== undefined ? permissionsFromBody(body) : undefined,
    });

    if (!template) return NextResponse.json({ error: "Role not found" }, { status: 404 });

    await writeActivityLog(currentUser, "تعديل قالب صلاحيات", "المستخدمين", template.name, template.id);
    return NextResponse.json(template);
  } catch (error: unknown) {
    console.error("PATCH /api/roles/[id] error:", error);
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: "Failed to update role", message }, { status: 500 });
  }
}

async function handleDelete(
  _req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requirePermission("editUsers");
  if (isErrorResponse(auth)) return auth;
  const { user: currentUser } = auth;

  try {
    const { id } = await context.params;
    const template = await getRoleTemplateById(Number(id));
    if (!template) return NextResponse.json({ error: "Role not found" }, { status: 404 });
    if (template.isSystem) {
      return NextResponse.json({ error: "System roles cannot be deleted" }, { status: 400 });
    }

    const ok = await deleteRoleTemplate(Number(id));
    if (!ok) return NextResponse.json({ error: "Failed to delete role" }, { status: 400 });

    await writeActivityLog(currentUser, "حذف قالب صلاحيات", "المستخدمين", template.name, template.id);
    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    console.error("DELETE /api/roles/[id] error:", error);
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: "Failed to delete role", message }, { status: 500 });
  }
}

export const GET = loggedRoute("GET /api/roles/[id]", handleGet);
export const PATCH = loggedRoute("PATCH /api/roles/[id]", handlePatch);
export const DELETE = loggedRoute("DELETE /api/roles/[id]", handleDelete);

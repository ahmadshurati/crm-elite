import { NextResponse } from "next/server";
import { writeActivityLog } from "@/lib/audit-log";
import { applyRoleTemplateToUser, getRoleTemplateById } from "@/lib/crm/role-templates-data";
import { cleanUser } from "@/lib/auth";
import { queryOne } from "@/lib/db";
import { isErrorResponse, requirePermission } from "@/lib/permissions";
import { loggedRoute } from "@/lib/api-observability";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function handlePost(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requirePermission("editUsers");
  if (isErrorResponse(auth)) return auth;
  const { user: currentUser } = auth;

  try {
    const { id } = await context.params;
    const templateId = Number(id);
    const body = await req.json();
    const userId = Number(body.userId);

    if (!Number.isFinite(templateId) || templateId <= 0 || !Number.isFinite(userId) || userId <= 0) {
      return NextResponse.json({ error: "Invalid templateId or userId" }, { status: 400 });
    }

    const template = await getRoleTemplateById(templateId);
    if (!template) {
      return NextResponse.json({ error: "Role template not found" }, { status: 404 });
    }

    const ok = await applyRoleTemplateToUser(userId, templateId);
    if (!ok) {
      return NextResponse.json({ error: "Failed to apply role" }, { status: 400 });
    }

    const updatedUser = await queryOne<any>("SELECT * FROM AppUser WHERE id = ? LIMIT 1", [userId]);

    await writeActivityLog(
      currentUser,
      "تطبيق قالب صلاحيات",
      "المستخدمين",
      `${template.name} → ${updatedUser?.username || userId}`,
      userId
    );

    return NextResponse.json(cleanUser(updatedUser));
  } catch (error: unknown) {
    console.error("POST /api/roles/[id]/apply error:", error);
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: "Failed to apply role", message }, { status: 500 });
  }
}

export const POST = loggedRoute("POST /api/roles/[id]/apply", handlePost);

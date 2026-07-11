import { NextResponse } from "next/server";
import { execute, queryOne } from "@/lib/db";
import { cleanUser } from "@/lib/auth";
import { hashPassword } from "@/lib/password";
import { isErrorResponse, requirePermission } from "@/lib/permissions";
import { isPlatformOwner, requireCompanyId } from "@/lib/tenant";
import { loggedRoute } from "@/lib/api-observability";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const permissionFields = [
  "viewSubscribers",
  "createSubscribers",
  "editSubscribers",
  "deleteSubscribers",
  "viewAccidents",
  "createAccidents",
  "editAccidents",
  "deleteAccidents",
  "viewAccounting",
  "editPayments",
  "viewUsers",
  "createUsers",
  "editUsers",
  "deleteUsers",
  "viewActivityLog",
];

async function handlePatch(req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requirePermission("editUsers");
    if (isErrorResponse(auth)) return auth;

    const { user: currentUser } = auth;
    const companyId = requireCompanyId(currentUser);
    const { id } = await context.params;
    const userId = Number(id);
    const existing = await queryOne<any>("SELECT * FROM AppUser WHERE id = ? AND companyId = ? LIMIT 1", [userId, companyId]);
    if (!existing) return NextResponse.json({ error: "User not found" }, { status: 404 });
    if (existing.role === "master" && currentUser.role !== "master" && !isPlatformOwner(currentUser)) {
      return NextResponse.json({ error: "Cannot edit master user" }, { status: 400 });
    }

    const body = await req.json();
    const username = String(body.username || "").trim().toLowerCase();
    const role = String(body.role || "user") === "master" ? "master" : "user";
    const baseParams = [username, body.isActive ? 1 : 0, role, ...permissionFields.map((field) => (body[field] ? 1 : 0))];
    const newPassword = String(body.password || "").trim();

    if (newPassword) {
      const hashedPassword = await hashPassword(newPassword);
      await execute(
        `UPDATE AppUser SET
          username = ?, isActive = ?, role = ?,
          viewSubscribers = ?, createSubscribers = ?, editSubscribers = ?, deleteSubscribers = ?,
          viewAccidents = ?, createAccidents = ?, editAccidents = ?, deleteAccidents = ?,
          viewAccounting = ?, editPayments = ?,
          viewUsers = ?, createUsers = ?, editUsers = ?, deleteUsers = ?,
          viewActivityLog = ?, password = ?, updatedAt = NOW()
        WHERE id = ?`,
        [...baseParams, hashedPassword, userId]
      );
    } else {
      await execute(
        `UPDATE AppUser SET
          username = ?, isActive = ?, role = ?,
          viewSubscribers = ?, createSubscribers = ?, editSubscribers = ?, deleteSubscribers = ?,
          viewAccidents = ?, createAccidents = ?, editAccidents = ?, deleteAccidents = ?,
          viewAccounting = ?, editPayments = ?,
          viewUsers = ?, createUsers = ?, editUsers = ?, deleteUsers = ?,
          viewActivityLog = ?, updatedAt = NOW()
        WHERE id = ?`,
        [...baseParams, userId]
      );
    }

    await execute(
      "INSERT INTO ActivityLog (userId, username, action, module, targetId, details, createdAt) VALUES (?, ?, ?, ?, ?, ?, NOW())",
      [currentUser.id, currentUser.username, "تعديل مستخدم", "المستخدمين", String(userId), username]
    );

    const updatedUser = await queryOne<any>("SELECT * FROM AppUser WHERE id = ? LIMIT 1", [userId]);
    return NextResponse.json(cleanUser(updatedUser));
  } catch (error: any) {
    console.error("PATCH /api/users/[id] error:", error);
    return NextResponse.json({ error: "Failed to update user" }, { status: 500 });
  }
}

async function handleDelete(req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requirePermission("deleteUsers");
    if (isErrorResponse(auth)) return auth;

    const { user: currentUser } = auth;
    const companyId = requireCompanyId(currentUser);
    const { id } = await context.params;
    const userId = Number(id);
    const user = await queryOne<any>("SELECT * FROM AppUser WHERE id = ? AND companyId = ? LIMIT 1", [userId, companyId]);

    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });
    if (user.role === "master" || user.role === "platform_owner") {
      return NextResponse.json({ error: "Cannot delete protected user" }, { status: 400 });
    }

    await execute("DELETE FROM ActivityLog WHERE userId = ?", [userId]);
    await execute("DELETE FROM AppUser WHERE id = ?", [userId]);

    await execute(
      "INSERT INTO ActivityLog (userId, username, action, module, targetId, details, createdAt) VALUES (?, ?, ?, ?, ?, ?, NOW())",
      [currentUser.id, currentUser.username, "حذف مستخدم", "المستخدمين", String(user.id), user.username]
    );

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error("DELETE /api/users/[id] error:", error);
    return NextResponse.json({ error: "Failed to delete user" }, { status: 500 });
  }
}

export const PATCH = loggedRoute("PATCH /api/users/[id]", handlePatch);
export const DELETE = loggedRoute("DELETE /api/users/[id]", handleDelete);

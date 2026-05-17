import { NextResponse } from "next/server";
import { execute, queryOne } from "@/lib/db";
import { cleanUser, getCurrentUser } from "@/lib/auth";

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

export async function PATCH(req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const currentUser = await getCurrentUser();

    if (!currentUser || Number(currentUser.editUsers) !== 1) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await context.params;
    const userId = Number(id);
    const body = await req.json();
    const username = String(body.username || "").trim().toLowerCase();
    const role = String(body.role || "user") === "master" ? "master" : "user";
    const baseParams = [username, body.isActive ? 1 : 0, role, ...permissionFields.map((field) => (body[field] ? 1 : 0))];

    if (String(body.password || "").trim()) {
      await execute(
        `UPDATE AppUser SET
          username = ?, isActive = ?, role = ?,
          viewSubscribers = ?, createSubscribers = ?, editSubscribers = ?, deleteSubscribers = ?,
          viewAccidents = ?, createAccidents = ?, editAccidents = ?, deleteAccidents = ?,
          viewAccounting = ?, editPayments = ?,
          viewUsers = ?, createUsers = ?, editUsers = ?, deleteUsers = ?,
          viewActivityLog = ?, password = ?, updatedAt = NOW()
        WHERE id = ?`,
        [...baseParams, String(body.password || "").trim(), userId]
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
    return NextResponse.json({ error: "Failed to update user", message: error?.message }, { status: 500 });
  }
}

export async function DELETE(req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const currentUser = await getCurrentUser();

    if (!currentUser || Number(currentUser.deleteUsers) !== 1) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await context.params;
    const userId = Number(id);
    const user = await queryOne<any>("SELECT * FROM AppUser WHERE id = ? LIMIT 1", [userId]);

    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });
    if (user.role === "master") return NextResponse.json({ error: "Cannot delete master user" }, { status: 400 });

    await execute("DELETE FROM ActivityLog WHERE userId = ?", [userId]);
    await execute("DELETE FROM AppUser WHERE id = ?", [userId]);

    await execute(
      "INSERT INTO ActivityLog (userId, username, action, module, targetId, details, createdAt) VALUES (?, ?, ?, ?, ?, ?, NOW())",
      [currentUser.id, currentUser.username, "حذف مستخدم", "المستخدمين", String(user.id), user.username]
    );

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error("DELETE /api/users/[id] error:", error);
    return NextResponse.json({ error: "Failed to delete user", message: error?.message }, { status: 500 });
  }
}

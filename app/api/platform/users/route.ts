import { NextResponse } from "next/server";
import { cleanUser } from "@/lib/auth";
import { listAllUsersWithCompany } from "@/lib/companies";
import { execute } from "@/lib/db";
import { hashPassword } from "@/lib/password";
import { isPlatformErrorResponse, requirePlatformOwner } from "@/lib/platform-auth";
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
] as const;

async function handleGet() {
  const auth = await requirePlatformOwner();
  if (isPlatformErrorResponse(auth)) return auth;

  try {
    const users = await listAllUsersWithCompany();
    return NextResponse.json(users.map((user) => cleanUser(user)));
  } catch (error: unknown) {
    console.error("GET /api/platform/users error:", error);
    return NextResponse.json({ error: "Failed to load users" }, { status: 500 });
  }
}

async function handlePost(req: Request) {
  const auth = await requirePlatformOwner();
  if (isPlatformErrorResponse(auth)) return auth;
  const { user: owner } = auth;

  try {
    const body = await req.json();
    const companyId = Number(body.companyId);
    const username = String(body.username || "").trim().toLowerCase();
    const password = String(body.password || "").trim();
    const role = String(body.role || "user") === "master" ? "master" : "user";

    if (!companyId || !username || !password) {
      return NextResponse.json({ error: "companyId, username, and password are required" }, { status: 400 });
    }

    const hashedPassword = await hashPassword(password);
    const result = await execute(
      `INSERT INTO AppUser (
        username, password, role, isActive, companyId,
        viewSubscribers, createSubscribers, editSubscribers, deleteSubscribers,
        viewAccidents, createAccidents, editAccidents, deleteAccidents,
        viewAccounting, editPayments,
        viewUsers, createUsers, editUsers, deleteUsers,
        viewActivityLog, createdAt, updatedAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [
        username,
        hashedPassword,
        role,
        body.isActive === false ? 0 : 1,
        companyId,
        ...permissionFields.map((field) => (body[field] ? 1 : 0)),
      ]
    );

    const createdUser = await listAllUsersWithCompany();
    const row = createdUser.find((user) => Number(user.id) === result.insertId);

    await execute(
      "INSERT INTO ActivityLog (userId, username, action, module, targetId, details, createdAt) VALUES (?, ?, ?, ?, ?, ?, NOW())",
      [owner.id, owner.username, "إنشاء مستخدم شركة", "المنصة", String(result.insertId), username]
    );

    return NextResponse.json(cleanUser(row || { id: result.insertId, username, role, companyId }));
  } catch (error: unknown) {
    console.error("POST /api/platform/users error:", error);
    return NextResponse.json({ error: "Failed to create user" }, { status: 500 });
  }
}

async function handlePatch(req: Request) {
  const auth = await requirePlatformOwner();
  if (isPlatformErrorResponse(auth)) return auth;
  const { user: owner } = auth;

  try {
    const body = await req.json();
    const userId = Number(body.id);
    if (!userId) return NextResponse.json({ error: "User id is required" }, { status: 400 });

    const target = await listAllUsersWithCompany();
    const existing = target.find((user) => Number(user.id) === userId);
    if (!existing) return NextResponse.json({ error: "User not found" }, { status: 404 });
    if (existing.role === "platform_owner") {
      return NextResponse.json({ error: "Cannot modify platform owner" }, { status: 400 });
    }

    const role = String(body.role || existing.role) === "master" ? "master" : "user";
    const params = [
      body.isActive === false ? 0 : 1,
      role,
      ...permissionFields.map((field) => (body[field] ? 1 : 0)),
      userId,
    ];

    const password = String(body.password || "").trim();
    if (password) {
      const hashedPassword = await hashPassword(password);
      await execute(
        `UPDATE AppUser SET isActive = ?, role = ?,
          viewSubscribers = ?, createSubscribers = ?, editSubscribers = ?, deleteSubscribers = ?,
          viewAccidents = ?, createAccidents = ?, editAccidents = ?, deleteAccidents = ?,
          viewAccounting = ?, editPayments = ?,
          viewUsers = ?, createUsers = ?, editUsers = ?, deleteUsers = ?,
          viewActivityLog = ?, password = ?, updatedAt = NOW()
         WHERE id = ?`,
        [...params.slice(0, -1), hashedPassword, userId]
      );
    } else {
      await execute(
        `UPDATE AppUser SET isActive = ?, role = ?,
          viewSubscribers = ?, createSubscribers = ?, editSubscribers = ?, deleteSubscribers = ?,
          viewAccidents = ?, createAccidents = ?, editAccidents = ?, deleteAccidents = ?,
          viewAccounting = ?, editPayments = ?,
          viewUsers = ?, createUsers = ?, editUsers = ?, deleteUsers = ?,
          viewActivityLog = ?, updatedAt = NOW()
         WHERE id = ?`,
        params
      );
    }

    await execute(
      "INSERT INTO ActivityLog (userId, username, action, module, targetId, details, createdAt) VALUES (?, ?, ?, ?, ?, ?, NOW())",
      [owner.id, owner.username, "تحديث مستخدم شركة", "المنصة", String(userId), String(existing.username)]
    );

    const updated = (await listAllUsersWithCompany()).find((user) => Number(user.id) === userId);
    return NextResponse.json(cleanUser(updated));
  } catch (error: unknown) {
    console.error("PATCH /api/platform/users error:", error);
    return NextResponse.json({ error: "Failed to update user" }, { status: 500 });
  }
}

export const GET = loggedRoute("GET /api/platform/users", handleGet);
export const POST = loggedRoute("POST /api/platform/users", handlePost);
export const PATCH = loggedRoute("PATCH /api/platform/users", handlePatch);

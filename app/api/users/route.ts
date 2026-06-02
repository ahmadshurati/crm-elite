import { NextResponse } from "next/server";
import { execute, query, queryOne } from "@/lib/db";
import { cleanUser } from "@/lib/auth";
import { hashPassword } from "@/lib/password";
import { isErrorResponse, requirePermission } from "@/lib/permissions";
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

async function handleGet() {
  try {
    const auth = await requirePermission("viewUsers");
    if (isErrorResponse(auth)) return auth;

    const users = await query<any>("SELECT * FROM AppUser ORDER BY id ASC");
    return NextResponse.json(users.map(cleanUser));
  } catch (error: any) {
    console.error("GET /api/users error:", error);
    return NextResponse.json({ error: "Failed to load users" }, { status: 500 });
  }
}

async function handlePost(req: Request) {
  try {
    const auth = await requirePermission("createUsers");
    if (isErrorResponse(auth)) return auth;

    const { user: currentUser } = auth;
    const body = await req.json();
    const username = String(body.username || "").trim().toLowerCase();
    const password = String(body.password || "").trim();

    if (!username || !password) {
      return NextResponse.json({ error: "Missing username or password" }, { status: 400 });
    }

    const hashedPassword = await hashPassword(password);

    const result = await execute(
      `INSERT INTO AppUser (
        username, password, role, isActive,
        viewSubscribers, createSubscribers, editSubscribers, deleteSubscribers,
        viewAccidents, createAccidents, editAccidents, deleteAccidents,
        viewAccounting, editPayments,
        viewUsers, createUsers, editUsers, deleteUsers,
        viewActivityLog, createdAt, updatedAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [
        username,
        hashedPassword,
        String(body.role || "user") === "master" ? "master" : "user",
        body.isActive ? 1 : 0,
        ...permissionFields.map((field) => (body[field] ? 1 : 0)),
      ]
    );

    await execute(
      "INSERT INTO ActivityLog (userId, username, action, module, targetId, details, createdAt) VALUES (?, ?, ?, ?, ?, ?, NOW())",
      [currentUser.id, currentUser.username, "إضافة مستخدم", "المستخدمين", String(result.insertId), username]
    );

    const createdUser = await queryOne<any>("SELECT * FROM AppUser WHERE id = ? LIMIT 1", [result.insertId]);
    return NextResponse.json(cleanUser(createdUser));
  } catch (error: any) {
    console.error("POST /api/users error:", error);
    return NextResponse.json({ error: "Failed to create user" }, { status: 500 });
  }
}

export const GET = loggedRoute("GET /api/users", handleGet);
export const POST = loggedRoute("POST /api/users", handlePost);

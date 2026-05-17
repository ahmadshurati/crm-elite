import { NextResponse } from "next/server";
import { execute, query, queryOne } from "@/lib/db";
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

export async function GET() {
  try {
    const currentUser = await getCurrentUser();

    if (!currentUser || Number(currentUser.viewUsers) !== 1) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const users = await query<any>("SELECT * FROM AppUser ORDER BY id ASC");
    return NextResponse.json(users.map(cleanUser));
  } catch (error: any) {
    console.error("GET /api/users error:", error);
    return NextResponse.json({ error: "Failed to load users", message: error?.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const currentUser = await getCurrentUser();

    if (!currentUser || Number(currentUser.createUsers) !== 1) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const username = String(body.username || "").trim().toLowerCase();
    const password = String(body.password || "").trim();

    if (!username || !password) {
      return NextResponse.json({ error: "Missing username or password" }, { status: 400 });
    }

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
        password,
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
    return NextResponse.json({ error: "Failed to create user", message: error?.message }, { status: 500 });
  }
}

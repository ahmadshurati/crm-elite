import { NextResponse } from "next/server";
import { execute, queryOne } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type LoginUser = {
  id: number;
  username: string;
  password: string;
  isActive: boolean | number;
};

const DEFAULT_USERS = [
  {
    username: "samarnada@elite",
    password: "100200300",
    role: "user",
    viewSubscribers: true,
    createSubscribers: true,
    editSubscribers: true,
    deleteSubscribers: false,
    viewAccidents: true,
    createAccidents: true,
    editAccidents: true,
    deleteAccidents: false,
    viewAccounting: false,
    editPayments: false,
    viewUsers: false,
    createUsers: false,
    editUsers: false,
    deleteUsers: false,
    viewActivityLog: false,
  },
  {
    username: "ayarasem@elite",
    password: "ayarasem1992",
    role: "master",
    viewSubscribers: true,
    createSubscribers: true,
    editSubscribers: true,
    deleteSubscribers: true,
    viewAccidents: true,
    createAccidents: true,
    editAccidents: true,
    deleteAccidents: true,
    viewAccounting: true,
    editPayments: true,
    viewUsers: true,
    createUsers: true,
    editUsers: true,
    deleteUsers: true,
    viewActivityLog: true,
  },
];

function clean(value: unknown) {
  return String(value || "").trim().toLowerCase();
}

function bool(value: boolean) {
  return value ? 1 : 0;
}

async function ensureDefaultUsers() {
  for (const user of DEFAULT_USERS) {
    await execute(
      `INSERT INTO AppUser (
        username, password, role, isActive,
        viewSubscribers, createSubscribers, editSubscribers, deleteSubscribers,
        viewAccidents, createAccidents, editAccidents, deleteAccidents,
        viewAccounting, editPayments,
        viewUsers, createUsers, editUsers, deleteUsers,
        viewActivityLog, createdAt, updatedAt
      ) VALUES (?, ?, ?, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
      ON DUPLICATE KEY UPDATE username = username`,
      [
        user.username,
        user.password,
        user.role,
        bool(user.viewSubscribers),
        bool(user.createSubscribers),
        bool(user.editSubscribers),
        bool(user.deleteSubscribers),
        bool(user.viewAccidents),
        bool(user.createAccidents),
        bool(user.editAccidents),
        bool(user.deleteAccidents),
        bool(user.viewAccounting),
        bool(user.editPayments),
        bool(user.viewUsers),
        bool(user.createUsers),
        bool(user.editUsers),
        bool(user.deleteUsers),
        bool(user.viewActivityLog),
      ]
    );
  }
}

export async function GET() {
  return NextResponse.json({ ok: true, route: "login" });
}

export async function POST(req: Request) {
  try {
    await ensureDefaultUsers();

    const body = await req.json();
    const username = clean(body.username);
    const password = String(body.password || "").trim();

    const user = await queryOne<LoginUser>(
      "SELECT id, username, password, isActive FROM AppUser WHERE username = ? LIMIT 1",
      [username]
    );

    if (!user || Number(user.isActive) !== 1 || user.password !== password) {
      return NextResponse.json({ error: "Invalid login" }, { status: 401 });
    }

    try {
      await execute(
        `INSERT INTO ActivityLog (userId, username, action, module, targetId, details, createdAt)
         VALUES (?, ?, ?, ?, NULL, ?, NOW())`,
        [user.id, user.username, "تسجيل دخول", "النظام", "تم تسجيل الدخول للنظام"]
      );
    } catch (logError) {
      console.error("Login activity log failed:", logError);
    }

    const res = NextResponse.json({ ok: true });
    const cookieOptions = {
      httpOnly: true,
      sameSite: "lax" as const,
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 2,
    };

    res.cookies.set("elite_auth", "yes", cookieOptions);
    res.cookies.set("elite_user_id", String(user.id), cookieOptions);
    res.cookies.set("elite_username", user.username, cookieOptions);

    return res;
  } catch (error: any) {
    console.error("POST /api/login error:", error);
    return NextResponse.json({ error: "Login failed", message: error?.message, code: error?.code }, { status: 500 });
  }
}

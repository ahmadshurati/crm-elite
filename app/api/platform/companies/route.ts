import { NextResponse } from "next/server";
import { cleanUser } from "@/lib/auth";
import { createCompany, listCompanies } from "@/lib/companies";
import { isPlatformErrorResponse, requirePlatformOwner } from "@/lib/platform-auth";
import { loggedRoute } from "@/lib/api-observability";
import { execute } from "@/lib/db";
import { hashPassword } from "@/lib/password";

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

function masterPermissions() {
  return Object.fromEntries(permissionFields.map((field) => [field, true])) as Record<
    (typeof permissionFields)[number],
    boolean
  >;
}

async function handleGet() {
  const auth = await requirePlatformOwner();
  if (isPlatformErrorResponse(auth)) return auth;

  try {
    const companies = await listCompanies();
    return NextResponse.json(companies);
  } catch (error: unknown) {
    console.error("GET /api/platform/companies error:", error);
    return NextResponse.json({ error: "Failed to load companies" }, { status: 500 });
  }
}

async function handlePost(req: Request) {
  const auth = await requirePlatformOwner();
  if (isPlatformErrorResponse(auth)) return auth;
  const { user: owner } = auth;

  try {
    const body = await req.json();
    const company = await createCompany({
      name: body.name,
      slug: body.slug,
      type: body.type === "dental" ? "dental" : "insurance",
      contactEmail: body.contactEmail,
      contactPhone: body.contactPhone,
      notes: body.notes,
      isDemo: Boolean(body.isDemo),
    });

    const adminUsername = String(body.adminUsername || "").trim().toLowerCase();
    const adminPassword = String(body.adminPassword || "").trim();
    let adminUser = null;

    if (adminUsername && adminPassword) {
      const perms = masterPermissions();
      const hashedPassword = await hashPassword(adminPassword);
      const result = await execute(
        `INSERT INTO AppUser (
          username, password, role, isActive, companyId,
          viewSubscribers, createSubscribers, editSubscribers, deleteSubscribers,
          viewAccidents, createAccidents, editAccidents, deleteAccidents,
          viewAccounting, editPayments,
          viewUsers, createUsers, editUsers, deleteUsers,
          viewActivityLog, createdAt, updatedAt
        ) VALUES (?, ?, 'master', 1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
        [
          adminUsername,
          hashedPassword,
          company.id,
          ...permissionFields.map((field) => (perms[field] ? 1 : 0)),
        ]
      );

      adminUser = cleanUser({ id: result.insertId, username: adminUsername, role: "master", companyId: company.id, isActive: 1, ...perms });
    }

    await execute(
      "INSERT INTO ActivityLog (userId, username, action, module, targetId, details, createdAt) VALUES (?, ?, ?, ?, ?, ?, NOW())",
      [owner.id, owner.username, "إنشاء شركة", "المنصة", String(company.id), company.name]
    );

    return NextResponse.json({ company, adminUser });
  } catch (error: unknown) {
    console.error("POST /api/platform/companies error:", error);
    const message = error instanceof Error ? error.message : "Failed to create company";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export const GET = loggedRoute("GET /api/platform/companies", handleGet);
export const POST = loggedRoute("POST /api/platform/companies", handlePost);

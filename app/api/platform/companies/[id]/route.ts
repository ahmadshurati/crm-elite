import { NextResponse } from "next/server";
import { getCompanyById, updateCompany } from "@/lib/companies";
import { execute } from "@/lib/db";
import { isPlatformErrorResponse, requirePlatformOwner } from "@/lib/platform-auth";
import { loggedRoute } from "@/lib/api-observability";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function handleGet(_req: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requirePlatformOwner();
  if (isPlatformErrorResponse(auth)) return auth;

  const { id } = await context.params;
  const company = await getCompanyById(Number(id));
  if (!company) return NextResponse.json({ error: "Company not found" }, { status: 404 });
  return NextResponse.json(company);
}

async function handlePatch(req: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requirePlatformOwner();
  if (isPlatformErrorResponse(auth)) return auth;
  const { user: owner } = auth;

  const { id } = await context.params;
  const companyId = Number(id);
  const existing = await getCompanyById(companyId);
  if (!existing) return NextResponse.json({ error: "Company not found" }, { status: 404 });

  try {
    const body = await req.json();
    const company = await updateCompany(companyId, {
      name: body.name,
      contactEmail: body.contactEmail,
      contactPhone: body.contactPhone,
      notes: body.notes,
      isActive: body.isActive,
    });

    await execute(
      "INSERT INTO ActivityLog (userId, username, action, module, targetId, details, createdAt) VALUES (?, ?, ?, ?, ?, ?, NOW())",
      [owner.id, owner.username, "تحديث شركة", "المنصة", String(companyId), company?.name || ""]
    );

    return NextResponse.json(company);
  } catch (error: unknown) {
    console.error("PATCH /api/platform/companies/[id] error:", error);
    return NextResponse.json({ error: "Failed to update company" }, { status: 500 });
  }
}

export const GET = loggedRoute("GET /api/platform/companies/[id]", handleGet);
export const PATCH = loggedRoute("PATCH /api/platform/companies/[id]", handlePatch);

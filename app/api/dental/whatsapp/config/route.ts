import { NextResponse } from "next/server";
import { ensure, requireDental } from "@/lib/dental/data";
import { getConfigStatus, saveConfig, disableConfig } from "@/lib/dental/whatsapp/config";
import { writeDentalAudit } from "@/lib/dental/services/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Status snapshot for Settings. Never returns tokens/secrets.
export async function GET() {
  const ctx = await requireDental();
  if (ctx instanceof NextResponse) return ctx;
  const denied = ensure(ctx, "settings.manage");
  if (denied) return denied;
  try {
    const status = await getConfigStatus(ctx.companyId);
    return NextResponse.json({ status });
  } catch (error) {
    console.error("GET /api/dental/whatsapp/config error:", error);
    return NextResponse.json({ error: "تعذّر تحميل الإعدادات" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const ctx = await requireDental();
  if (ctx instanceof NextResponse) return ctx;
  const denied = ensure(ctx, "settings.manage");
  if (denied) return denied;
  const body = await req.json().catch(() => ({}));
  try {
    await saveConfig(ctx.companyId, ctx.userId, {
      phoneNumberId: body.phoneNumberId,
      businessAccountId: body.businessAccountId,
      verifyToken: body.verifyToken,
      accessToken: body.accessToken,
      appSecret: body.appSecret,
      defaultCountry: body.defaultCountry,
      active: body.active !== false,
    });
    await writeDentalAudit({
      companyId: ctx.companyId,
      userId: ctx.userId,
      username: ctx.username,
      action: "update",
      entityType: "whatsappConfig",
      entityId: ctx.companyId,
      newValues: { updated: true }, // never log secrets
    });
    return NextResponse.json({ ok: true, status: await getConfigStatus(ctx.companyId) });
  } catch (error) {
    console.error("POST /api/dental/whatsapp/config error:", error);
    return NextResponse.json({ error: "تعذّر حفظ الإعدادات" }, { status: 500 });
  }
}

export async function DELETE() {
  const ctx = await requireDental();
  if (ctx instanceof NextResponse) return ctx;
  const denied = ensure(ctx, "settings.manage");
  if (denied) return denied;
  await disableConfig(ctx.companyId);
  await writeDentalAudit({
    companyId: ctx.companyId,
    userId: ctx.userId,
    username: ctx.username,
    action: "disable",
    entityType: "whatsappConfig",
    entityId: ctx.companyId,
  });
  return NextResponse.json({ ok: true, status: await getConfigStatus(ctx.companyId) });
}

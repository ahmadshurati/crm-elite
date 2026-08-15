import { NextResponse } from "next/server";
import { ensure, requireDental } from "@/lib/dental/data";
import { WHATSAPP_TEMPLATES } from "@/lib/dental/whatsapp/templates";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Returns the CRM's known template definitions. These must be created/approved in Meta separately.
export async function GET() {
  const ctx = await requireDental();
  if (ctx instanceof NextResponse) return ctx;
  const denied = ensure(ctx, "messages.send");
  if (denied) return denied;
  return NextResponse.json({ templates: WHATSAPP_TEMPLATES });
}

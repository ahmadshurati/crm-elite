import { NextResponse } from "next/server";
import { ensure, requireDental } from "@/lib/dental/data";
import { listConversations } from "@/lib/dental/whatsapp/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const ctx = await requireDental();
  if (ctx instanceof NextResponse) return ctx;
  const denied = ensure(ctx, "messages.view");
  if (denied) return denied;
  const q = new URL(req.url).searchParams.get("q") || "";
  try {
    const conversations = await listConversations(ctx.companyId, q);
    return NextResponse.json({ conversations });
  } catch (error) {
    console.error("GET /api/dental/whatsapp/conversations error:", error);
    return NextResponse.json({ error: "تعذّر تحميل المحادثات" }, { status: 500 });
  }
}

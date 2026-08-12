import { put } from "@vercel/blob";
import { NextResponse } from "next/server";
import { addDentalFile, ensure, listFiles, patientBelongs, requireDental } from "@/lib/dental/data";
import { FILE_CATEGORIES } from "@/lib/dental/constants";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX = 15 * 1024 * 1024;
const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp", "application/pdf"]);

export async function GET(req: Request, context: { params: Promise<{ id: string }> }) {
  const ctx = await requireDental();
  if (ctx instanceof NextResponse) return ctx;
  const denied = ensure(ctx, "patients.view");
  if (denied) return denied;
  const { id } = await context.params;
  const url = new URL(req.url);
  const kind = url.searchParams.get("kind");
  const tooth = url.searchParams.get("tooth");
  const kinds = kind ? FILE_CATEGORIES.filter((c) => c.kind === kind).map((c) => c.id) : undefined;
  const files = await listFiles(ctx.companyId, Number(id), { toothNumber: tooth ? Number(tooth) : null, kinds });
  return NextResponse.json({ files });
}

export async function POST(req: Request, context: { params: Promise<{ id: string }> }) {
  const ctx = await requireDental();
  if (ctx instanceof NextResponse) return ctx;
  const denied = ensure(ctx, "patients.edit");
  if (denied) return denied;
  const { id } = await context.params;
  const patientId = Number(id);
  if (!(await patientBelongs(ctx.companyId, patientId))) {
    return NextResponse.json({ error: "المريض غير موجود" }, { status: 404 });
  }
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    if (!file) return NextResponse.json({ error: "لم يتم اختيار ملف" }, { status: 400 });
    if (file.size > MAX) return NextResponse.json({ error: "حجم الملف يتجاوز 15 ميغابايت" }, { status: 400 });
    if (!ALLOWED.has(file.type)) return NextResponse.json({ error: "نوع الملف غير مدعوم (صور أو PDF)" }, { status: 400 });

    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const blob = await put(`dental/${ctx.companyId}/${patientId}/${Date.now()}-${safeName}`, file, { access: "public" });

    const fileId = await addDentalFile(ctx, patientId, {
      category: String(formData.get("category") || "other"),
      fileUrl: blob.url,
      fileName: file.name,
      mimeType: file.type,
      sizeBytes: file.size,
      description: formData.get("description") ? String(formData.get("description")) : null,
      toothNumber: formData.get("toothNumber") ? Number(formData.get("toothNumber")) : null,
      visitId: formData.get("visitId") ? Number(formData.get("visitId")) : null,
    });
    return NextResponse.json({ ok: true, id: fileId, fileUrl: blob.url });
  } catch (error: unknown) {
    console.error("DENTAL UPLOAD ERROR:", error);
    return NextResponse.json({ error: "تعذّر رفع الملف" }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { writeActivityLog } from "@/lib/audit-log";
import { execute, query } from "@/lib/db";
import { isErrorResponse, requirePermission } from "@/lib/permissions";
import { loggedRoute } from "@/lib/api-observability";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function mapRow(row: Record<string, unknown>) {
  return {
    id: Number(row.id),
    customerId: row.customerId != null ? Number(row.customerId) : null,
    customerName: row.customerName ? String(row.customerName) : null,
    folder: String(row.folder || "general"),
    fileName: String(row.fileName || ""),
    fileUrl: String(row.fileUrl || ""),
    mimeType: row.mimeType ? String(row.mimeType) : null,
    fileSize: row.fileSize != null ? Number(row.fileSize) : null,
    uploadedByUserId: row.uploadedByUserId != null ? Number(row.uploadedByUserId) : null,
    uploadedByUsername: row.uploadedByUsername ? String(row.uploadedByUsername) : null,
    createdAt: new Date(row.createdAt as string | Date).toISOString(),
  };
}

async function handleGet(req: Request) {
  const auth = await requirePermission("viewSubscribers");
  if (isErrorResponse(auth)) return auth;

  const url = new URL(req.url);
  const customerId = url.searchParams.get("customerId");
  const folder = url.searchParams.get("folder");
  const q = url.searchParams.get("q");

  const conditions: string[] = [];
  const params: unknown[] = [];

  if (customerId) {
    conditions.push("f.customerId = ?");
    params.push(Number(customerId));
  }
  if (folder) {
    conditions.push("f.folder = ?");
    params.push(folder);
  }
  if (q) {
    conditions.push("(f.fileName LIKE ? OR f.folder LIKE ?)");
    params.push(`%${q}%`, `%${q}%`);
  }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

  const rows = await query<Record<string, unknown>>(
    `SELECT f.*, c.name AS customerName, u.username AS uploadedByUsername
     FROM CrmFile f
     LEFT JOIN Customer c ON c.id = f.customerId
     LEFT JOIN AppUser u ON u.id = f.uploadedByUserId
     ${where}
     ORDER BY f.createdAt DESC
     LIMIT 200`,
    params
  );

  return NextResponse.json(rows.map(mapRow));
}

async function handlePost(req: Request) {
  const auth = await requirePermission("editSubscribers");
  if (isErrorResponse(auth)) return auth;
  const { user } = auth;

  const body = await req.json();
  const fileName = String(body.fileName || "").trim();
  const fileUrl = String(body.fileUrl || "").trim();

  if (!fileName || !fileUrl) {
    return NextResponse.json({ error: "fileName and fileUrl are required" }, { status: 400 });
  }

  const result = await execute(
    `INSERT INTO CrmFile (customerId, folder, fileName, fileUrl, mimeType, fileSize, uploadedByUserId, createdAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, NOW())`,
    [
      body.customerId != null ? Number(body.customerId) : null,
      String(body.folder || "general"),
      fileName,
      fileUrl,
      body.mimeType ? String(body.mimeType) : null,
      body.fileSize != null ? Number(body.fileSize) : null,
      user.id,
    ]
  );

  const rows = await query<Record<string, unknown>>(
    `SELECT f.*, c.name AS customerName, u.username AS uploadedByUsername
     FROM CrmFile f
     LEFT JOIN Customer c ON c.id = f.customerId
     LEFT JOIN AppUser u ON u.id = f.uploadedByUserId
     WHERE f.id = ? LIMIT 1`,
    [result.insertId]
  );

  await writeActivityLog(user, "رفع ملف", "الملفات", fileName, result.insertId);

  return NextResponse.json(mapRow(rows[0] || {}));
}

export const GET = loggedRoute("GET /api/files", handleGet);
export const POST = loggedRoute("POST /api/files", handlePost);

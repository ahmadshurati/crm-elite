"use client";

import { FolderOpen, Loader2, Trash2, Upload } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { FILES_API_URL } from "@/lib/crm/constants";
import type { Subscriber } from "@/lib/crm/types";

type CrmFile = {
  id: number;
  customerId: number | null;
  customerName: string | null;
  folder: string;
  fileName: string;
  fileUrl: string;
  mimeType: string | null;
  createdAt: string;
};

export function FilesDashboard({
  subscribers,
  canEdit,
}: {
  subscribers: Subscriber[];
  canEdit: boolean;
}) {
  const [files, setFiles] = useState<CrmFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [customerId, setCustomerId] = useState("");
  const [folder, setFolder] = useState("general");
  const inputRef = useRef<HTMLInputElement>(null);

  const loadFiles = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(FILES_API_URL, { cache: "no-store" });
      if (res.ok) setFiles(await res.json());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadFiles();
  }, [loadFiles]);

  async function handleUpload(file: File) {
    if (!canEdit) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const uploadRes = await fetch("/api/upload", { method: "POST", body: formData });
      const uploadData = await uploadRes.json();
      if (!uploadRes.ok) {
        alert(uploadData.error || "فشل الرفع");
        return;
      }

      const res = await fetch(FILES_API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileName: uploadData.fileName || file.name,
          fileUrl: uploadData.fileUrl,
          mimeType: file.type,
          fileSize: file.size,
          customerId: customerId ? Number(customerId) : null,
          folder,
        }),
      });

      if (!res.ok) {
        alert((await res.json()).error || "فشل حفظ الملف");
        return;
      }

      await loadFiles();
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(id: number) {
    if (!canEdit || !confirm("حذف هذا الملف؟")) return;
    await fetch(`${FILES_API_URL}/${id}`, { method: "DELETE" });
    await loadFiles();
  }

  return (
    <section className="mt-8 space-y-5">
      <div className="rounded-[28px] border border-[#EAECEF] bg-white px-6 py-5 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="rounded-full bg-[#EFF4FF] p-2 text-[#3B82F6]">
            <FolderOpen className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-[22px] font-bold text-[#1F2937]">مدير الملفات</h3>
            <p className="text-sm text-[#707A84]">رفع وتنظيم مستندات العملاء حسب المجلد</p>
          </div>
        </div>
      </div>

      {canEdit && (
        <div className="rounded-[28px] border border-[#EAECEF] bg-white p-6 shadow-sm">
          <div className="grid gap-3 md:grid-cols-3">
            <select
              value={customerId}
              onChange={(e) => setCustomerId(e.target.value)}
              className="rounded-xl border border-[#E5E7EB] px-3 py-2 text-sm"
            >
              <option value="">بدون عميل</option>
              {subscribers.map((s) => (
                <option key={s.customerId} value={s.customerId}>
                  {s.subscriberName}
                </option>
              ))}
            </select>
            <input
              value={folder}
              onChange={(e) => setFolder(e.target.value)}
              placeholder="المجلد"
              className="rounded-xl border border-[#E5E7EB] px-3 py-2 text-sm"
            />
            <button
              type="button"
              disabled={uploading}
              onClick={() => inputRef.current?.click()}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#3B82F6] px-4 py-2 text-sm font-bold text-white disabled:opacity-60"
            >
              <Upload className="h-4 w-4" />
              {uploading ? "جاري الرفع..." : "رفع ملف"}
            </button>
            <input
              ref={inputRef}
              type="file"
              className="hidden"
              accept="image/jpeg,image/png,image/webp,application/pdf"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void handleUpload(file);
                e.target.value = "";
              }}
            />
          </div>
        </div>
      )}

      <div className="rounded-[28px] border border-[#EAECEF] bg-white shadow-sm">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-[#707A84]">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : (
          <table className="min-w-full text-right text-sm">
            <thead>
              <tr className="border-b border-[#F1F5F9] text-[#707A84]">
                <th className="px-6 py-3">الاسم</th>
                <th className="px-6 py-3">المجلد</th>
                <th className="px-6 py-3">العميل</th>
                <th className="px-6 py-3">التاريخ</th>
                <th className="px-6 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {files.map((file) => (
                <tr key={file.id} className="border-b border-[#F1F5F9]">
                  <td className="px-6 py-3">
                    <a href={file.fileUrl} target="_blank" rel="noreferrer" className="font-bold text-[#3B82F6] hover:underline">
                      {file.fileName}
                    </a>
                  </td>
                  <td className="px-6 py-3">{file.folder}</td>
                  <td className="px-6 py-3">{file.customerName || "—"}</td>
                  <td className="px-6 py-3 text-xs text-[#707A84]">
                    {new Date(file.createdAt).toLocaleDateString("ar")}
                  </td>
                  <td className="px-6 py-3">
                    {canEdit && (
                      <button type="button" onClick={() => handleDelete(file.id)} className="text-rose-600">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}

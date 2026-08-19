"use client";

import { CheckCircle2, Loader2, Plug, XCircle } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import {
  INTEGRATIONS_STATUS_API_URL,
  INTEGRATIONS_MESSAGES_API_URL,
  API_KEYS_API_URL,
  OPENAPI_API_URL,
  BACKUP_EXPORT_API_URL,
} from "@/lib/crm/constants";

type IntegrationStatus = {
  email: { configured: boolean; provider: string; fromEmail: string | null };
  sms: { configured: boolean; provider: string };
  whatsapp: { configured: boolean; provider: string };
  ai: { configured: boolean; provider: string; model: string | null };
  payments: { configured: boolean; provider: string | null };
  emailTemplates: number;
  envHints: Record<string, string>;
};

type OutboundMessage = {
  id: number;
  channel: string;
  recipient: string;
  status: string;
  provider: string | null;
  errorMessage: string | null;
  createdAt: string;
};

type ApiKeyRow = {
  id: number;
  name: string;
  keyPrefix: string;
  scopes: string[];
  isActive: boolean;
  createdAt: string;
};

function StatusBadge({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-bold ${
        ok ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"
      }`}
    >
      {ok ? <CheckCircle2 className="h-3.5 w-3.5" /> : <XCircle className="h-3.5 w-3.5" />}
      {label}
    </span>
  );
}

export function IntegrationsDashboard({ canEdit }: { canEdit: boolean }) {
  const [status, setStatus] = useState<IntegrationStatus | null>(null);
  const [messages, setMessages] = useState<OutboundMessage[]>([]);
  const [apiKeys, setApiKeys] = useState<ApiKeyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [newKeyName, setNewKeyName] = useState("");
  const [createdKey, setCreatedKey] = useState<string | null>(null);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [statusRes, messagesRes, keysRes] = await Promise.all([
        fetch(INTEGRATIONS_STATUS_API_URL, { cache: "no-store" }),
        fetch(INTEGRATIONS_MESSAGES_API_URL, { cache: "no-store" }),
        fetch(API_KEYS_API_URL, { cache: "no-store" }),
      ]);

      if (statusRes.ok) setStatus(await statusRes.json());
      if (messagesRes.ok) setMessages(await messagesRes.json());
      if (keysRes.ok) setApiKeys(await keysRes.json());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  async function createApiKey() {
    if (!canEdit || !newKeyName.trim()) return;
    const res = await fetch(API_KEYS_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newKeyName.trim() }),
    });
    const data = await res.json();
    if (!res.ok) {
      alert(data.error || "فشل إنشاء المفتاح");
      return;
    }
    setCreatedKey(data.key);
    setNewKeyName("");
    await loadAll();
  }

  async function revokeKey(id: number) {
    if (!canEdit || !confirm("إلغاء هذا المفتاح؟")) return;
    await fetch(`${API_KEYS_API_URL}/${id}`, { method: "DELETE" });
    await loadAll();
  }

  if (loading) {
    return (
      <div className="mt-8 flex items-center justify-center rounded-[28px] border border-[#EAECEF] bg-white py-20 text-[#707A84]">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  return (
    <section className="mt-8 space-y-5">
      <div className="rounded-[28px] border border-[#EAECEF] bg-white px-6 py-5 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="rounded-full bg-[#EFF4FF] p-2 text-[#2563EB]">
            <Plug className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-[22px] font-bold text-[#1F2937]">التكاملات وواجهات API</h3>
            <p className="mt-1 text-sm text-[#707A84]">
              أضف مفاتيح API في متغيرات البيئة (.env) — الواجهات جاهزة وتعمل فور التفعيل
            </p>
            <a
              href={OPENAPI_API_URL}
              target="_blank"
              rel="noreferrer"
              className="mt-2 inline-block text-sm font-bold text-[#2563EB] hover:underline"
            >
              فتح مواصفات OpenAPI (/api/openapi)
            </a>
            {canEdit && (
              <div className="mt-3 flex flex-wrap gap-2">
                <a
                  href={`${BACKUP_EXPORT_API_URL}?scope=summary`}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700"
                >
                  نسخة احتياطية (ملخص)
                </a>
                <a
                  href={`${BACKUP_EXPORT_API_URL}?scope=full`}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700"
                >
                  نسخة احتياطية (JSON)
                </a>
              </div>
            )}
          </div>
        </div>
      </div>

      {status && (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {[
            { key: "email", title: "البريد الإلكتروني", hint: status.envHints.email },
            { key: "sms", title: "SMS", hint: status.envHints.sms },
            { key: "whatsapp", title: "WhatsApp", hint: status.envHints.whatsapp },
            { key: "ai", title: "الذكاء الاصطناعي", hint: status.envHints.ai },
            { key: "payments", title: "المدفوعات", hint: status.envHints.payments },
          ].map((item) => {
            const block = status[item.key as keyof IntegrationStatus] as { configured: boolean; provider: string };
            return (
              <div key={item.key} className="rounded-[24px] border border-[#EAECEF] bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-bold text-[#1F2937]">{item.title}</p>
                  <StatusBadge ok={block.configured} label={block.configured ? "مفعّل" : "بانتظار API"} />
                </div>
                <p className="mt-2 text-xs text-[#707A84]">المزود: {block.provider || "—"}</p>
                <p className="mt-3 rounded-xl bg-[#F8FAFC] p-3 text-xs text-[#64748B]" dir="ltr">
                  {item.hint}
                </p>
              </div>
            );
          })}
          <div className="rounded-[24px] border border-[#EAECEF] bg-white p-5 shadow-sm">
            <p className="font-bold text-[#1F2937]">قوالب البريد</p>
            <p className="mt-2 text-2xl font-bold text-[#2563EB]">{status.emailTemplates}</p>
            <p className="text-xs text-[#707A84]">قالب جاهز للاستخدام</p>
          </div>
        </div>
      )}

      <div className="rounded-[28px] border border-[#EAECEF] bg-white p-6 shadow-sm">
        <h4 className="font-bold text-[#1F2937]">مفاتيح API للتطبيقات الخارجية</h4>
        <p className="mt-1 text-sm text-[#707A84]">مرّر المفتاح في رأس X-API-Key أو Authorization: Bearer</p>

        {canEdit && (
          <div className="mt-4 flex flex-wrap gap-2">
            <input
              value={newKeyName}
              onChange={(e) => setNewKeyName(e.target.value)}
              placeholder="اسم التطبيق (مثلاً: تطبيق الجوال)"
              className="min-w-[220px] flex-1 rounded-xl border border-[#E5E7EB] px-3 py-2 text-sm"
            />
            <button
              type="button"
              onClick={createApiKey}
              className="rounded-xl bg-[#2563EB] px-4 py-2 text-sm font-bold text-white"
            >
              إنشاء مفتاح
            </button>
          </div>
        )}

        {createdKey && (
          <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm" dir="ltr">
            <p className="font-bold text-emerald-800">احفظ المفتاح الآن — لن يُعرض مرة أخرى:</p>
            <code className="mt-2 block break-all text-emerald-900">{createdKey}</code>
          </div>
        )}

        <div className="mt-4 divide-y divide-[#F1F5F9]">
          {apiKeys.map((key) => (
            <div key={key.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
              <div>
                <p className="font-bold text-[#1F2937]">{key.name}</p>
                <p className="text-xs text-[#707A84]" dir="ltr">
                  {key.keyPrefix}… — {key.scopes.join(", ")}
                </p>
              </div>
              {canEdit && key.isActive && (
                <button type="button" onClick={() => revokeKey(key.id)} className="text-xs font-bold text-rose-600">
                  إلغاء
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-[28px] border border-[#EAECEF] bg-white p-6 shadow-sm">
        <h4 className="font-bold text-[#1F2937]">سجل الرسائل الصادرة</h4>
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-right text-sm">
            <thead>
              <tr className="text-[#707A84]">
                <th className="px-3 py-2">القناة</th>
                <th className="px-3 py-2">المستلم</th>
                <th className="px-3 py-2">الحالة</th>
                <th className="px-3 py-2">التاريخ</th>
              </tr>
            </thead>
            <tbody>
              {messages.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-3 py-8 text-center text-[#707A84]">
                    لا توجد رسائل بعد
                  </td>
                </tr>
              ) : (
                messages.map((msg) => (
                  <tr key={msg.id} className="border-t border-[#F1F5F9]">
                    <td className="px-3 py-2">{msg.channel}</td>
                    <td className="px-3 py-2" dir="ltr">
                      {msg.recipient}
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                          msg.status === "sent"
                            ? "bg-emerald-50 text-emerald-700"
                            : msg.status === "skipped"
                            ? "bg-amber-50 text-amber-700"
                            : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {msg.status}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-xs text-[#707A84]">{new Date(msg.createdAt).toLocaleString("ar")}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

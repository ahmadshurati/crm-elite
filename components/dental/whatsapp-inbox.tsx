"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  ArrowRight,
  Check,
  CheckCheck,
  Clock,
  Link2,
  MessageCircle,
  RefreshCw,
  Search,
  Send,
  Trash2,
  User,
} from "lucide-react";
import {
  apiFetch,
  EmptyState,
  ErrorState,
  fmtDate,
  fmtDateTime,
  fmtTime,
  Spinner,
  StateView,
  useApi,
  useConfirm,
  useMutation,
  useToast,
} from "@/components/dental/ui";

type Conversation = {
  id: number;
  patientId: number | null;
  patientName: string | null;
  phone: string;
  waName: string | null;
  lastMessageText: string | null;
  lastMessageAt: string | null;
  lastInboundAt: string | null;
  unreadCount: number;
  status: string;
  withinWindow: boolean;
};

type Message = {
  id: number;
  wamid: string | null;
  direction: "inbound" | "outbound";
  type: string;
  body: string | null;
  templateName: string | null;
  status: "pending" | "sent" | "delivered" | "read" | "failed";
  errorMessage: string | null;
  timestamp: string | null;
};

type TemplateDef = {
  name: string;
  label: string;
  description: string;
  defaultLanguage: string;
  variables: { key: string; label: string; example: string }[];
};

const POLL_MS = 12000;

function convTitle(c: Conversation): string {
  return c.patientName || c.waName || `+${c.phone}`;
}

function shortWhen(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const today = new Date();
  const sameDay = d.toDateString() === today.toDateString();
  return sameDay ? fmtTime(iso) : fmtDate(iso);
}

/** Poll a callback while the tab is visible. Cleans up on unmount. */
function usePolling(fn: () => void, ms: number) {
  const saved = useRef(fn);
  useEffect(() => {
    saved.current = fn;
  }, [fn]);
  useEffect(() => {
    const tick = () => {
      if (typeof document !== "undefined" && document.hidden) return;
      saved.current();
    };
    const t = setInterval(tick, ms);
    return () => clearInterval(t);
  }, [ms]);
}

/* ============================ Inbox (list + thread) ============================ */

export function WhatsAppInbox({ onOpenPatient }: { onOpenPatient: (id: number, tab?: string) => void }) {
  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [selected, setSelected] = useState<number | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q), 300);
    return () => clearTimeout(t);
  }, [q]);

  const { data, loading, error, reload } = useApi<{ conversations: Conversation[] }>(
    `/api/dental/whatsapp/conversations?q=${encodeURIComponent(debouncedQ)}`
  );
  const conversations = useMemo(() => data?.conversations ?? [], [data]);

  usePolling(reload, POLL_MS);

  // Keep a selection valid; default to the first conversation on desktop.
  useEffect(() => {
    if (selected == null && conversations.length > 0) setSelected(conversations[0].id);
    if (selected != null && conversations.length > 0 && !conversations.some((c) => c.id === selected)) {
      setSelected(conversations[0].id);
    }
  }, [conversations, selected]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-[#1F2937]">واتساب</h2>
          <p className="text-sm text-[#94A3B8]">محادثات المرضى عبر WhatsApp.</p>
        </div>
        <button
          onClick={reload}
          className="inline-flex items-center gap-1.5 rounded-xl border border-[#E5E7EB] bg-white px-3 py-2 text-sm font-bold text-[#475569] hover:bg-[#F8FAFC]"
        >
          <RefreshCw className="h-4 w-4" /> تحديث
        </button>
      </div>

      <div className="grid h-[calc(100vh-220px)] min-h-[520px] grid-cols-1 gap-4 lg:grid-cols-[340px_1fr]">
        {/* Conversation list */}
        <div className={`flex flex-col rounded-[24px] border border-[#EAECEF] bg-white shadow-sm ${selected != null ? "hidden lg:flex" : "flex"}`}>
          <div className="border-b border-[#EEF1F4] p-3">
            <div className="relative">
              <Search className="absolute right-3 top-2.5 h-4 w-4 text-[#94A3B8]" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                aria-label="بحث المحادثات"
                placeholder="بحث بالاسم أو الرقم..."
                className="h-10 w-full rounded-xl border border-[#E5E7EB] bg-[#F8FAFC] pr-10 pl-3 text-sm outline-none focus:border-[#0F8B94]"
              />
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            <StateView
              loading={loading}
              error={error}
              onRetry={reload}
              isEmpty={conversations.length === 0}
              empty={<EmptyState icon={MessageCircle} title={debouncedQ ? "لا محادثات مطابقة" : "لا توجد محادثات بعد"} hint={debouncedQ ? "جرّب بحثًا آخر." : "ستظهر المحادثات هنا عند وصول رسالة أو عند بدء محادثة من ملف المريض."} />}
            >
              <ul className="divide-y divide-[#F1F5F9]">
                {conversations.map((c) => (
                  <li key={c.id}>
                    <button
                      onClick={() => setSelected(c.id)}
                      className={`flex w-full items-start gap-3 px-4 py-3 text-right transition ${selected === c.id ? "bg-[#F1FBFA]" : "hover:bg-[#F8FAFC]"}`}
                    >
                      <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#E7F6F5] text-[#0F8B94]">
                        <User className="h-5 w-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className="truncate font-bold text-[#1F2937]">{convTitle(c)}</p>
                          <span className="shrink-0 text-[10px] text-[#94A3B8]">{shortWhen(c.lastMessageAt)}</span>
                        </div>
                        <div className="mt-0.5 flex items-center justify-between gap-2">
                          <p className="truncate text-xs text-[#94A3B8]">{c.lastMessageText || (c.patientId ? "—" : "جهة غير معروفة")}</p>
                          {c.unreadCount > 0 && (
                            <span className="shrink-0 rounded-full bg-[#0F8B94] px-1.5 py-0.5 text-[10px] font-bold text-white">{c.unreadCount}</span>
                          )}
                        </div>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            </StateView>
          </div>
        </div>

        {/* Thread */}
        <div className={`min-h-0 ${selected != null ? "flex" : "hidden lg:flex"} flex-col rounded-[24px] border border-[#EAECEF] bg-white shadow-sm`}>
          {selected != null ? (
            <ConversationView
              conversationId={selected}
              onOpenPatient={onOpenPatient}
              onChanged={reload}
              onBack={() => setSelected(null)}
            />
          ) : (
            <div className="flex flex-1 items-center justify-center p-8">
              <EmptyState icon={MessageCircle} title="اختر محادثة" hint="اختر محادثة من القائمة لعرض الرسائل." />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ============================ Conversation view (reusable) ============================ */

export function ConversationView({
  conversationId,
  onOpenPatient,
  onChanged,
  onBack,
  compact,
}: {
  conversationId: number;
  onOpenPatient?: (id: number, tab?: string) => void;
  onChanged?: () => void;
  onBack?: () => void;
  compact?: boolean;
}) {
  const toast = useToast();
  const confirm = useConfirm();
  const { data, loading, error, reload } = useApi<{ conversation: Conversation; messages: Message[] }>(
    `/api/dental/whatsapp/conversations/${conversationId}`
  );
  const conversation = data?.conversation ?? null;
  const messages = useMemo(() => data?.messages ?? [], [data]);
  const [text, setText] = useState("");
  const [showTemplates, setShowTemplates] = useState(false);
  const { pending, run } = useMutation();
  const scrollRef = useRef<HTMLDivElement>(null);
  const markedRef = useRef<number | null>(null);

  usePolling(reload, POLL_MS);

  // Auto-scroll to the newest message.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length, conversationId]);

  // Mark as read once per conversation load when there are unread messages.
  useEffect(() => {
    if (conversation && conversation.unreadCount > 0 && markedRef.current !== conversationId) {
      markedRef.current = conversationId;
      apiFetch(`/api/dental/whatsapp/conversations/${conversationId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "read" }),
      }).then(() => onChanged?.());
    }
  }, [conversation, conversationId, onChanged]);

  async function sendText() {
    const body = text.trim();
    if (!body || pending) return;
    const ok = await run(`/api/dental/whatsapp/conversations/${conversationId}/messages`, "POST", { type: "text", body });
    if (ok) {
      setText("");
      reload();
      onChanged?.();
    }
  }

  async function deleteConv() {
    const yes = await confirm({ title: "حذف المحادثة", message: "سيتم حذف هذه المحادثة وكل رسائلها نهائيًا. لا يمكن التراجع.", confirmText: "حذف", cancelText: "إلغاء", danger: true });
    if (!yes) return;
    const r = await apiFetch(`/api/dental/whatsapp/conversations/${conversationId}`, { method: "DELETE" });
    if (r.ok) { toast.success("تم حذف المحادثة"); onChanged?.(); onBack?.(); }
    else toast.error(r.error || "تعذّر حذف المحادثة");
  }

  async function deleteMsg(id: number) {
    const yes = await confirm({ title: "حذف الرسالة", message: "حذف هذه الرسالة نهائيًا؟", confirmText: "حذف", cancelText: "إلغاء", danger: true });
    if (!yes) return;
    const r = await apiFetch(`/api/dental/whatsapp/conversations/${conversationId}/messages?messageId=${id}`, { method: "DELETE" });
    if (r.ok) { toast.success("تم حذف الرسالة"); reload(); onChanged?.(); }
    else toast.error(r.error || "تعذّر حذف الرسالة");
  }

  if (!conversation) {
    return (
      <div className="flex flex-1 items-center justify-center p-8">
        {loading ? <Spinner /> : <ErrorState message={error || "تعذّر تحميل المحادثة"} onRetry={reload} />}
      </div>
    );
  }

  const canFreeText = conversation.withinWindow;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 border-b border-[#EEF1F4] p-3">
        <div className="flex min-w-0 items-center gap-3">
          {onBack && (
            <button onClick={onBack} className="rounded-lg p-1.5 text-[#475569] hover:bg-[#F1F5F9] lg:hidden">
              <ArrowRight className="h-5 w-5" />
            </button>
          )}
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#E7F6F5] text-[#0F8B94]">
            <User className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="truncate font-bold text-[#1F2937]">{convTitle(conversation)}</p>
            <p className="text-xs text-[#94A3B8]" dir="ltr">+{conversation.phone}</p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {conversation.patientId ? (
            onOpenPatient && (
              <button
                onClick={() => onOpenPatient(conversation.patientId!)}
                className="inline-flex items-center gap-1 rounded-lg bg-[#F1FBFA] px-2.5 py-1.5 text-xs font-bold text-[#0F8B94] hover:bg-[#E3F5F4]"
              >
                <User className="h-3.5 w-3.5" /> فتح الملف
              </button>
            )
          ) : (
            <LinkPatient conversationId={conversationId} onLinked={() => { reload(); onChanged?.(); }} />
          )}
          {onBack && (
            <button
              onClick={deleteConv}
              title="حذف المحادثة"
              className="inline-flex items-center gap-1 rounded-lg bg-rose-50 px-2.5 py-1.5 text-xs font-bold text-rose-600 hover:bg-rose-100"
            >
              <Trash2 className="h-3.5 w-3.5" /> حذف
            </button>
          )}
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className={`min-h-0 flex-1 space-y-2 overflow-y-auto bg-[#F7FAFB] p-4 ${compact ? "max-h-[420px]" : ""}`}>
        {messages.length === 0 && (
          <p className="py-10 text-center text-sm text-[#94A3B8]">لا توجد رسائل في هذه المحادثة بعد.</p>
        )}
        {messages.map((m) => (
          <MessageBubble key={m.id} m={m} onDelete={deleteMsg} />
        ))}
      </div>

      {/* Composer */}
      <div className="border-t border-[#EEF1F4] p-3">
        {canFreeText ? (
          <div className="flex items-end gap-2">
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendText(); } }}
              rows={1}
              placeholder="اكتب رسالة..."
              className="max-h-32 min-h-[44px] flex-1 resize-none rounded-xl border border-[#E5E7EB] bg-white px-3 py-2.5 text-sm outline-none focus:border-[#0F8B94]"
            />
            <button
              onClick={sendText}
              disabled={pending || !text.trim()}
              className="inline-flex h-11 items-center gap-1.5 rounded-xl bg-[#0F8B94] px-4 text-sm font-bold text-white hover:bg-[#0B6E75] disabled:opacity-60"
            >
              <Send className="h-4 w-4" /> إرسال
            </button>
          </div>
        ) : (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
            <p className="flex items-center gap-1.5 text-xs font-bold text-amber-700">
              <Clock className="h-4 w-4" /> انتهت نافذة 24 ساعة للرسائل الحرة
            </p>
            <p className="mt-1 text-xs text-amber-700/80">لا يمكن إرسال رسالة نصية عادية الآن. استخدم قالبًا معتمدًا للتواصل مع المريض.</p>
            <button
              onClick={() => setShowTemplates(true)}
              className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-amber-700"
            >
              إرسال قالب معتمد
            </button>
          </div>
        )}
        <div className="mt-2 flex items-center justify-between">
          <button onClick={() => setShowTemplates((v) => !v)} className="text-xs font-bold text-[#0F8B94] hover:underline">
            {showTemplates ? "إخفاء القوالب" : "إرسال قالب معتمد"}
          </button>
        </div>
        {showTemplates && (
          <TemplateSender
            conversationId={conversationId}
            onSent={() => { setShowTemplates(false); reload(); onChanged?.(); toast.success("تم إرسال القالب"); }}
          />
        )}
      </div>
    </div>
  );
}

function MessageBubble({ m, onDelete }: { m: Message; onDelete?: (id: number) => void }) {
  const out = m.direction === "outbound";
  return (
    <div className={`group flex items-center gap-1.5 ${out ? "justify-start" : "justify-end"}`}>
      {out && onDelete && <DeleteMessageButton onClick={() => onDelete(m.id)} />}
      <div
        className={`max-w-[78%] rounded-2xl px-3 py-2 text-sm shadow-sm ${
          out
            ? m.status === "failed"
              ? "bg-rose-50 text-rose-800 ring-1 ring-rose-200"
              : "bg-[#0F8B94] text-white"
            : "bg-white text-[#1F2937] ring-1 ring-[#EAECEF]"
        }`}
      >
        {m.templateName && (
          <span className={`mb-0.5 block text-[10px] font-bold ${out && m.status !== "failed" ? "text-white/80" : "text-[#94A3B8]"}`}>
            قالب: {m.templateName}
          </span>
        )}
        <p className="whitespace-pre-wrap break-words">{m.body || "—"}</p>
        <div className={`mt-1 flex items-center justify-end gap-1 text-[10px] ${out && m.status !== "failed" ? "text-white/70" : "text-[#94A3B8]"}`}>
          <span>{m.timestamp ? fmtTime(m.timestamp) : ""}</span>
          {out && <StatusTicks status={m.status} />}
        </div>
        {m.status === "failed" && m.errorMessage && (
          <p className="mt-1 text-[10px] text-rose-600">{m.errorMessage}</p>
        )}
      </div>
      {!out && onDelete && <DeleteMessageButton onClick={() => onDelete(m.id)} />}
    </div>
  );
}

function DeleteMessageButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      title="حذف الرسالة"
      className="shrink-0 rounded-md p-1 text-[#B6C2CE] opacity-0 transition hover:bg-rose-50 hover:text-rose-600 focus:opacity-100 group-hover:opacity-100"
    >
      <Trash2 className="h-3.5 w-3.5" />
    </button>
  );
}

function StatusTicks({ status }: { status: Message["status"] }) {
  if (status === "pending") return <Clock className="h-3 w-3" aria-label="قيد الإرسال" />;
  if (status === "sent") return <Check className="h-3 w-3" aria-label="أُرسلت" />;
  if (status === "delivered") return <CheckCheck className="h-3 w-3" aria-label="وصلت" />;
  if (status === "read") return <CheckCheck className="h-3 w-3 text-sky-300" aria-label="قُرئت" />;
  if (status === "failed") return <AlertCircle className="h-3 w-3 text-rose-500" aria-label="فشلت" />;
  return null;
}

/* ============================ Template sender ============================ */

function TemplateSender({ conversationId, onSent }: { conversationId: number; onSent: () => void }) {
  const { data } = useApi<{ templates: TemplateDef[] }>("/api/dental/whatsapp/templates");
  const templates = useMemo(() => data?.templates ?? [], [data]);
  const [name, setName] = useState("");
  const [params, setParams] = useState<Record<string, string>>({});
  const { pending, run } = useMutation();
  const def = templates.find((t) => t.name === name) || null;

  async function send() {
    if (!def || pending) return;
    const ordered = def.variables.map((v) => params[v.key] || "");
    const ok = await run(`/api/dental/whatsapp/conversations/${conversationId}/messages`, "POST", {
      type: "template",
      templateName: def.name,
      templateLanguage: def.defaultLanguage,
      templateParams: ordered,
    });
    if (ok) { setName(""); setParams({}); onSent(); }
  }

  return (
    <div className="mt-2 rounded-xl border border-[#E5E7EB] bg-[#F8FAFC] p-3">
      <select
        value={name}
        onChange={(e) => { setName(e.target.value); setParams({}); }}
        className="h-10 w-full rounded-lg border border-[#E5E7EB] bg-white px-3 text-sm outline-none focus:border-[#0F8B94]"
      >
        <option value="">اختر قالبًا معتمدًا…</option>
        {templates.map((t) => <option key={t.name} value={t.name}>{t.label}</option>)}
      </select>
      {def && (
        <>
          <p className="mt-2 text-xs text-[#94A3B8]">{def.description}</p>
          <div className="mt-2 space-y-2">
            {def.variables.map((v) => (
              <input
                key={v.key}
                value={params[v.key] || ""}
                onChange={(e) => setParams((p) => ({ ...p, [v.key]: e.target.value }))}
                placeholder={`${v.label} (مثال: ${v.example})`}
                className="h-10 w-full rounded-lg border border-[#E5E7EB] bg-white px-3 text-sm outline-none focus:border-[#0F8B94]"
              />
            ))}
          </div>
          <button
            onClick={send}
            disabled={pending}
            className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-[#0F8B94] px-4 py-2 text-sm font-bold text-white hover:bg-[#0B6E75] disabled:opacity-60"
          >
            <Send className="h-4 w-4" /> إرسال القالب
          </button>
        </>
      )}
    </div>
  );
}

/* ============================ Link an unknown contact to a patient ============================ */

function LinkPatient({ conversationId, onLinked }: { conversationId: number; onLinked: () => void }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const { pending, run } = useMutation();

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q), 300);
    return () => clearTimeout(t);
  }, [q]);

  const { data } = useApi<{ patients: { id: number; fullName: string; phone: string | null; patientNumber: string }[] }>(
    open && debouncedQ.trim().length >= 2 ? `/api/dental/patients?q=${encodeURIComponent(debouncedQ)}` : null
  );
  const patients = data?.patients ?? [];

  async function link(patientId: number) {
    const ok = await run(`/api/dental/whatsapp/conversations/${conversationId}`, "PATCH", { action: "link", patientId }, { success: "تم ربط المحادثة بالمريض" });
    if (ok) { setOpen(false); setQ(""); onLinked(); }
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1 rounded-lg bg-[#FFF7ED] px-2.5 py-1.5 text-xs font-bold text-amber-700 hover:bg-[#FFEDD5]"
      >
        <Link2 className="h-3.5 w-3.5" /> ربط بمريض
      </button>
      {open && (
        <div className="absolute left-0 top-10 z-40 w-72 rounded-2xl border border-[#EAECEF] bg-white p-2 shadow-xl">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            autoFocus
            placeholder="ابحث عن مريض بالاسم/الهاتف…"
            className="mb-2 h-9 w-full rounded-lg border border-[#E5E7EB] px-3 text-sm outline-none focus:border-[#0F8B94]"
          />
          <div className="max-h-64 overflow-y-auto">
            {debouncedQ.trim().length < 2 && <p className="p-2 text-center text-xs text-[#94A3B8]">اكتب حرفين على الأقل للبحث.</p>}
            {debouncedQ.trim().length >= 2 && patients.length === 0 && <p className="p-2 text-center text-xs text-[#94A3B8]">لا نتائج.</p>}
            {patients.map((p) => (
              <button
                key={p.id}
                onClick={() => link(p.id)}
                disabled={pending}
                className="flex w-full items-center justify-between rounded-lg px-2 py-2 text-right text-sm hover:bg-[#F8FAFC] disabled:opacity-60"
              >
                <span className="font-bold text-[#1F2937]">{p.fullName}</span>
                <span className="text-xs text-[#94A3B8]" dir="ltr">{p.phone || p.patientNumber}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ============================ Patient profile: WhatsApp tab + summary card ============================ */

export function PatientWhatsApp({ patientId, onOpenInbox }: { patientId: number; onOpenInbox?: () => void }) {
  const toast = useToast();
  const [conversationId, setConversationId] = useState<number | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "error" | "empty">("loading");
  const [errMsg, setErrMsg] = useState("");

  const open = useCallback(async () => {
    setStatus("loading");
    const r = await apiFetch<{ conversationId: number }>(`/api/dental/patients/${patientId}/whatsapp`, { method: "POST" });
    if (r.ok) {
      setConversationId(r.data.conversationId);
      setStatus("idle");
    } else {
      setErrMsg(r.error);
      setStatus("error");
    }
  }, [patientId]);

  useEffect(() => { open(); }, [open]);

  if (status === "loading") {
    return <div className="flex justify-center rounded-[24px] border border-[#EAECEF] bg-white p-10 shadow-sm"><Spinner /></div>;
  }
  if (status === "error") {
    return (
      <div className="rounded-[24px] border border-[#EAECEF] bg-white p-4 shadow-sm">
        <ErrorState message={errMsg || "تعذّر فتح المحادثة"} onRetry={open} />
        {onOpenInbox && (
          <button onClick={onOpenInbox} className="mt-2 text-sm font-bold text-[#0F8B94] hover:underline">فتح صندوق الوارد</button>
        )}
      </div>
    );
  }
  if (conversationId == null) {
    return <EmptyState icon={MessageCircle} title="لا يمكن بدء محادثة" hint="تأكد من وجود رقم هاتف/واتساب صالح لهذا المريض." />;
  }
  return (
    <div className="rounded-[24px] border border-[#EAECEF] bg-white shadow-sm">
      <div className="flex h-[calc(100vh-320px)] min-h-[420px] flex-col">
        <ConversationView conversationId={conversationId} onChanged={() => { /* profile stays light */ void toast; }} />
      </div>
    </div>
  );
}

export type PatientWaSummary = {
  conversationId: number | null;
  lastMessageText: string | null;
  lastMessageAt: string | null;
  unreadCount: number;
  withinWindow: boolean;
};

export function PatientWhatsAppCard({ patientId, onOpen }: { patientId: number; onOpen: () => void }) {
  const { data, loading } = useApi<{ summary: PatientWaSummary }>(`/api/dental/patients/${patientId}/whatsapp`);
  const s = data?.summary;
  return (
    <div className="rounded-[20px] border border-[#EAECEF] bg-white p-4 shadow-sm">
      <div className="mb-2 flex items-center gap-2">
        <MessageCircle className="h-4 w-4 text-[#25D366]" />
        <h4 className="text-sm font-bold text-[#1F2937]">واتساب</h4>
        {s && s.unreadCount > 0 && (
          <span className="rounded-full bg-[#0F8B94] px-1.5 py-0.5 text-[10px] font-bold text-white">{s.unreadCount}</span>
        )}
      </div>
      {loading && !data ? (
        <p className="text-xs text-[#94A3B8]">جارِ التحميل…</p>
      ) : s && s.conversationId ? (
        <>
          <p className="truncate text-sm text-[#475569]">{s.lastMessageText || "لا رسائل بعد"}</p>
          <p className="mt-0.5 text-xs text-[#94A3B8]">{s.lastMessageAt ? `آخر تواصل: ${fmtDateTime(s.lastMessageAt)}` : ""}</p>
        </>
      ) : (
        <p className="text-sm text-[#94A3B8]">لا توجد محادثة بعد.</p>
      )}
      <button
        onClick={onOpen}
        className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-[#0F8B94] px-4 py-2 text-sm font-bold text-white hover:bg-[#0B6E75]"
      >
        <MessageCircle className="h-4 w-4" /> فتح المحادثة
      </button>
    </div>
  );
}

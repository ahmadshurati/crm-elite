"use client";

import {
  Camera,
  CheckCircle2,
  Loader2,
  Mail,
  MessageCircle,
  Phone,
  Reply,
  Send,
  XCircle,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { INBOX_API_URL } from "@/lib/crm/constants";
import type { InboxMessage } from "@/lib/inbox";

type InboxChannelTab = "all" | "whatsapp" | "gmail" | "sms" | "instagram";
type SendChannel = "whatsapp" | "email" | "sms";

type ChannelStatus = {
  configured: boolean;
  provider: string;
  fromEmail?: string | null;
};

type InboxResponse = {
  messages: InboxMessage[];
  unreadCounts: Record<string, number>;
  channels: {
    whatsapp: ChannelStatus;
    gmail: ChannelStatus;
    email: ChannelStatus;
    sms: ChannelStatus;
    instagram: ChannelStatus;
  };
};

const tabs: { id: InboxChannelTab; label: string; icon: typeof Mail }[] = [
  { id: "all", label: "الكل", icon: MessageCircle },
  { id: "whatsapp", label: "واتساب", icon: MessageCircle },
  { id: "gmail", label: "Gmail", icon: Mail },
  { id: "sms", label: "SMS", icon: Phone },
  { id: "instagram", label: "إنستغرام", icon: Camera },
];

const channelLabels: Record<string, string> = {
  whatsapp: "واتساب",
  email: "بريد",
  gmail: "Gmail",
  sms: "SMS",
  instagram: "إنستغرام",
};

function mapMessageChannelToSend(channel: string): SendChannel | null {
  if (channel === "whatsapp") return "whatsapp";
  if (channel === "sms") return "sms";
  if (channel === "email" || channel === "gmail") return "email";
  return null;
}

function StatusPill({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold ${
        ok ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"
      }`}
    >
      {ok ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
      {label}
    </span>
  );
}

export function InboxDashboard({ canSend }: { canSend: boolean }) {
  const [data, setData] = useState<InboxResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<InboxChannelTab>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [composeOpen, setComposeOpen] = useState(false);
  const [replyOpen, setReplyOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [compose, setCompose] = useState({
    channel: "whatsapp" as SendChannel,
    to: "",
    subject: "",
    body: "",
    customerId: null as number | null,
  });

  const loadInbox = useCallback(async (channel: InboxChannelTab) => {
    setLoading(true);
    try {
      const res = await fetch(`${INBOX_API_URL}?channel=${channel}`, { cache: "no-store" });
      if (res.ok) setData(await res.json());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadInbox(activeTab);
  }, [activeTab, loadInbox]);

  const selected = useMemo(
    () => data?.messages.find((m) => m.id === selectedId) || data?.messages[0] || null,
    [data, selectedId]
  );

  const selectedSendChannel = selected ? mapMessageChannelToSend(selected.channel) : null;
  const canReplyToSelected = Boolean(canSend && selected && selectedSendChannel);

  useEffect(() => {
    if (selected && !selected.isRead) {
      fetch(`${INBOX_API_URL}/${selected.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isRead: true }),
      }).then(() => loadInbox(activeTab));
    }
  }, [selected?.id, selected?.isRead, activeTab, loadInbox]);

  useEffect(() => {
    setReplyOpen(false);
  }, [selected?.id]);

  function openReplyComposer(message: InboxMessage) {
    const channel = mapMessageChannelToSend(message.channel);
    if (!channel) return;
    setCompose({
      channel,
      to: message.contact,
      subject: message.subject ? `Re: ${message.subject}` : "",
      body: "",
      customerId: message.customerId,
    });
    setReplyOpen(true);
    setComposeOpen(false);
  }

  async function sendMessage(e: React.FormEvent) {
    e.preventDefault();
    if (!canSend) return;
    setSending(true);
    try {
      const endpoint =
        compose.channel === "email"
          ? "/api/integrations/email/send"
          : compose.channel === "sms"
          ? "/api/integrations/sms/send"
          : "/api/integrations/whatsapp/send";

      const payload =
        compose.channel === "email"
          ? {
              to: compose.to,
              subject: compose.subject,
              html: compose.body,
              text: compose.body,
              customerId: compose.customerId,
            }
          : { to: compose.to, body: compose.body, customerId: compose.customerId };

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const result = await res.json().catch(() => ({}));
      if (!res.ok && !result.logId) {
        alert(String(result.error || "فشل الإرسال"));
        return;
      }

      setCompose({ channel: compose.channel, to: "", subject: "", body: "", customerId: null });
      setComposeOpen(false);
      setReplyOpen(false);
      await loadInbox(activeTab);
    } finally {
      setSending(false);
    }
  }

  const unread = data?.unreadCounts || {};

  return (
    <section className="mt-8 space-y-4">
      <div className="rounded-[28px] border border-[#EAECEF] bg-white px-6 py-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h3 className="text-[22px] font-bold text-[#1F2937]">صندوق التواصل</h3>
          </div>
          {canSend && (
            <button
              type="button"
              onClick={() => {
                setComposeOpen((v) => !v);
                setReplyOpen(false);
              }}
              className="inline-flex items-center gap-2 rounded-2xl bg-[#2563EB] px-4 py-2.5 text-sm font-bold text-white"
            >
              <Send className="h-4 w-4" />
              رسالة جديدة
            </button>
          )}
        </div>

        {data && (
          <div className="mt-4 flex flex-wrap gap-2">
            <StatusPill ok={data.channels.whatsapp.configured} label="واتساب" />
            <StatusPill ok={data.channels.gmail.configured || data.channels.email.configured} label="Gmail / بريد" />
            <StatusPill ok={data.channels.sms.configured} label="SMS" />
            <StatusPill ok={data.channels.instagram.configured} label="إنستغرام" />
          </div>
        )}
      </div>

      {composeOpen && canSend && (
        <form onSubmit={sendMessage} className="rounded-[28px] border border-[#EAECEF] bg-white p-6 shadow-sm">
          <p className="mb-3 text-sm font-bold text-[#334155]">رسالة جديدة</p>
          <div className="grid gap-3 md:grid-cols-2">
            <select
              value={compose.channel}
              onChange={(e) =>
                setCompose({ ...compose, channel: e.target.value as SendChannel })
              }
              className="rounded-xl border border-[#E5E7EB] px-3 py-2 text-sm"
            >
              <option value="whatsapp">واتساب</option>
              <option value="email">بريد / Gmail</option>
              <option value="sms">SMS</option>
            </select>
            <input
              value={compose.to}
              onChange={(e) => setCompose({ ...compose, to: e.target.value })}
              placeholder="رقم الهاتف أو البريد"
              className="rounded-xl border border-[#E5E7EB] px-3 py-2 text-sm"
              dir="ltr"
              required
            />
            {compose.channel === "email" && (
              <input
                value={compose.subject}
                onChange={(e) => setCompose({ ...compose, subject: e.target.value })}
                placeholder="الموضوع"
                className="rounded-xl border border-[#E5E7EB] px-3 py-2 text-sm md:col-span-2"
                required
              />
            )}
            <textarea
              value={compose.body}
              onChange={(e) => setCompose({ ...compose, body: e.target.value })}
              placeholder="نص الرسالة"
              className="min-h-[100px] rounded-xl border border-[#E5E7EB] px-3 py-2 text-sm md:col-span-2"
              required
            />
          </div>
          <button
            type="submit"
            disabled={sending}
            className="mt-4 rounded-xl bg-[#2563EB] px-5 py-2 text-sm font-bold text-white disabled:opacity-60"
          >
            {sending ? "جاري الإرسال..." : "إرسال"}
          </button>
        </form>
      )}

      <div className="flex flex-wrap gap-2">
        {tabs.map((tab) => {
          const TabIcon = tab.icon;
          const count =
            tab.id === "all"
              ? unread.all || 0
              : tab.id === "gmail"
              ? (unread.gmail || 0) + (unread.email || 0)
              : unread[tab.id] || 0;

          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-bold transition ${
                activeTab === tab.id
                  ? "bg-[#2563EB] text-white"
                  : "bg-white text-[#64748B] ring-1 ring-[#E2E8F0] hover:bg-[#F8FAFC]"
              }`}
            >
              <TabIcon className="h-4 w-4" />
              {tab.label}
              {count > 0 && (
                <span className="rounded-full bg-rose-500 px-1.5 py-0.5 text-[10px] text-white">{count}</span>
              )}
            </button>
          );
        })}
      </div>

      <div className="grid min-h-[480px] grid-cols-1 gap-4 lg:grid-cols-[340px_1fr]">
        <div className="overflow-hidden rounded-[28px] border border-[#EAECEF] bg-white shadow-sm">
          {loading ? (
            <div className="flex items-center justify-center py-24 text-[#707A84]">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : !data?.messages.length ? (
            <div className="px-6 py-20 text-center">
              <MessageCircle className="mx-auto h-10 w-10 text-[#CBD5E1]" />
              <p className="mt-3 font-bold text-[#334155]">لا توجد رسائل بعد</p>
            </div>
          ) : (
            <div className="max-h-[560px] divide-y divide-[#F1F5F9] overflow-y-auto">
              {data.messages.map((msg) => {
                const active = selected?.id === msg.id;
                return (
                  <button
                    key={msg.id}
                    type="button"
                    onClick={() => setSelectedId(msg.id)}
                    className={`block w-full px-4 py-3 text-right transition ${
                      active ? "bg-[#EFF4FF]" : "hover:bg-[#FAFBFC]"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-bold text-[#1F2937]">
                        {msg.contactName || msg.contact}
                      </span>
                      {!msg.isRead && <span className="h-2 w-2 shrink-0 rounded-full bg-[#2563EB]" />}
                    </div>
                    <div className="mt-1 flex items-center gap-2 text-xs text-[#707A84]">
                      <span className="rounded bg-[#F1F5F9] px-1.5 py-0.5">
                        {channelLabels[msg.channel] || msg.channel}
                      </span>
                      <span>{msg.source === "inbound" ? "وارد" : "صادر"}</span>
                    </div>
                    <p className="mt-1 truncate text-xs text-[#64748B]">
                      {msg.subject || msg.body}
                    </p>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="rounded-[28px] border border-[#EAECEF] bg-white p-6 shadow-sm">
          {selected ? (
            <>
              <div className="border-b border-[#F1F5F9] pb-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-lg font-bold text-[#1F2937]">
                      {selected.contactName || selected.contact}
                    </p>
                    <p className="mt-1 text-sm text-[#707A84]" dir="ltr">
                      {selected.contact}
                    </p>
                  </div>
                  {canReplyToSelected && (
                    <button
                      type="button"
                      onClick={() => openReplyComposer(selected)}
                      className="inline-flex items-center gap-2 rounded-xl bg-[#2563EB] px-4 py-2 text-sm font-bold text-white"
                    >
                      <Reply className="h-4 w-4" />
                      رد
                    </button>
                  )}
                </div>
                <div className="mt-2 flex flex-wrap gap-2 text-xs">
                  <span className="rounded-full bg-[#EFF4FF] px-2 py-1 font-bold text-[#2563EB]">
                    {channelLabels[selected.channel] || selected.channel}
                  </span>
                  <span className="rounded-full bg-slate-100 px-2 py-1 text-slate-600">
                    {selected.source === "inbound" ? "رسالة واردة" : "رسالة صادرة"}
                  </span>
                  <span className="text-[#94A3B8]">
                    {new Date(selected.createdAt).toLocaleString("ar")}
                  </span>
                </div>
              </div>
              {selected.subject && (
                <p className="mt-4 font-bold text-[#334155]">{selected.subject}</p>
              )}
              <div className="mt-4 whitespace-pre-wrap rounded-2xl bg-[#F8FAFC] p-4 text-sm leading-7 text-[#334155]">
                {selected.body}
              </div>
              <p className="mt-3 text-xs text-[#94A3B8]">الحالة: {selected.status}</p>

              {replyOpen && canSend && (
                <form onSubmit={sendMessage} className="mt-6 rounded-2xl border border-[#EFF4FF] bg-[#EFF4FF] p-4">
                  <p className="mb-3 text-sm font-bold text-[#2563EB]">
                    الرد عبر {channelLabels[compose.channel] || compose.channel} — {compose.to}
                  </p>
                  {compose.channel === "email" && (
                    <input
                      value={compose.subject}
                      onChange={(e) => setCompose({ ...compose, subject: e.target.value })}
                      placeholder="الموضوع"
                      className="mb-3 w-full rounded-xl border border-[#E5E7EB] bg-white px-3 py-2 text-sm"
                      required
                    />
                  )}
                  <textarea
                    value={compose.body}
                    onChange={(e) => setCompose({ ...compose, body: e.target.value })}
                    placeholder="اكتب ردك هنا..."
                    className="min-h-[120px] w-full rounded-xl border border-[#E5E7EB] bg-white px-3 py-2 text-sm"
                    required
                  />
                  <div className="mt-3 flex gap-2">
                    <button
                      type="submit"
                      disabled={sending}
                      className="inline-flex items-center gap-2 rounded-xl bg-[#2563EB] px-4 py-2 text-sm font-bold text-white disabled:opacity-60"
                    >
                      <Send className="h-4 w-4" />
                      {sending ? "جاري الإرسال..." : "إرسال الرد"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setReplyOpen(false)}
                      className="rounded-xl border border-[#E5E7EB] bg-white px-4 py-2 text-sm font-bold text-[#64748B]"
                    >
                      إلغاء
                    </button>
                  </div>
                </form>
              )}

              {!canReplyToSelected && selected.source === "inbound" && canSend && (
                <p className="mt-4 text-xs text-[#94A3B8]">
                  {selected.channel === "instagram"
                    ? "الرد عبر إنستغرام غير متاح حالياً — استخدم واتساب أو البريد."
                    : "لا يمكن الرد على هذه الرسالة من هذه القناة."}
                </p>
              )}
            </>
          ) : (
            <div className="flex h-full min-h-[300px] items-center justify-center text-[#94A3B8]">
              اختر رسالة لعرض التفاصيل والرد
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
